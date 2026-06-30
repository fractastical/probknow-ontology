// Reproduce the triple construction of a live ProbKnow nanopublication.
//
// Target: https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y
// (resolves at the public registry, registry.knowledgepixels.com)
//
// This script rebuilds that nanopub's assertion / provenance / pubinfo triples
// from the same inputs `buildAssertionNanopub` received, so an auditor can diff
// the construction against the published TriG.
//
// Run (no install needed — this script is dependency-free):
//   npx tsx reproduce-example.ts
//
// Note on exact byte-for-byte reproduction of the `RA…` trusty URI:
//   The trusty hash is computed over ALL triples, which include `dc:created`
//   (a per-run timestamp) and the signature (which depends on the private key).
//   So the artifact code only reproduces if you fix the timestamp AND sign with
//   the original private key — which is, by design, secret. What an auditor CAN
//   do with only public material: (1) confirm the triple *construction* matches
//   (this script), and (2) verify the signature against the public key embedded
//   in the published nanopub's pubinfo using standard tooling (`np check`).
//
// SPDX-License-Identifier: MIT

import { buildAssertionNanopub, type AssertionForNanopub } from "./probknow-builders.js";

// The inputs reverse-engineered from the published assertion + pubinfo graphs:
const input: AssertionForNanopub = {
  id: "46a9da61-1ea7-4065-b3bc-5f6d1f3cb3f2",
  subject: "https://example.org/levin-kg/claim-MURUGAN2022-C1",
  predicate: "http://www.w3.org/ns/prov#wasSupportedBy",
  object: "https://example.org/levin-kg/evidence-MURUGAN2022-C1-E1",
  evidenceWeight: 0.9816,
  domain: "levin-lab",
  paper: null, // no DOI/title on this row → provenance falls back to prov:wasAttributedTo
};

const { triples, preUri } = buildAssertionNanopub(input);

console.log("=== Constructed triples (pre-signing) ===\n");
const byGraph = new Map<string, typeof triples>();
for (const t of triples) {
  const g = t.graph.replace(preUri, "<np>");
  if (!byGraph.has(g)) byGraph.set(g, []);
  byGraph.get(g)!.push(t);
}
for (const [g, ts] of byGraph) {
  console.log(`# graph ${g}`);
  for (const t of ts) {
    const s = t.subject.replace(preUri, "<np>");
    const o = t.object.replace(preUri, "<np>");
    console.log(`  ${s}  ${t.predicate}  ${o}`);
  }
  console.log();
}

console.log("=== Sealing (trusty URI + signature) ===");
console.log("To turn these triples into a signed nanopub, pass { triples, preUri }");
console.log("to signNanopub() from nanopub-js (https://github.com/fractastical/nanopub-js):");
console.log("    const signed = await signNanopub(triples, preUri, keyPair);");
console.log("\nThe published nanopub used the ProbKnow system key + its original");
console.log("timestamp, so its artifact code is RAzdRz…; verify that one with");
console.log("`np check` against the public key in its pubinfo graph.");
