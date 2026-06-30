# probknow-ontology

The **ProbKnow** ontology and signed nanopublication examples from [probknow.com](https://probknow.com) — a probabilistic knowledge graph that aggregates scientific research across frontier domains (bioelectricity, active inference, synthetic biology, BCI, and more).

This repo is the public, ecosystem-facing artifact for the knowledge model: the vocabulary (T-Box), worked examples of the nanopublications we publish to the network, and ready-to-run SPARQL queries. The pure-TypeScript signing library that produces these nanopubs lives separately at [fractastical/nanopub-js](https://github.com/fractastical/nanopub-js).

> **Which form is current?** The `pk:` / `pkr:` form is what probknow's signing pipeline emits today — `examples/levin-potassium-channel.trig` is real output straight from the live builder. The `urn:pkg:` / `urn:levin-kg:` form (`examples/levin-P1.legacy.trig`) is an earlier published wave, kept fully queryable through the backward-compatibility crosswalk below.

## The ontology

- **IRI:** `https://w3id.org/probknow/ontology/1.0`
- **Term namespace** `pk:` → `https://w3id.org/probknow/ontology/1.0#`
- **Resource namespace** `pkr:` → `https://w3id.org/probknow/resource/`

Design principle: **reuse standards, mint sparingly.** ProbKnow reuses PROV-O, SKOS, Dublin Core Terms, the SPAR ontologies (CiTO, FaBiO), and the Nanopublication schema wherever a settled term exists. It mints terms only for the probabilistic-evaluation layer (e.g. `pk:weightOfEvidence`), which has no established standard.

- [`probknow-1.0.ttl`](probknow-1.0.ttl) — the ontology (Turtle).
- [`ONTOLOGY.md`](ONTOLOGY.md) — human-readable T-Box reference (classes, properties, design notes, and the legacy crosswalk).

## Backward compatibility — nothing needs re-publishing

Earlier nanopublications were published under legacy `urn:pkg:` / `urn:levin-kg:` terms. A published nanopub is content-addressed and immutable, so it can never be edited — but it does **not** need to be. The ontology declares each legacy term `owl:equivalentProperty` / `owl:equivalentClass` of its current `pk:` term (see the *Backward-compatibility crosswalk* section of the TTL). The complete set of legacy term-level identifiers ever emitted is just six:

| Legacy term | Current term |
| --- | --- |
| `urn:pkg:TestableHypothesis` | `pk:TestableHypothesis` |
| `urn:pkg:hasPriorProbability` | `pk:hasPriorProbability` |
| `urn:pkg:hasResolvability` | `pk:hasResolvability` |
| `urn:pkg:proposedTest` | `pk:proposedTest` |
| `urn:pkg:hypothesisType` | `pk:hypothesisType` |
| `urn:levin-kg:property:domain` | `pk:domain` |

So every already-published nanopub is queryable through the current vocabulary: an OWL-aware store treats the pairs as identical, and a plain SPARQL endpoint can `UNION` the two. Old and new nanopubs coexist and are fully compatible.

## Examples

Two signed nanopublications, both in [`examples/`](examples/):

- [`examples/levin-potassium-channel.trig`](examples/levin-potassium-channel.trig) — **current builder output**: a claim under the `pk:`/`pkr:` ontology (note `pk:weightOfEvidence`, `pk:domain`, and the `pkr:claim/...` resource IRI). This is what probknow's pipeline emits today.
- [`examples/levin-P1.legacy.trig`](examples/levin-P1.legacy.trig) — **earlier published wave**: a Levin-lab hypothesis **live on the nanopub network right now**, resolvable at <https://w3id.org/np/RANokmO9j8qIxyBdirmYlJ_zKFtlQiWgeA86AavxiO-is>. It uses the legacy `urn:pkg:` terms, bridged by the crosswalk above.

Both are valid trusty-URI nanopubs (RA hash + RSA-SHA256 signature) and pass the official Java `np check`.

## Queries

SPARQL queries in [`queries/`](queries/), runnable against a nanopub-network endpoint such as <https://query.knowledgepixels.com/> or <https://virtuoso.nps.petapico.org/sparql>:

- `all-probknow-nanopubs.rq` — every nanopub using a ProbKnow term.
- `claims-by-domain.rq` — nanopub counts grouped by frontier-science domain.
- `high-confidence-claims.rq` — claims with a high panel-assigned weight of evidence.

## Open improvements (where collaboration helps)

1. **IRI-ification of claim subjects/predicates.** The current builder still emits some bare strings (e.g. `<potassium channel function modulation>`) instead of resolvable IRIs.
2. **Linking claims to their source papers** via CiTO/FaBiO so a claim resolves to the paper it was extracted from.
3. **Confidence semantics.** Aligning `pk:weightOfEvidence` with `npx:hasConfidence` / existing nanopub confidence conventions.
4. **Dereferenceable terms.** Registering the `w3id.org/probknow` redirect so the `pk:` IRIs resolve to this ontology in a browser/tool.

## License

MIT — see [LICENSE](LICENSE).

## Nanopublication minting pipeline

The exact code that builds the assertion / provenance / pubinfo triples for every ProbKnow nanopublication lives in [`pipeline/`](./pipeline/) — so the *construction* of published nanopubs is auditable, not just their signatures. The cryptographic sealing (trusty URI + RSA signing) is the standalone [nanopub-js](https://github.com/fractastical/nanopub-js) package. See [`pipeline/README.md`](./pipeline/README.md), and run [`pipeline/reproduce-example.ts`](./pipeline/reproduce-example.ts) to rebuild a live nanopub's triples.
