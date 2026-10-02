// End-to-end sealing demo on the OFFICIAL library (@nanopub/nanopub-js).
//
// Builds (1) the same single-statement claim the live nanopub
//   https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y
// was built from — note that its legacy `example.org/levin-kg/` IRIs are
// rewritten to `pkr:` by the builder — and (2) the same claim as an ENTITY
// nanopub (the preferred granularity), then seals both with @nanopub/nanopub-js
// and verifies the signatures.
//
// Run:  npm install && npx tsx sign-example.ts
//
// Note: this signs with a fresh EPHEMERAL key and the current timestamp, so the
// `RA…` codes differ from the live one (as with any new nanopub). The real
// pipeline loads the ProbKnow system key (base64 PKCS#8 DER, or via pemToBase64Der).
// Since @nanopub/nanopub-js 0.4 signing first checks the key against the
// introductions on the network, so with the ephemeral key you will see a warning
// that the ProbKnow agent is introduced by a different key: expected here, and
// exactly the check that protects a production run from signing with the wrong key.
//
// SPDX-License-Identifier: MIT

import * as crypto from "node:crypto";
import {
  buildAssertionNanopub,
  buildEntityNanopub,
  type AssertionForNanopub,
  type EntityForNanopub,
  PK,
  SIGNER_LABEL,
  SYSTEM_ID,
} from "./probknow-builders.js";
import { prettyTrig, sealNanopub } from "./seal.js";

// Ephemeral demo key → base64 PKCS#8 DER (the format @nanopub/nanopub-js wants).
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyBase64 = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("base64");
const opts = { privateKeyBase64, signerIri: SYSTEM_ID, name: SIGNER_LABEL };

// (1) The row the live nanopub was built from. The legacy IRIs are what the
// production database still holds; `buildAssertionNanopub` canonicalizes them.
const row: AssertionForNanopub = {
  id: "46a9da61-1ea7-4065-b3bc-5f6d1f3cb3f2",
  subject: "https://example.org/levin-kg/claim-MURUGAN2022-C1",
  predicate: "http://www.w3.org/ns/prov#wasSupportedBy",
  object: "https://example.org/levin-kg/evidence-MURUGAN2022-C1-E1",
  evidenceWeight: 0.9816,
  domain: "levin-lab",
  label: "Wearable bioreactor drug delivery enables limb regeneration in adult Xenopus (claim C1, evidence E1)",
  paper: { title: "Acute multidrug delivery via a wearable bioreactor facilitates long-term limb regeneration and functional recovery in adult Xenopus laevis.", doi: "10.1126/sciadv.abj2164", year: 2022 },
  // supersedes: "https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y",  // when republishing with the ORIGINAL key
};

// (2) The same knowledge as one entity nanopub: the claim with all its properties.
const entity: EntityForNanopub = {
  // no `iri`/`id`: the claim IRI is pkr:claim/<artifact code of this nanopub>; pass `id` for a database key instead
  type: PK + "Claim",
  label: "Wearable bioreactor drug delivery enables limb regeneration in adult Xenopus",
  description: "Acute multidrug delivery via a wearable bioreactor facilitates long-term limb regeneration and functional recovery in adult Xenopus laevis.",
  statements: [
    { predicate: "http://www.w3.org/ns/prov#wasSupportedBy", object: "https://w3id.org/probknow/resource/evidence/MURUGAN2022-C1-E1" },
    { predicate: PK + "context", object: "Xenopus laevis; hindlimb amputation; BioDome wearable bioreactor with five-drug cocktail; 24 h exposure; 18-month follow-up" },
  ],
  evidenceWeight: 0.9816,
  domain: "levin-lab",
  paper: row.paper,
};

for (const [title, built] of [
  ["Single-statement claim nanopub (legacy row, IRIs canonicalized)", buildAssertionNanopub(row)],
  ["Entity nanopub (preferred granularity)", buildEntityNanopub(entity)],
] as const) {
  const np = await sealNanopub(built, opts);
  console.log(`=== ${title} ===\n`);
  console.log(prettyTrig(np));
  console.log("Valid signature:", await np.hasValidSignature(), "\n");
}

console.log("To publish (test registry):");
console.log('  await np.publish("https://test.registry.knowledgepixels.com/");');
