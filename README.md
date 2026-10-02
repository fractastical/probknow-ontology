# probknow-ontology

The **ProbKnow** ontology and signed nanopublication examples from [probknow.com](https://probknow.com) — a probabilistic knowledge graph that aggregates scientific research across frontier domains (bioelectricity, active inference, synthetic biology, BCI, and more).

This repo is the public, ecosystem-facing artifact for the knowledge model: the vocabulary (T-Box), worked examples of the nanopublications we publish to the network, and ready-to-run SPARQL queries. The triple-construction code that builds these nanopubs is in [`pipeline/`](./pipeline/); the cryptographic sealing is delegated to the official pure-TypeScript library [`@nanopub/nanopub-js`](https://github.com/Nanopublication/nanopub-js).

> **Which form is current?** The `pk:` / `pkr:` form is what probknow's signing pipeline emits — the `examples/*.example.trig` files are fresh builder output. `examples/levin-claim-MURUGAN2022.trig` is a live nanopub from the previous builder generation (still carrying `example.org` subject IRIs), and `examples/levin-P1.legacy.trig` is from the earlier `urn:pkg:` wave; both stay fully queryable through the backward-compatibility crosswalk below.

## The ontology

- **IRI:** `https://w3id.org/probknow/ontology` (current version IRI `https://w3id.org/probknow/ontology/1.1`)
- **Term namespace** `pk:` → `https://w3id.org/probknow/ontology/` — slash-based and unversioned, so `pk:Claim` is `https://w3id.org/probknow/ontology/Claim` and each term can redirect on its own. Version 1.0 used hash terms under `…/ontology/1.0#`; the crosswalk maps them.
- **Resource namespace** `pkr:` → `https://w3id.org/probknow/resource/`

Design principle: **reuse standards, mint sparingly.** ProbKnow reuses PROV-O, SKOS, Dublin Core Terms, the SPAR ontologies (CiTO, FaBiO), and the Nanopublication schema wherever a settled term exists. It mints terms only for the probabilistic-evaluation layer (e.g. `pk:weightOfEvidence`), which has no established standard.

- [`probknow.ttl`](probknow.ttl) — the ontology (Turtle).
- [`ONTOLOGY.md`](ONTOLOGY.md) — human-readable T-Box reference (classes, properties, design notes, and the legacy crosswalk).

## Backward compatibility — nothing needs re-publishing

Earlier nanopublications were published under legacy identifiers: `urn:pkg:` / `urn:levin-kg:` terms in one wave, `https://example.org/levin-kg/` terms (plus a stray `https://w3id.org/levin-kg/`) in the Bayesian-assessment wave, and the hash terms of ontology version 1.0 (`https://w3id.org/probknow/ontology/1.0#…`) in the most recent one. A published nanopub is content-addressed and immutable, so it can never be edited — but it does **not** need to be. The ontology declares every legacy term `owl:equivalentProperty` / `owl:equivalentClass` of its current `pk:` term (see the *Backward-compatibility crosswalk* section of the TTL), and legacy individuals map by pattern to `pkr:` IRIs; the full tables are in [`ONTOLOGY.md`](ONTOLOGY.md#legacy--canonical-crosswalk).

So every already-published nanopub is queryable through the current vocabulary: an OWL-aware store treats the pairs as identical, and a plain SPARQL endpoint can `UNION` the two. Old and new nanopubs coexist and are fully compatible.

New nanopubs never carry legacy identifiers: the builders rewrite them with `canonicalIri()` (the same table as the crosswalk) and refuse any `example.org` IRI that is left over, since that namespace is reserved for documentation and can never resolve.

## Examples

Signed nanopublications in [`examples/`](examples/). Two are live on the network; the `*.example.trig` files are fresh output of the current builders, signed with a throwaway key for illustration and **not published**:

- [`examples/probknow-claim-entity.example.trig`](examples/probknow-claim-entity.example.trig) — a claim as an **entity nanopub** (the preferred granularity: one `pkr:claim/…` with its type, label, context, evidence link and weight, introduced by the nanopub).
- [`examples/probknow-claim-statement.example.trig`](examples/probknow-claim-statement.example.trig) — the same row as a **single-statement nanopub** (the original granularity); note the legacy `example.org` input IRIs rewritten to `pkr:`, and the weight stated about the assertion in the provenance graph.
- [`examples/probknow-intro.example.trig`](examples/probknow-intro.example.trig) — the publisher **introduction**: the agent typed `npx:Bot`, `npx:SoftwareAgent`, with its key declaration.

- [`examples/levin-claim-MURUGAN2022.trig`](examples/levin-claim-MURUGAN2022.trig) — **current builder output**: an evidence-support claim under the `pk:`/`pkr:` ontology (note `pk:weightOfEvidence`, `pk:domain`, and the `pkr:claim/...` resource IRI), **live on the nanopub network** at <https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y>. This is the nanopub reconstructed by [`pipeline/reproduce-example.ts`](pipeline/reproduce-example.ts). It predates the current builders, so fresh output differs: its `example.org` IRIs are rewritten to `pkr:`, the weight is stated about the assertion in the provenance graph, and pubinfo carries label, license, type, a `pkr:domain/` IRI and `npx:signedBy`.
- [`examples/levin-P1.legacy.trig`](examples/levin-P1.legacy.trig) — **earlier published wave**: a Levin-lab hypothesis **live on the nanopub network right now**, resolvable at <https://w3id.org/np/RANokmO9j8qIxyBdirmYlJ_zKFtlQiWgeA86AavxiO-is>. It uses the legacy `urn:pkg:` terms, bridged by the crosswalk above.

All are valid trusty-URI nanopubs (RA hash + RSA-SHA256 signature). With nanopub-java 1.94 `check -v`, the fresh examples report no issues at all (they carry label, type, signer and template links); the two live ones lack `npx:signedBy`, a label, a type and template links, which is what the current builders fix.

## The ProbKnow Space and templates

[`nanopubs/`](nanopubs/) holds the nanopublications that set ProbKnow up on the network: a **Space** (`https://w3id.org/spaces/probknow`, admins Tobias Kuhn and Joel Dietz) and seven **templates governed by it** — assertion templates for claims, evidence items, Bayesian assessments, LLM assessments and testable hypotheses, a provenance template for paper-derived extractions, and a pubinfo template for the domain — plus the declarations that make the Space maintain each template's kind. `generate.py` produces the sources, `sign.sh` signs them in order; see [`nanopubs/README.md`](nanopubs/README.md). Once published, every nanopub the pipeline emits links to its templates, so Nanodash renders it with its form and space members can evolve the templates without the original signing key.

## Queries

SPARQL queries in [`queries/`](queries/), runnable against a nanopub-network endpoint such as <https://query.knowledgepixels.com/> or <https://virtuoso.nps.petapico.org/sparql>:

- `all-probknow-nanopubs.rq` — every nanopub using a ProbKnow term or resource.
- `claims-by-domain.rq` — nanopub counts grouped by frontier-science domain (IRI or legacy literal form).
- `high-confidence-claims.rq` — claims with a high panel-assigned weight of evidence (0–1 score), wherever the weight is stated.

## Open improvements (where collaboration helps)

1. **Migrate the stored rows.** The application database still holds `example.org/levin-kg/…` IRIs. The builders rewrite them on export, but the rows should be migrated with the same rules (`canonicalIri()` / the crosswalk tables) so the guard never has to fire.
2. **Republish the live wave.** Every builder takes a `supersedes` input; republishing the 183 nanopubs on the network with `npx:supersedes` (same key) makes the old URIs resolve to clean versions. Publish the new introduction first, then the data.
3. **Publish the Space and templates** in [`nanopubs/`](nanopubs/); the builders already link every nanopub to them.
4. **Dereferenceable terms.** Registering the `w3id.org/probknow` redirect; the ready-to-submit rules are in [`w3id/`](w3id/).
5. **Linking claims to their source papers** via CiTO so a claim resolves to the paper it was extracted from (the DOI provenance is in place; typed citations are not).

Done: every builder writes `rdfs:label`, `dct:license`, `npx:hasNanopubType`, `npx:introduces` and optional `npx:supersedes`; legacy IRIs are canonicalized and `example.org` is refused; `pk:weightOfEvidence` is defined as the 0–1 score it always carried, with `pk:weightOfEvidenceDeciban` for the deciban data; `pk:domain` points at a `pkr:domain/` IRI; the introduction follows the ecosystem's bot pattern.

## License

MIT — see [LICENSE](LICENSE).

## Nanopublication minting pipeline

The exact code that builds the assertion / provenance / pubinfo triples for every ProbKnow nanopublication lives in [`pipeline/`](./pipeline/) — so the *construction* of published nanopubs is auditable, not just their signatures. The cryptographic sealing (trusty URI + RSA signing) is delegated to the official [`@nanopub/nanopub-js`](https://github.com/Nanopublication/nanopub-js) library, wrapped by [`pipeline/seal.ts`](./pipeline/seal.ts). See [`pipeline/README.md`](./pipeline/README.md), and run [`pipeline/reproduce-example.ts`](./pipeline/reproduce-example.ts) to rebuild a live nanopub's triples.


  ## FAQ

  ### Is this actually public? Can anyone view it without a GitHub login or token?

  Yes. The repo, the ontology, and the pipeline code are all public with no auth required. Verify yourself with a plain, unauthenticated request:

  ```bash
  curl -s https://raw.githubusercontent.com/fractastical/probknow-ontology/main/pipeline/probknow-builders.ts
  ```

  That returns the file directly — no login, no API key.

  ### Why is the nanopub construction code (`pipeline/`) in this repo instead of its own repo?

  It used to briefly exist as a separate repo (`probknow-nanopub-builders`). That was redundant — this repo already had a `pipeline/` folder with the same code, and splitting it out just meant two places to keep in sync for no benefit. The construction logic, the ontology it depends on (`probknow.ttl`), the worked examples, and the SPARQL queries are all one audit trail, so they live together here. The standalone repo is now archived with a pointer back to this one.

  ### Where is the signing / cryptographic code, then?

  It isn't ProbKnow code at all. Sealing (trusty-URI hashing + RSA-SHA256 signing per the nanopub spec) is the one piece that's generic rather than ProbKnow-specific, so it's delegated to the official pure-TypeScript implementation maintained by the Nanopublication project: [`@nanopub/nanopub-js`](https://github.com/Nanopublication/nanopub-js). [`pipeline/seal.ts`](./pipeline/seal.ts) is a thin adapter that hands the builders' output to it. Everything else in `pipeline/` is ProbKnow-specific triple *construction*.

  ProbKnow previously sealed with its own standalone port (`nanopub-ts`); that has been retired in favour of the official library.

  ### Is `pipeline/probknow-builders.ts` the real production code, or a simplified version for show?

  It's the exact construction logic used in production — not a re-implementation. `pipeline/reproduce-example.ts` proves it: it feeds the same inputs a real published nanopub was built from back into `buildAssertionNanopub()` and lets you diff the output against the live, resolvable nanopub at [w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y](https://w3id.org/np/RAzdRzAqBocJKLkN28FmiRA3njB3Yct4qXIU-FPTA6L2Y).
  