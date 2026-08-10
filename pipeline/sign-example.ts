// End-to-end sealing demo on the OFFICIAL library (@nanopub/nanopub-js).
//
// Builds the same assertion the live nanopub
//   https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y
// was built from, then seals it with @nanopub/nanopub-js instead of nanopub-ts,
// and verifies the signature — proving the migration produces a valid trusty nanopub.
//
// Run:  npm install && npx tsx sign-example.ts
//
// Note: this signs with a fresh EPHEMERAL key and the current timestamp, so the
// `RA…` code will differ from the live one (as with any new nanopub). The real
// pipeline loads the ProbKnow system key (base64 PKCS#8 DER, or via pemToBase64Der).
//
// SPDX-License-Identifier: MIT

import * as crypto from "node:crypto";
import { buildAssertionNanopub, type AssertionForNanopub, SYSTEM_ID } from "./probknow-builders.js";
import { sealNanopub } from "./seal.js";

// Same inputs reverse-engineered from the published assertion + pubinfo graphs:
const input: AssertionForNanopub = {
  id: "46a9da61-1ea7-4065-b3bc-5f6d1f3cb3f2",
  subject: "https://example.org/levin-kg/claim-MURUGAN2022-C1",
  predicate: "http://www.w3.org/ns/prov#wasSupportedBy",
  object: "https://example.org/levin-kg/evidence-MURUGAN2022-C1-E1",
  evidenceWeight: 0.9816,
  domain: "levin-lab",
  paper: null,
};

// Ephemeral demo key → base64 PKCS#8 DER (the format @nanopub/nanopub-js wants).
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyBase64 = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString("base64");

const built = buildAssertionNanopub(input);
const np = await sealNanopub(built, {
  privateKeyBase64,
  signerIri: SYSTEM_ID,
  name: "Bioelectricity Nexus KG Publisher",
});

console.log("=== Signed nanopublication (TriG) ===\n");
console.log(np.rdf());
console.log("\nValid signature:", await np.hasValidSignature());
console.log("\nTo publish (test registry):");
console.log('  await np.publish("https://test.registry.knowledgepixels.com/");');
