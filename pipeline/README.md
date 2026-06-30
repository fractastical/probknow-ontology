# ProbKnow nanopublication minting pipeline

This directory makes the **construction** of every ProbKnow nanopublication
auditable. Until now you could verify a published nanopub's signature and trusty
hash from the artifact itself, but you could not see *how its triples were
assembled*. That logic is here.

## The two halves

Minting a ProbKnow nanopub is two independent, separately-auditable steps:

1. **Construction (this directory)** — decide which triples go into the four
   named graphs (head / assertion / provenance / pubinfo).
   See [`probknow-builders.ts`](./probknow-builders.ts).
2. **Sealing (`nanopub-js`)** — compute the trusty-URI RA hash and the
   RSA-SHA256 signature, then swap the placeholder URI for the final `RA…`
   artifact code. This is the standalone, dependency-free package
   [`nanopub-js`](https://github.com/fractastical/nanopub-js) — a faithful port
   of the Java `RdfHasher` / `trustyuri` algorithm whose output passes the
   official `np check`.

```
build*Nanopub()  ──►  { triples, preUri }  ──►  signNanopub(triples, preUri, keyPair)  ──►  signed TriG (https://w3id.org/np/RA…)
   (this dir)                                          (nanopub-js)
```

## The builders

[`probknow-builders.ts`](./probknow-builders.ts) is the exact construction logic
used in production. Four builders, one per nanopub kind:

| Builder | Mints | Tell-tale triples |
|---|---|---|
| `buildAssertionNanopub` | an extracted claim | `pk:weightOfEvidence`, `pk:domain` |
| `buildIntroNanopub` | the publisher key declaration | `npx:introduces`, `npx:hasPublicKey` |
| `buildAssessmentNanopub` | a multi-LLM hypothesis evaluation | `pk:LLMClaimAssessment`, `pk:assessedBy` |
| `buildPlatonicNanopub` | a testable hypothesis + its prior | `pk:TestableHypothesis`, `pk:hasPriorProbability` |

Each returns unsigned `{ triples, preUri }`. The `pk:`/`pkr:` terms are defined
in [`../probknow-1.0.ttl`](../probknow-1.0.ttl).

## Verify a live nanopub

[`reproduce-example.ts`](./reproduce-example.ts) rebuilds the triples of a real
published nanopub —
[`RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y`](https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y)
— from the same inputs the builder received, so you can diff the construction
against the published TriG. It is dependency-free — no install needed:

```bash
npx tsx reproduce-example.ts
```

**On byte-for-byte hash reproduction:** the trusty hash covers every triple,
including `dc:created` (a per-run timestamp) and the signature (which depends on
the private key). So the `RA…` code only reproduces if you fix the timestamp and
sign with the original — secret — key. With public material alone you can still
(1) confirm the triple construction matches (this script) and (2) verify the
signature against the public key embedded in the nanopub's pubinfo graph using
standard nanopub tooling (`np check`).

## License

MIT.
