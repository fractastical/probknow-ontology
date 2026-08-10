// ProbKnow nanopublication SEALING half — migrated to @nanopub/nanopub-js.
//
// The construction half (`probknow-builders.ts`) is unchanged and still
// dependency-free: it returns UNSIGNED `{ triples, preUri }`. This module is the
// replacement for what used to be `signNanopub()` from the standalone `nanopub-ts`
// package — it now delegates the trusty-URI RA hash + RSA-SHA256 signature to the
// official pure-TypeScript library:
//   https://github.com/Nanopublication/nanopub-js   (npm: @nanopub/nanopub-js)
//
//   build*Nanopub()  ──►  { triples, preUri }  ──►  sealNanopub(...)  ──►  signed TriG (RA…)
//      (probknow-builders.ts)                        (this file → @nanopub/nanopub-js)
//
// SPDX-License-Identifier: MIT

import { NanopubClass } from "@nanopub/nanopub-js";
import { Parser as N3Parser, Writer as N3Writer } from "n3";
import { SYSTEM_ID, type NpTriple } from "./probknow-builders.js";

// @nanopub/nanopub-js detects a placeholder base under this namespace and swaps it
// for the computed `RA…` trusty URI everywhere during signing. We map the builder's
// internal `preUri` (`https://w3id.org/np/ `, a Java-style space placeholder) onto
// this temp base so the official signer takes over URI minting.
const TEMP = "http://purl.org/nanopub/temp/np1/";

export interface SealOptions {
  /** RSA private key as base64-encoded PKCS#8 DER (the nanopub key format). */
  privateKeyBase64: string;
  /** Signer identity → written as `npx:signedBy`. A bot IRI or an ORCID. */
  signerIri: string;
  /** Human-readable signer name (required by @nanopub/nanopub-js to sign). */
  name: string;
}

// Remap a builder term/graph from the internal `preUri` placeholder onto the temp
// base @nanopub/nanopub-js understands:
//   preUri                 (this:)            → TEMP                 (…/np1/)
//   preUri + "/"           (head graph)       → TEMP + "Head"
//   preUri + "/assertion"  (+ provenance,…)   → TEMP + "assertion"  (etc.)
function remap(t: string, preUri: string): string {
  if (t === preUri) return TEMP;
  if (t === preUri + "/") return TEMP + "Head";
  if (t.startsWith(preUri + "/")) return TEMP + t.slice(preUri.length + 1);
  return t;
}

// Serialize a builder term to TriG syntax. Builder objects are already in "term
// form": full IRIs (bare), blank nodes (`_:`), or literals (`"…"`, optionally with
// a `^^datatype` whose IRI still needs angle brackets, or an `@lang` tag).
function term(t: string): string {
  if (t.startsWith('"')) {
    const m = t.match(/^(".*")\^\^(.+)$/); // typed literal: "value"^^IRI
    if (m) return `${m[1]}^^${m[2].startsWith("<") ? m[2] : `<${m[2]}>`}`;
    return t; // plain or language-tagged literal
  }
  if (t.startsWith("_:")) return t;
  return `<${t}>`;
}

/** Convert builder output into a TriG string on the temp placeholder base. */
export function triplesToTrig(triples: NpTriple[], preUri: string): string {
  const byGraph = new Map<string, NpTriple[]>();
  for (const q of triples) {
    const g = remap(q.graph, preUri);
    if (!byGraph.has(g)) byGraph.set(g, []);
    byGraph.get(g)!.push(q);
  }
  let out = "";
  for (const [g, qs] of byGraph) {
    out += `<${g}> {\n`;
    for (const q of qs) {
      const s = term(remap(q.subject, preUri));
      const p = `<${remap(q.predicate, preUri)}>`;
      const o = term(remap(q.object, preUri));
      out += `  ${s} ${p} ${o} .\n`;
    }
    out += `}\n`;
  }
  return out;
}

/**
 * Seal an unsigned nanopub (from any build*Nanopub()) into a signed NanopubClass.
 * Call `.rdf()` for the signed TriG, `.hasValidSignature()` to verify, or
 * `.publish(server)` to submit. Signing adds npx:hasAlgorithm/hasPublicKey/
 * hasSignature/hasSignatureTarget (and npx:signedBy = signerIri) to pubinfo, and
 * replaces the temp base with the `RA…` trusty URI throughout.
 */
export async function sealNanopub(
  built: { triples: NpTriple[]; preUri: string },
  opts: SealOptions,
): Promise<NanopubClass> {
  const trig = triplesToTrig(built.triples, built.preUri);
  const np = NanopubClass.fromRdf(trig, "trig", {
    privateKey: opts.privateKeyBase64,
    orcid: opts.signerIri,
    name: opts.name,
  });
  await np.sign();
  return np;
}

/** Strip PEM armor to the base64-DER string @nanopub/nanopub-js expects. */
export function pemToBase64Der(pem: string): string {
  return pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
}

// ─── Drop-in shim for nanopub-ts `signNanopub` ──────────────────────────────
// Lets the production signer (server/nanopub-signer.ts) migrate with only an
// import-path change: same `signNanopub(triples, preUri, keyPair)` call, same
// `{ trustyUri, trig, nquads }` result. The signer identity defaults to the
// ProbKnow system agent (baked into the builder triples), overridable via `signer`.

const SIGNER_NAME = "Bioelectricity Nexus KG Publisher";

/** Matches the `nanopub-ts` NpKeyPair (PEM strings). Only privateKeyPem is used. */
export interface NpKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

/** Matches the `nanopub-ts` signNanopub return shape. */
export interface SignedNanopub {
  trustyUri: string;
  trig: string;
  nquads: string;
}

/** Drop-in replacement for nanopub-ts `signNanopub(triples, preUri, keyPair)`. */
export async function signNanopub(
  triples: NpTriple[],
  preUri: string,
  keyPair: NpKeyPair,
  signer: { iri?: string; name?: string } = {},
): Promise<SignedNanopub> {
  const np = await sealNanopub(
    { triples, preUri },
    {
      privateKeyBase64: pemToBase64Der(keyPair.privateKeyPem),
      signerIri: signer.iri ?? SYSTEM_ID,
      name: signer.name ?? SIGNER_NAME,
    },
  );
  const trig = np.rdf();
  const m = trig.match(/@prefix this:\s*<([^>]+)>/) ?? trig.match(/(https:\/\/w3id\.org\/np\/RA[A-Za-z0-9_-]{43})/);
  return { trustyUri: m ? m[1] : "", trig, nquads: await trigToNquads(trig) };
}

function trigToNquads(trig: string): Promise<string> {
  const quads = new N3Parser({ format: "application/trig" }).parse(trig);
  const writer = new N3Writer({ format: "application/n-quads" });
  writer.addQuads(quads);
  return new Promise((resolve, reject) => writer.end((err, result) => (err ? reject(err) : resolve(result))));
}
