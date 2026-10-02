# ProbKnow Ontology (v1.1)

Authoritative vocabulary for the PKG Aggregator probabilistic knowledge graph. This directory is
the single source of truth for the namespaces the paper should cite; the machine-readable T-Box is
[`probknow.ttl`](./probknow.ttl).

## Namespaces

| Prefix | IRI | Holds |
|---|---|---|
| `pk:`  | `https://w3id.org/probknow/ontology/` | **Terms** (classes & predicates) — the T-Box. Slash-based and unversioned (`…/ontology/Claim`); the version lives in `owl:versionIRI` (`…/ontology/1.1`) only. Version 1.0 used `…/ontology/1.0#`, mapped in the crosswalk. |
| `pkr:` | `https://w3id.org/probknow/resource/` | **Individuals** (papers, claims, hypotheses, assessments…) — the A-Box |

Both are intended to be **dereferenceable** via a [w3id.org](https://w3id.org) redirect to this
repository (and, for `pk:`, to content-negotiate the Turtle file). Individuals are
`pkr:<kind>/<id>`, where the id is either the application's own key (letters, digits, `_`, `-`) or
the artifact code of the nanopublication that introduces the individual (`pkr:claim/RA…`), which is
what the ProbKnow templates mint in Nanodash and what the pipeline mints when it is given no id. This replaces every earlier,
non-dereferenceable identifier (`urn:pkg:*`, `urn:levin-kg:*`, `https://example.org/levin-kg/*`)
and the three per-export-wave bases (`w3id.org/{levin-kg,aif,morphopkg}`).

## Design rule

> Reuse a standard term wherever one exists; mint a `pk:` term **only** for the
> probabilistic-evaluation layer, which has no settled standard.

## T-Box — classes

| Term | Status | Aligns to | Meaning |
|---|---|---|---|
| `pk:Paper` | minted | `fabio:ResearchPaper` | An ingested scholarly work (DOI where available). |
| `pk:Concept` | minted | `skos:Concept` | A reusable entity/method/term referenced by claims. |
| `pk:Claim` | minted | SEPIO (assertion) | A discrete claim extracted from a paper. **A belief, not an asserted fact.** |
| `pk:Hypothesis` | minted | `skos:Concept` | A named cluster of claims; hierarchical via `skos:broader`/`narrower`. |
| `pk:TestableHypothesis` | minted | ⊑ `pk:Hypothesis` | Hypothesis + proposed test + prior + resolvability. |
| `pk:EconomicPrediction` | minted | — | Dated market-size / time-to-impact forecast tied to a hypothesis. |
| `pk:EvidenceItem` | minted | ECO | One piece of supporting/opposing evidence. |
| `pk:Assessment` | minted | ⊑ `prov:Entity`; SEPIO | An n-ary evaluation yielding a probability/verdict. |
| `pk:BayesianAssessment` | minted | ⊑ `pk:Assessment` | Assessment with Bayes factors + calibration. |
| `pk:LLMClaimAssessment` | minted | ⊑ `pk:Assessment` | Assessment produced by a language model. |
| `pk:Model` | minted | ⊑ `prov:SoftwareAgent` | An evaluating language model (id + version). |
| `pk:Domain` | minted | — | A frontier-science domain (`pkr:domain/<slug>`, labelled with the slug). |

## T-Box — properties

| Term | Kind | Status | Aligns to | Meaning |
|---|---|---|---|---|
| `pk:hasAssessment` | object | minted | — | Hypothesis/claim → its assessment. |
| `pk:evaluatesHypothesis` | object | minted | inverse of `pk:hasAssessment` | Assessment → hypothesis evaluated. |
| `pk:assessedBy` | object | minted | ⊑ `prov:wasAttributedTo` | Assessment → model that produced it. |
| `pk:hasEvidence` | object | minted | — | Claim/assessment → evidence item. |
| `pk:derivedFromPaper` | object | minted | ⊑ `prov:wasDerivedFrom` | Claim → source paper. |
| `pk:hasEconomicPrediction` | object | minted | — | Hypothesis → economic prediction. |
| `pk:hasProbability` | data | minted | — | P(claim true) ∈ [0,1]. |
| `pk:hasConfidence` | data | minted | — | Assessor self-confidence ∈ [0,1]. |
| `pk:hasPriorProbability` | data | minted | — | Prior on a testable hypothesis. |
| `pk:hasResolvability` | data | minted | — | How decidably a hypothesis can be tested ∈ [0,1]. |
| `pk:hasVerdict` | data | minted | — | Short categorical label. |
| `pk:evidenceFor` | data | minted | `cito:supports` | Free-text supporting point. |
| `pk:evidenceAgainst` | data | minted | `cito:disagreesWith` | Free-text opposing point. |
| `pk:weightOfEvidence` | data | minted | — | Panel-assigned weight of evidence, a score in [0,1]. On the claim/evidence IRI, or on a single-statement nanopub's assertion graph (in its provenance graph). |
| `pk:weightOfEvidenceDeciban` | data | minted | — | Weight of evidence in decibans (10·log10 of the combined Bayes factor). |
| `pk:vovkSellkeMaxPRatio` | data | minted | — | Vovk–Sellke maximum p-ratio bound on an evidence item's Bayes factor. |
| `pk:statisticalTest` | data | minted | — | Free-text description of the test an evidence item's p-value comes from. |
| `pk:context` | data | minted | — | Free-text experimental context of a claim. |
| `pk:bayesFactor` | data | minted | — | Bayes factor. |
| `pk:pValue` | data | minted | — | Statistical p-value of an evidence item. |
| `pk:calibrationMethod` | data | minted | — | Calibration procedure used. |
| `pk:proposedTest` | data | minted | — | The experiment that would resolve the hypothesis. |
| `pk:assessmentType` | data | minted | — | Kind of assessment (e.g. 'multi-llm-claim-evaluation'). |
| `pk:hypothesisType` | data | minted | — | Kind of hypothesis (e.g. 'platonic-space-of-forms'). |
| `pk:marketSizeUsdBillions` | data | minted | — | Addressable market — **unit fixed: USD billions**. |
| `pk:yearsToAchievement` | data | minted | — | Years until realization. |
| `pk:domain` | object | minted | — | Nanopub/node → its `pk:Domain` (`pkr:domain/<slug>`). Pre-2026-10 nanopubs carry the slug as a literal. |

### Reused directly (no `pk:` term minted)

`np:Nanopublication`, `np:hasAssertion`/`hasProvenance`/`hasPublicationInfo`, `npx:introduces`,
`npx:supersedes`, `npx:hasNanopubType`, `npx:Bot`/`SoftwareAgent`,
`npx:declaredBy`/`hasAlgorithm`/`hasPublicKey` (nanopub schema + signing);
`prov:wasDerivedFrom`/`wasAttributedTo`/`wasGeneratedBy`, `prov:SoftwareAgent` (PROV-O);
`skos:Concept`/`broader`/`narrower`/`exactMatch` (SKOS);
`dcterms:title`/`identifier`/`created`/`creator`/`description`/`license`/`date` (Dublin Core);
`foaf:name`/`homepage`, `frbr:owner` (agent introduction).

## Legacy → canonical crosswalk

Three earlier export waves used identifiers that are now legacy, and ontology version 1.0 used hash-based term IRIs (`https://w3id.org/probknow/ontology/1.0#<Term>`), of which `weightOfEvidence` and `domain` occur in published nanopubs; every 1.0 term is mapped to its slash-based successor of the same name. Published nanopubs are
immutable, so the ontology maps every legacy **term** with `owl:equivalentClass` /
`owl:equivalentProperty` axioms (section *Backward-compatibility crosswalk* in the TTL), and
the builders rewrite every legacy identifier they are handed with `canonicalIri()` in
`pipeline/probknow-builders.ts`, driven by the same table. `example.org` is reserved for
documentation (RFC 2606) and `w3id.org/levin-kg` was never registered, so neither may appear
in new nanopubs; the builders throw on any `example.*` IRI that survives canonicalization.

**Individuals** map by pattern:

| Legacy identifier (pre-1.0) | Canonical (1.0) |
|---|---|
| `https://example.org/levin-kg/claim-<id>` (also `w3id.org/levin-kg/…`) | `pkr:claim/<id>` |
| `https://example.org/levin-kg/evidence-<id>` | `pkr:evidence/<id>` |
| `https://example.org/levin-kg/assessment-<id>` | `pkr:assessment/<id>` |
| `urn:pkg:assessment:<id>` | `pkr:assessment/<id>` |
| `urn:pkg:hypothesis:<id>` | `pkr:hypothesis/<id>` |
| `urn:pkg:model:<m>` | `pkr:model/<m>` |
| `urn:pkg:platonic:<code>` | `pkr:platonic/<code>` |
| `urn:levin-kg:assertion:<id>` | `pkr:claim/<id>` |
| `urn:levin-kg:paper:<id>` | `pkr:paper/<id>` |
| `urn:levin-kg:system:publisher` | the system agent (`SYSTEM_ID`) |

**Terms** map one to one:

| Legacy term | Canonical (1.0) |
|---|---|
| `example.org/levin-kg/Assertion` | `pk:Claim` |
| `example.org/levin-kg/BayesianAssessment` (also `w3id.org/levin-kg/…`) | `pk:BayesianAssessment` |
| `example.org/levin-kg/EvidenceItem` | `pk:EvidenceItem` |
| `example.org/levin-kg/weightOfEvidence`, `npx:hasEvidenceWeight` | `pk:weightOfEvidence` |
| `example.org/levin-kg/weightOfEvidence_deciban` (also `w3id.org/levin-kg/…`) | `pk:weightOfEvidenceDeciban` |
| `example.org/levin-kg/bayesFactorCombined` (also `w3id.org/levin-kg/…`) | `pk:bayesFactor` |
| `example.org/levin-kg/bayesFactorVS_MPR` | `pk:vovkSellkeMaxPRatio` |
| `example.org/levin-kg/calibrationMethod` | `pk:calibrationMethod` |
| `example.org/levin-kg/pValue` | `pk:pValue` |
| `example.org/levin-kg/statisticalTest` | `pk:statisticalTest` |
| `example.org/levin-kg/context` | `pk:context` |
| `example.org/levin-kg/hasAssessment` | `pk:hasAssessment` |
| `urn:pkg:TestableHypothesis`, `urn:pkg:hasPriorProbability`, `urn:pkg:hasResolvability`, `urn:pkg:proposedTest`, `urn:pkg:hypothesisType` | `pk:*` of the same name |
| `urn:levin-kg:property:domain` | `pk:domain` |

## Scope boundary (deliberate)

The live **nanopub generation** path (`server/nanopub-signer.ts`, built on `pipeline/`) emits
the canonical `pk:`/`pkr:` namespaces as of v1.0, rewriting legacy identifiers on the way out.
Two things are intentionally **not** rewritten:

1. **Already-signed, stored nanopubs** keep their original Trusty URIs and TriG. Trusty URIs are
   content hashes, so historical artifacts are immutable by design; only newly signed nanopubs use
   v1.0 terms. (This is a vocabulary version bump, not a data migration.)
2. **Persisted graph-instance URLs** inside stored assertions (e.g. `https://example.org/levin-kg/…`)
   are bound to existing rows and the seed `.trig` fixtures. The builders canonicalize them at
   export time, so new nanopubs are clean regardless; rewriting the rows themselves (with the
   same rules) is a separate A-Box migration in the application database.

Cited source papers continue to use real `https://doi.org/<doi>` IRIs as their subjects, which is
already dereferenceable and preferred over any minted identifier.
