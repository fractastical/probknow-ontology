# ProbKnow nanopublication minting pipeline

This directory makes the **construction** of every ProbKnow nanopublication
auditable. Until now you could verify a published nanopub's signature and trusty
hash from the artifact itself, but you could not see *how its triples were
assembled*. That logic is here.

## The two halves

Minting a ProbKnow nanopub is two independent, separately-auditable steps:

1. **Construction (this directory)** — decide which triples go into the four
   named graphs (head / assertion / provenance / pubinfo).
   See [`probknow-builders.ts`](./probknow-builders.ts). Dependency-free.
2. **Sealing ([`seal.ts`](./seal.ts) → `@nanopub/nanopub-js`)** — compute the
   trusty-URI RA hash and the RSA-SHA256 signature, then swap the placeholder URI
   for the final `RA…` artifact code. This is delegated to the official
   pure-TypeScript library
   [`@nanopub/nanopub-js`](https://github.com/Nanopublication/nanopub-js), whose
   output passes the official `np check`. `seal.ts` is a thin adapter: it maps the
   builder's `{ triples, preUri }` onto a `purl.org/nanopub/temp/` placeholder and
   hands it to `NanopubClass.fromRdf(...).sign()`.

```
build*Nanopub()  ──►  { triples, preUri }  ──►  sealNanopub({ triples, preUri }, opts)  ──►  signed TriG (https://w3id.org/np/RA…)
   (this dir)                                    (seal.ts → @nanopub/nanopub-js)
```

Run the end-to-end demo (`npm install` first):

```bash
npx tsx sign-example.ts
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

**On `npx:signedBy`:** sealing writes `npx:signedBy` into the signature block, as
the current nanopub spec requires. Nanopubs minted before that became mandatory —
including the `RAzdRz…` example above — carry only `npx:hasAlgorithm`,
`npx:hasPublicKey`, `npx:hasSignature` and `npx:hasSignatureTarget`, so expect
that one extra pubinfo triple when diffing fresh output against them.

**On byte-for-byte hash reproduction:** the trusty hash covers every triple,
including `dc:created` (a per-run timestamp) and the signature (which depends on
the private key). So the `RA…` code only reproduces if you fix the timestamp and
sign with the original — secret — key. With public material alone you can still
(1) confirm the triple construction matches (this script) and (2) verify the
signature against the public key embedded in the nanopub's pubinfo graph using
standard nanopub tooling (`np check`).

## License

MIT.
