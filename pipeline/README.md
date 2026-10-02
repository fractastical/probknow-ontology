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

`seal.ts` also exports `prettyTrig(np)`, which re-serializes a signed nanopub
with the ProbKnow prefix table (`pk:`, `pkr:`, `dct:`, `prov:`, …) so the TriG
reads well; the signature and trusty URI cover the normalized quads, not the
text, so the result is the same nanopub as `np.rdf()`.

Run the end-to-end demo (`npm install` first); it seals the same claim once as a
single-statement nanopub and once as an entity nanopub:

```bash
npx tsx sign-example.ts
```

The demo signs with a throwaway key, so `@nanopub/nanopub-js` (0.4+) warns that
the ProbKnow agent is introduced on the network by a different key. That is the
library checking the signing key against the published introductions before it
signs — with the production key the warning does not appear, and a wrong key is
caught before anything is published.

### Republishing the live wave

1. Build and publish the new **introduction** first (`buildIntroNanopub` with
   `supersedes` = the current intro `RAeRhwmnf0epOdWM-YHoLQpETvq_uAIy9xmVtreiP1pdo`),
   signed with the production key, so the agent is typed and named on the network.
2. For every stored nanopub, build its replacement with `supersedes` = its old
   trusty URI (prefer `buildEntityNanopub`, grouping the rows of one entity).
3. Run `java -jar nanopub-<version>-jar-with-dependencies.jar check -v` over the
   signed files (and the nanopub skill's `check-nanopub-conformance.py` against
   the templates), publish a handful to `https://test.registry.knowledgepixels.com/`
   and inspect them in Nanodash, then publish the batch to the live network.
4. Verify on Nanopub Query that the publisher's nanopub count matches, and keep
   the old → new mapping.

## The builders

[`probknow-builders.ts`](./probknow-builders.ts) is the exact construction logic
used in production. Five builders:

| Builder | Mints | Tell-tale triples |
|---|---|---|
| `buildEntityNanopub` | one knowledge-graph entity (claim, evidence item, Bayesian assessment, …) with all its properties — **the preferred granularity** | `a pk:Claim` / `pk:EvidenceItem` / `pk:BayesianAssessment`, `pk:weightOfEvidence` on the entity |
| `buildAssertionNanopub` | a single extracted statement (the original per-row granularity) | the statement in the assertion; `a pk:Claim` + `pk:weightOfEvidence` on the assertion graph in provenance |
| `buildIntroNanopub` | the publisher agent (`npx:Bot`, `npx:SoftwareAgent`) and its key declaration | `npx:declaredBy`, `npx:hasPublicKey`, `frbr:owner` |
| `buildAssessmentNanopub` | a multi-LLM hypothesis evaluation (`pk:LLMClaimAssessment`) | `pk:assessedBy`, `pk:hasProbability` |
| `buildPlatonicNanopub` | a testable hypothesis + its prior (`pk:TestableHypothesis`) | `pk:proposedTest`, `pk:hasPriorProbability` |

### Resource identifiers: caller ids or the artifact code

Resources live under `pkr:<kind>/<id>` (`pkr:claim/…`, `pkr:evidence/…`,
`pkr:assessment/…`, `pkr:platonic/…`). The id is either **caller-provided**, a
database key such as `MURUGAN2022-C1` or a UUID (letters, digits, `_` and `-`
only), or, when none is given, **the artifact code of the nanopub that
introduces the resource**: `resourceIri()` writes the `~~~ARTIFACTCODE~~~`
marker and both signers replace it with the computed `RA…` code, so the IRI is
unique by construction and known once the nanopub is sealed (`signNanopub`
returns the trusty URI; the resource IRI is `pkr:<kind>/<its artifact code>`).
Nanodash mints the same form from the ProbKnow templates and matches either
form against them, so pipeline nanopubs with their own ids conform too.

### Legacy IRIs are rewritten, `example.org` is refused

Rows in the application database still hold identifiers from earlier export
waves (`https://example.org/levin-kg/claim-…`, `…/BayesianAssessment`,
`urn:pkg:…`). `canonicalIri()` rewrites every IRI the builders are handed into
its `pk:` / `pkr:` form — entities by pattern (`<kind>-<id>` → `pkr:<kind>/<id>`),
terms through the `LEGACY_TERMS` table, which is the same mapping the ontology's
crosswalk axioms encode. Anything still under `example.org` / `.com` / `.net`
after that (a namespace reserved for documentation) makes the builder throw, so a
row that would publish an unresolvable identifier fails at construction time.
Migrate the rows with the same rules and the guard never fires.

Every builder also writes the pubinfo metadata the nanopub network expects of a
published nanopub (see the [nanopub skill](https://github.com/knowledgepixels/nanopub-skill)
for the conventions):

- `rdfs:label` — a short human-readable label of the nanopub (the claim's `label`
  input, falling back to the paper title, then the claim id; the hypothesis title;
  "Assessment of … by …").
- `dct:license` — `LICENSE` in `probknow-builders.ts`, CC BY 4.0.
- `npx:hasNanopubType` — the minted resource's class (`pk:Claim`,
  `pk:LLMClaimAssessment`, `pk:TestableHypothesis`; `npx:declaredBy` for the intro).
- `npx:introduces` — the resource the nanopub mints (the entity, the assessment,
  the hypothesis, the agent), so its label and type are lifted to the nanopub and
  it is discoverable by IRI on the network. Single-statement nanopubs mint
  nothing and carry no `introduces`.
- `npx:supersedes` — when the builder is given a `supersedes` trusty URI, the
  nanopub replaces that earlier version. Valid only when signed with the **same
  key** as the original; the ProbKnow key is unchanged, so republishing the
  live wave this way makes every old URI resolve to its clean replacement.
- `pk:domain` — a `pkr:domain/<slug>` IRI, labelled in the same graph.
- `nt:wasCreatedFromTemplate`, `nt:wasCreatedFromProvenanceTemplate`,
  `nt:wasCreatedFromPubinfoTemplate` — the ProbKnow templates (governed by the
  ProbKnow space, sources in [`../nanopubs/`](../nanopubs/)) and the ecosystem's
  Creator, License and Supersedes pubinfo templates. The `TEMPLATES` table in
  `probknow-builders.ts` maps each entity class to its assertion template; a
  nanopub whose class has no template carries no links. Re-signing the templates
  changes their IRIs, and `nanopubs/sign.sh` prints the table to paste back.

Each returns unsigned `{ triples, preUri }`. The `pk:`/`pkr:` terms are defined
in [`../probknow.ttl`](../probknow.ttl).

## Verify a live nanopub

[`reproduce-example.ts`](./reproduce-example.ts) rebuilds the triples of a real
published nanopub —
[`RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y`](https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y)
— from the same inputs the builder received, so you can diff the construction
against the published TriG. It is dependency-free — no install needed:

```bash
npx tsx reproduce-example.ts
```

**Differences from the live wave:** sealing writes `npx:signedBy` into the
signature block, as the current nanopub spec requires; the builders rewrite the
legacy `example.org` IRIs to `pkr:`, state the weight about the assertion in the
provenance graph instead of on a separate `pkr:claim/<uuid>` IRI, and add
`rdfs:label`, `dct:license`, `npx:hasNanopubType` and a `pkr:domain/` IRI to
pubinfo. Nanopubs minted before these changes — including the `RAzdRz…` example
above — have none of that, so expect those differences when diffing.

**On byte-for-byte hash reproduction:** the trusty hash covers every triple,
including `dc:created` (a per-run timestamp) and the signature (which depends on
the private key). So the `RA…` code only reproduces if you fix the timestamp and
sign with the original — secret — key. With public material alone you can still
(1) confirm the triple construction matches (this script) and (2) verify the
signature against the public key embedded in the nanopub's pubinfo graph using
standard nanopub tooling (`np check`).

## License

MIT.
