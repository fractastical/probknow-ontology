# ProbKnow Ontology (v1.0)

Authoritative vocabulary for the PKG Aggregator probabilistic knowledge graph. This directory is
the single source of truth for the namespaces the paper should cite; the machine-readable T-Box is
[`probknow-1.0.ttl`](./probknow-1.0.ttl).

## Namespaces

| Prefix | IRI | Holds |
|---|---|---|
| `pk:`  | `https://w3id.org/probknow/ontology/1.0#` | **Terms** (classes & predicates) — the T-Box |
| `pkr:` | `https://w3id.org/probknow/resource/` | **Individuals** (papers, claims, hypotheses, assessments…) — the A-Box |

Both are intended to be **dereferenceable** via a [w3id.org](https://w3id.org) redirect to this
repository (and, for `pk:`, to content-negotiate the Turtle file). This replaces every earlier,
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
| `pk:weightOfEvidence` | data | minted | — | Aggregate weight of evidence for a claim, in decibans. |
| `pk:bayesFactor` | data | minted | — | Bayes factor. |
| `pk:pValue` | data | minted | — | Statistical p-value of an evidence item. |
| `pk:calibrationMethod` | data | minted | — | Calibration procedure used. |
| `pk:proposedTest` | data | minted | — | The experiment that would resolve the hypothesis. |
| `pk:assessmentType` | data | minted | — | Kind of assessment (e.g. 'multi-llm-claim-evaluation'). |
| `pk:hypothesisType` | data | minted | — | Kind of hypothesis (e.g. 'platonic-space-of-forms'). |
| `pk:marketSizeUsdBillions` | data | minted | — | Addressable market — **unit fixed: USD billions**. |
| `pk:yearsToAchievement` | data | minted | — | Years until realization. |
| `pk:domain` | data | minted | — | Frontier/contested domain slug. |

### Reused directly (no `pk:` term minted)

`np:Nanopublication`, `np:hasAssertion`/`hasProvenance`/`hasPublicationInfo`, `npx:introduces`,
`npx:declaredBy`/`hasAlgorithm`/`hasPublicKey` (nanopub schema + signing);
`prov:wasDerivedFrom`/`wasAttributedTo`/`wasGeneratedBy`, `prov:SoftwareAgent` (PROV-O);
`skos:Concept`/`broader`/`narrower`/`exactMatch` (SKOS);
`dcterms:title`/`identifier`/`created`/`creator`/`description`/`license`/`date` (Dublin Core);
`foaf:homepage`.

## Legacy → canonical crosswalk

| Legacy identifier (pre-1.0) | Canonical (1.0) |
|---|---|
| `urn:pkg:assessment:<id>` | `pkr:assessment/<id>` |
| `urn:pkg:hypothesis:<id>` | `pkr:hypothesis/<id>` |
| `urn:pkg:model:<m>` | `pkr:model/<m>` |
| `urn:pkg:platonic:<code>` | `pkr:platonic/<code>` |
| `urn:levin-kg:assertion:<id>` | `pkr:claim/<id>` |
| `urn:levin-kg:paper:<id>` | `pkr:paper/<id>` |
| `urn:levin-kg:property:domain` | `pk:domain` |
| `urn:levin-kg:system:publisher` | `pk:` system agent (`SYSTEM_ID`) |
| `npx:hasEvidenceWeight` | `pk:weightOfEvidence` |
| `urn:pkg:*` predicates (`evaluatesHypothesis`, `hasProbability`, …) | `pk:*` |

## Scope boundary (deliberate)

The live **nanopub generation** path (`server/nanopub-signer.ts`) emits the canonical `pk:`/`pkr:`
namespaces as of v1.0. Two things are intentionally **not** rewritten:

1. **Already-signed, stored nanopubs** keep their original Trusty URIs and TriG. Trusty URIs are
   content hashes, so historical artifacts are immutable by design; only newly signed nanopubs use
   v1.0 terms. (This is a vocabulary version bump, not a data migration.)
2. **Persisted graph-instance URLs** inside stored assertions (e.g. `https://example.org/levin-kg/…`,
   converted to `urn:levin-kg:…` for display) are bound to existing rows and the seed `.trig`
   fixtures; migrating them is a separate A-Box migration, out of scope for the ontology release.

Cited source papers continue to use real `https://doi.org/<doi>` IRIs as their subjects, which is
already dereferenceable and preferred over any minted identifier.
