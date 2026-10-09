// ProbKnow nanopublication builders — the exact triple-construction logic used
// to mint every nanopublication ProbKnow publishes to the public network.
//
// This is published so anyone auditing a ProbKnow nanopub can see *how* its
// assertion / provenance / pubinfo triples were assembled — not just verify the
// signature. The cryptographic half (trusty-URI RA hash + RSA-SHA256 signing) is
// delegated to the official pure-TypeScript library @nanopub/nanopub-js, wrapped
// by the sealing adapter in `seal.ts`:
//   https://github.com/Nanopublication/nanopub-js
//
// These functions return UNSIGNED triples plus the placeholder `preUri`
// (`NP_BASE + " "`). Pass both to `sealNanopub({ triples, preUri }, opts)` from
// ./seal.ts to produce the final signed TriG with its `RA…` trusty URI.
//
// This file is intentionally DEPENDENCY-FREE so the construction logic can be
// read and run (`npx tsx reproduce-example.ts`) without installing anything.
//
// Term definitions: ../probknow.ttl   (PK = ontology / T-Box, PKR = resources / A-Box)
//
// SPDX-License-Identifier: MIT

import * as crypto from "node:crypto";

// ─── Standard RDF / nanopub vocabulary ──────────────────────────────────────
export const NP_BASE = "https://w3id.org/np/";
export const NPX = "http://purl.org/nanopub/x/";
export const NP_NS = "http://www.nanopub.org/nschema#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const PROV = "http://www.w3.org/ns/prov#";
export const DC = "http://purl.org/dc/terms/";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const FOAF = "http://xmlns.com/foaf/0.1/";
export const FRBR = "http://purl.org/vocab/frbr/core#";
export const ORCID = "https://orcid.org/";
// Artifact-code placeholder used during construction (Java trusty-uri convention).
export const SPACE_AC = " ";

/** A quad in the internal nanopub format consumed by `seal.ts`. */
export interface NpTriple {
  subject: string;
  predicate: string;
  object: string;
  graph: string; // named graph URI
}

// ─── ProbKnow-specific namespaces & identity ────────────────────────────────
// Authoritative term definitions live in ../probknow.ttl
export const PK = "https://w3id.org/probknow/ontology/"; // classes & predicates (slash terms, unversioned)
/** Term namespace of ontology version 1.0 (hash terms); rewritten to PK by canonicalIri. */
export const PK_1_0 = "https://w3id.org/probknow/ontology/1.0#";
export const PKR = "https://w3id.org/probknow/resource/"; // individuals
export const SYSTEM_ID = "https://bioelectricitynexus.com/nanopub-system";
export const SYSTEM_HOMEPAGE = "https://bioelectricitynexus.com";
// License every ProbKnow nanopub is published under (`dct:license` in pubinfo).
// CC BY 4.0 is the nanopub ecosystem default; change here if the project decides otherwise.
export const LICENSE = "https://creativecommons.org/licenses/by/4.0/";
export const SIGNER_LABEL = "Bioelectricity Nexus KG Publisher";
export const NT = "https://w3id.org/np/o/ntemplate/";

// ─── Minting resource IRIs ──────────────────────────────────────────────────
// Resources live under pkr:<kind>/<id>. The id is either caller-provided (a database
// key such as MURUGAN2022-C1 or a UUID) or, when none is given, the ARTIFACT CODE of
// the nanopub that introduces the resource: the builders write the marker below and
// both signers (nanopub-java, @nanopub/nanopub-js) replace it with the computed
// RA… code at signing time, so the IRI is unique by construction and known only once
// the nanopub is sealed. Nanodash mints the same form from the ProbKnow templates
// (`…/~~ARTIFACTCODE~~` there), and matches either form against them.
export const ARTIFACT_CODE = "~~~ARTIFACTCODE~~~";
/** pkr: path segment per resource class. */
export const RESOURCE_KIND: Record<string, string> = {
  [`${PK}Claim`]: "claim",
  [`${PK}EvidenceItem`]: "evidence",
  [`${PK}BayesianAssessment`]: "assessment",
  [`${PK}LLMClaimAssessment`]: "assessment",
  [`${PK}Assessment`]: "assessment",
  [`${PK}TestableHypothesis`]: "platonic",
  [`${PK}Hypothesis`]: "hypothesis",
  [`${PK}Paper`]: "paper",
  [`${PK}Model`]: "model",
  [`${PK}Domain`]: "domain",
};
// Ids must be plain local names: this is what Nanodash unifies with the templates'
// artifact-code IRIs, and what keeps the IRI free of escaping.
const LOCAL_ID = /^[A-Za-z0-9_-]+$/;
/** The pkr: IRI of a resource of class `type` with the given id, or with the artifact-code marker when no id is given. */
export function resourceIri(type: string, id?: string | null): string {
  const kind = RESOURCE_KIND[canonicalIri(type)];
  if (!kind) throw new Error(`no pkr: kind known for class ${JSON.stringify(type)}; extend RESOURCE_KIND`);
  if (id != null && id !== "") {
    if (!LOCAL_ID.test(id)) throw new Error(`resource id ${JSON.stringify(id)} must match ${LOCAL_ID} (letters, digits, _ and -)`);
    return `${PKR}${kind}/${id}`;
  }
  return `${PKR}${kind}/${ARTIFACT_CODE}`;
}

// ─── Templates ──────────────────────────────────────────────────────────────
// Every nanopub links to the templates it was created from (nt:wasCreatedFromTemplate,
// …ProvenanceTemplate, …PubinfoTemplate), so Nanodash renders it with its form and it
// can be derived from or superseded there. The ProbKnow templates are governed by the
// ProbKnow space (https://w3id.org/spaces/probknow); their sources are in ../nanopubs/.
// The IRIs below are the signed versions: re-signing (nanopubs/sign.sh) changes them,
// and the script prints the new table (also nanopubs/signed/template-iris.json).
export const TEMPLATES = {
  /** Assertion templates by the class of the resource they create (embedded identity: <np>/template). */
  assertion: {
    [`${PK}Claim`]: "https://w3id.org/np/RAIVOEuhWNK4BuCbL_XRChRVlV6LKpFicBzwHpmuRxHWI/template",
    [`${PK}EvidenceItem`]: "https://w3id.org/np/RAk4kcX4zA_touv8CeKku9tTUnbR5xiTLSLwFbrKSl3BE/template",
    [`${PK}BayesianAssessment`]: "https://w3id.org/np/RAnN-8bznTS-PsGIw8LMU4LA_jybOJ4THjLzMRy_W0rFc/template",
    [`${PK}LLMClaimAssessment`]: "https://w3id.org/np/RAku3DINcetdFUnyTLflyV-8ep3QOCuL-IpGdS984vw8s/template",
    [`${PK}TestableHypothesis`]: "https://w3id.org/np/RAPZZB0fIwmSTnoiL9cBDSx9uRGI10J7gd9P42WmunbbA/template",
  } as Record<string, string>,
  /** "Extracted from a paper by ProbKnow": assertion attributed to an agent, derived from a paper. */
  provenance: "https://w3id.org/np/RA6svHudOcFjOo5Vr5kSCv1kVitLgngsx3xNQBeY_0bUg",
  /** Pubinfo templates: the ecosystem's Creator and License, ProbKnow's domain, and Supersedes when used. */
  pubinfoCreator: "https://w3id.org/np/RAukAcWHRDlkqxk7H2XNSegc1WnHI569INvNr-xdptDGI",
  pubinfoLicense: "https://w3id.org/np/RACJ58Gvyn91LqCKIO9zu1eijDQIeEff28iyDrJgjSJF8",
  pubinfoDomain: "https://w3id.org/np/RAtKj9bCnB4gUe0E9k-WhffQFSEWd9Ve2hrVllYoLuOB0",
  pubinfoSupersedes: "https://w3id.org/np/RAoTD7udB2KtUuOuAe74tJi1t3VzK0DyWS7rYVAq1GRvw",
};

// ─── Literal escaping (standard N-Triples literal escaping) ─────────────────
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}
const lit = (s: string): string => `"${esc(s)}"`;
const dbl = (n: number): string => `"${n.toFixed(4)}"^^${XSD}double`;

// Reject invalid scores before rounding or sealing; null/undefined mean unscored.
function boundedScore(value: number | null | undefined, field: string, max = 1): void {
  if (value == null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max)
    throw new Error(`${field}: expected a finite number in [0, ${max}]`);
}

// Export a PEM public key as SPKI DER base64 (the format the nanopub network
// expects in `npx:hasPublicKey`).
function publicKeyDerBase64(publicKeyPem: string): string {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" }) as Buffer;
  return der.toString("base64");
}

// ─── Legacy IRI canonicalization ────────────────────────────────────────────
// Earlier export waves minted terms and entities under namespaces that are not
// dereferenceable and, for example.org, reserved for documentation examples.
// Published nanopubs are immutable, so the ontology maps those terms with
// owl:equivalent* axioms (see "Backward-compatibility crosswalk" in the TTL).
// New nanopubs must not carry them at all: `canonicalIri` rewrites every legacy
// IRI the builders are handed into its `pk:` / `pkr:` form, using the SAME table
// the ontology's crosswalk is generated from, and `assertIri` refuses whatever
// is left under example.org. Migrate the stored rows with these rules and the
// guard never fires.

/** Legacy term namespaces (predicates and classes) used by earlier export waves. */
export const LEGACY_TERM_BASES = ["https://example.org/levin-kg/", "https://w3id.org/levin-kg/"];

/** Legacy local name → `pk:` local name. Keep in sync with the crosswalk in ../probknow.ttl. */
export const LEGACY_TERMS: Record<string, string> = {
  // classes
  Assertion: "Claim",
  BayesianAssessment: "BayesianAssessment",
  EvidenceItem: "EvidenceItem",
  // predicates
  weightOfEvidence: "weightOfEvidence",
  weightOfEvidence_deciban: "weightOfEvidenceDeciban",
  calibrationMethod: "calibrationMethod",
  bayesFactorCombined: "bayesFactor",
  bayesFactorVS_MPR: "vovkSellkeMaxPRatio",
  pValue: "pValue",
  statisticalTest: "statisticalTest",
  context: "context",
  hasAssessment: "hasAssessment",
};

/** Entity kinds that appeared as `<kind>-<id>` under the legacy bases; they become `pkr:<kind>/<id>`. */
export const LEGACY_ENTITY_KINDS = ["claim", "evidence", "assessment", "paper", "hypothesis", "model"];

/**
 * Rewrite a legacy IRI into its canonical `pk:` / `pkr:` form. IRIs that are not
 * legacy are returned unchanged. A legacy IRI with no known mapping throws, so a
 * forgotten term surfaces at construction time rather than on the network.
 */
export function canonicalIri(iri: string): string {
  if (iri.startsWith(PK_1_0)) return PK + iri.slice(PK_1_0.length);
  for (const base of LEGACY_TERM_BASES) {
    if (!iri.startsWith(base)) continue;
    const local = iri.slice(base.length);
    if (local in LEGACY_TERMS) return PK + LEGACY_TERMS[local];
    const m = /^([a-z]+)-(.+)$/.exec(local);
    if (m && LEGACY_ENTITY_KINDS.includes(m[1])) return `${PKR}${m[1]}/${m[2]}`;
    throw new Error(`no canonical pk:/pkr: IRI known for legacy IRI ${JSON.stringify(iri)}; extend LEGACY_TERMS`);
  }
  let m: RegExpExecArray | null;
  if ((m = /^urn:pkg:(assessment|hypothesis|model|platonic):(.+)$/.exec(iri))) return `${PKR}${m[1]}/${m[2]}`;
  if ((m = /^urn:pkg:([A-Za-z]+)$/.exec(iri))) return PK + m[1];
  if ((m = /^urn:levin-kg:assertion:(.+)$/.exec(iri))) return `${PKR}claim/${m[1]}`;
  if ((m = /^urn:levin-kg:paper:(.+)$/.exec(iri))) return `${PKR}paper/${m[1]}`;
  if (iri === "urn:levin-kg:property:domain") return `${PK}domain`;
  if (iri === "urn:levin-kg:system:publisher") return SYSTEM_ID;
  if (iri === `${NPX}hasEvidenceWeight`) return `${PK}weightOfEvidence`;
  return iri;
}

// ─── IRI validation ─────────────────────────────────────────────────────────
// Characters an IRI may never contain, per the N-Triples/TriG `IRIREF`
// production: control chars, space, and < > " { } | ^ ` \
const ILLEGAL_IRI_CHAR = /[\x00-\x20<>"{}|^`\\]/;

/**
 * Canonicalize `v`, assert that the result is usable as an absolute IRI on the
 * public network, and return it.
 *
 * The builders interpolate caller-supplied values straight into IRI positions, so
 * a source row holding natural-language text (e.g. a subject of `potassium channel
 * function modulation`) would otherwise be emitted as `<potassium channel function
 * modulation>` — output no RDF parser accepts and the registry rejects, discovered
 * only after signing. Likewise a row still holding an `example.org` IRI (a
 * namespace reserved for documentation, RFC 2606) would publish an identifier that
 * can never resolve. Fail loudly at construction time instead.
 */
function assertIri(v: string, field: string): string {
  if (typeof v !== "string" || v.length === 0)
    throw new Error(`${field}: expected a non-empty absolute IRI, got ${JSON.stringify(v)}`);
  v = canonicalIri(v);
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(v))
    throw new Error(`${field}: expected an absolute IRI (missing scheme), got ${JSON.stringify(v)}`);
  const bad = ILLEGAL_IRI_CHAR.exec(v);
  if (bad)
    throw new Error(
      `${field}: character ${JSON.stringify(bad[0])} is not allowed in an IRI, got ${JSON.stringify(v)}`,
    );
  if (/^https?:\/\/([a-z0-9-]+\.)*example\.(org|com|net)\//i.test(v))
    throw new Error(`${field}: ${JSON.stringify(v)} is under example.org/.com/.net, which is reserved for documentation; use a pk:/pkr: IRI`);
  return v;
}

// Smart term for assertion objects: detects URIs vs plain-text literals.
// If the value is not a URI or an already-quoted literal, wrap it as a string
// literal. Handles the case where the source object is stored as plain text
// (e.g. a title) rather than a quoted literal or URI. A value that *looks* like a
// URI must actually be a valid one — otherwise it would slip through as a bare IRI.
function objectTerm(v: string, field: string): string {
  if (v.startsWith('"')) return v; // already a quoted literal
  if (v.startsWith("_:")) return v; // blank node (passthrough)
  if (/^(https?|ftp|urn|mailto):/.test(v)) return assertIri(v, field); // URI
  return lit(v); // plain text → quoted literal
}

// `pk:domain` is an IRI under pkr:domain/ (a label triple is emitted alongside).
function domainIri(slug: string): string {
  return assertIri(`${PKR}domain/${slug}`, "domain");
}

// ─── Common pubinfo metadata ────────────────────────────────────────────────
// The nanopub-network conventions every published nanopub is expected to meet:
//   rdfs:label          short human-readable label of the nanopub itself
//   dct:license         the license the nanopub is published under
//   npx:hasNanopubType  the nanopub's type (what Nanodash / the registry list it as)
//   npx:introduces      the resource this nanopub mints, so its label/type are lifted
//                       to the nanopub and it becomes discoverable by IRI
//   npx:supersedes      the earlier version this nanopub replaces (same signing key)
// See github.com/knowledgepixels/nanopub-skill for the conventions these follow.
interface Common {
  label: string;
  nanopubType: string;
  introduces?: string | null;
  supersedes?: string | null;
  domain?: string | null;
  /** The assertion template (embedded-identity IRI) this nanopub follows; template links are written when set. */
  template?: string | null;
}
function pubinfoCommon(preUri: string, pubG: string, c: Common): NpTriple[] {
  const out: NpTriple[] = [
    { subject: preUri, predicate: `${RDFS}label`, object: lit(c.label), graph: pubG },
    { subject: preUri, predicate: `${DC}license`, object: LICENSE, graph: pubG },
    { subject: preUri, predicate: `${NPX}hasNanopubType`, object: c.nanopubType, graph: pubG },
  ];
  if (c.introduces) out.push({ subject: preUri, predicate: `${NPX}introduces`, object: c.introduces, graph: pubG });
  if (c.supersedes) out.push({ subject: preUri, predicate: `${NPX}supersedes`, object: assertIri(c.supersedes, "supersedes"), graph: pubG });
  if (c.domain) {
    const d = domainIri(c.domain);
    out.push(
      { subject: preUri, predicate: `${PK}domain`, object: d, graph: pubG },
      { subject: d, predicate: `${RDFS}label`, object: lit(c.domain), graph: pubG },
    );
  }
  if (c.template) {
    out.push(
      { subject: preUri, predicate: `${NT}wasCreatedFromTemplate`, object: c.template, graph: pubG },
      { subject: preUri, predicate: `${NT}wasCreatedFromProvenanceTemplate`, object: TEMPLATES.provenance, graph: pubG },
      { subject: preUri, predicate: `${NT}wasCreatedFromPubinfoTemplate`, object: TEMPLATES.pubinfoCreator, graph: pubG },
      { subject: preUri, predicate: `${NT}wasCreatedFromPubinfoTemplate`, object: TEMPLATES.pubinfoLicense, graph: pubG },
    );
    if (c.domain) out.push({ subject: preUri, predicate: `${NT}wasCreatedFromPubinfoTemplate`, object: TEMPLATES.pubinfoDomain, graph: pubG });
    if (c.supersedes) out.push({ subject: preUri, predicate: `${NT}wasCreatedFromPubinfoTemplate`, object: TEMPLATES.pubinfoSupersedes, graph: pubG });
  }
  return out;
}

function graphs(preUri: string) {
  return {
    headG: `${preUri}/`, // Head graph named with trailing / (nanopub-py convention; seal.ts renames it to …/Head)
    assertG: `${preUri}/assertion`,
    provG: `${preUri}/provenance`,
    pubG: `${preUri}/pubinfo`,
  };
}

function headTriples(preUri: string): NpTriple[] {
  const { headG, assertG, provG, pubG } = graphs(preUri);
  return [
    { subject: preUri, predicate: `${RDF}type`, object: `${NP_NS}Nanopublication`, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasAssertion`, object: assertG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasProvenance`, object: provG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasPublicationInfo`, object: pubG, graph: headG },
  ];
}

export interface PaperRef {
  title: string;
  doi?: string | null;
  year?: number | null;
}

// Provenance for content extracted from a paper: the assertion was derived from
// the paper (its DOI where known), and attributed to the ProbKnow system agent that
// did the extraction. Title/year are recorded on the paper IRI for readability.
function paperProvenance(assertG: string, provG: string, id: string, paper: PaperRef | null | undefined): NpTriple[] {
  const out: NpTriple[] = [{ subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG }];
  if (!paper) return out;
  const paperIri = paper.doi
    ? assertIri(`https://doi.org/${paper.doi}`, "paper.doi")
    : assertIri(`${PKR}paper/${id}`, "paper.id");
  out.push(
    { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: paperIri, graph: provG },
    { subject: paperIri, predicate: `${DC}title`, object: lit(paper.title), graph: provG },
  );
  if (paper.year) out.push({ subject: paperIri, predicate: `${DC}date`, object: `"${paper.year}"^^${XSD}gYear`, graph: provG });
  return out;
}

// ─── Entity nanopub (one knowledge-graph entity with all its properties) ─────
// The preferred granularity: one nanopub per claim / evidence item / assessment,
// carrying the entity's type, label and every property, so that the nanopub
// introduces one meaningful resource instead of a single disconnected edge.

export interface EntityForNanopub {
  /** The entity IRI (legacy forms are canonicalized to pkr:). Omit it to mint `pkr:<kind>/<id>`, or, with no `id` either, `pkr:<kind>/<artifact code>`. */
  iri?: string | null;
  /** The entity's class, e.g. `PK + "Claim"` (legacy forms are canonicalized to pk:). */
  type: string;
  label: string;
  description?: string | null;
  /** Further properties of the entity. `object` is an IRI, a quoted literal, or plain text (→ string literal). */
  statements?: { predicate: string; object: string }[] | null;
  /** Statements that have the entity as OBJECT, e.g. the claim an assessment is of: `{ subject: pkr:claim/X, predicate: pk:hasAssessment }`. */
  about?: { subject: string; predicate: string }[] | null;
  /** Panel-assigned weight of evidence for the entity, in [0,1]. */
  evidenceWeight?: number | null;
  domain: string;
  paper?: PaperRef | null;
  /** Row id: the local name of the minted IRI when `iri` is omitted, and the pkr:paper/ fallback when the paper has no DOI. */
  id?: string | null;
  /** Trusty URI of the earlier version of this nanopub (same signing key). */
  supersedes?: string | null;
  createdAt?: Date | null;
}

export function buildEntityNanopub(e: EntityForNanopub): { triples: NpTriple[]; preUri: string } {
  boundedScore(e.evidenceWeight, "entity.evidenceWeight");
  const preUri = NP_BASE + SPACE_AC;
  const { assertG, provG, pubG } = graphs(preUri);
  const type = assertIri(e.type, "entity.type");
  const iri = e.iri ? assertIri(e.iri, "entity.iri") : resourceIri(type, e.id);
  const now = (e.createdAt ?? new Date()).toISOString();

  const triples: NpTriple[] = [
    ...headTriples(preUri),

    // ── Assertion: the entity ──
    { subject: iri, predicate: `${RDF}type`, object: type, graph: assertG },
    { subject: iri, predicate: `${RDFS}label`, object: lit(e.label), graph: assertG },
    ...(e.description ? [{ subject: iri, predicate: `${DC}description`, object: lit(e.description), graph: assertG }] : []),
    ...(e.statements ?? []).map((s, i) => ({
      subject: iri,
      predicate: assertIri(s.predicate, `entity.statements[${i}].predicate`),
      object: objectTerm(s.object, `entity.statements[${i}].object`),
      graph: assertG,
    })),
    ...(e.about ?? []).map((s, i) => ({
      subject: assertIri(s.subject, `entity.about[${i}].subject`),
      predicate: assertIri(s.predicate, `entity.about[${i}].predicate`),
      object: iri,
      graph: assertG,
    })),
    ...(e.evidenceWeight != null && isFinite(e.evidenceWeight)
      ? [{ subject: iri, predicate: `${PK}weightOfEvidence`, object: dbl(e.evidenceWeight), graph: assertG }]
      : []),

    // ── Provenance ──
    ...paperProvenance(assertG, provG, e.id ?? iri.slice(iri.lastIndexOf("/") + 1).replace(ARTIFACT_CODE, "paper"), e.paper),

    // ── Pubinfo ──
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    ...pubinfoCommon(preUri, pubG, { label: e.label, nanopubType: type, introduces: iri, supersedes: e.supersedes, domain: e.domain, template: TEMPLATES.assertion[type] }),
  ];

  return { triples, preUri };
}

// ─── Assertion (single extracted edge) nanopub ──────────────────────────────
// The original per-row granularity: one knowledge-graph edge per nanopub. Kept
// for callers that cannot yet group rows into entities. The weight is a statement
// ABOUT the assertion, so it lives in the provenance graph on the assertion graph
// IRI, which is typed pk:Claim there ("the thing being believed"); the row id is
// kept as dct:identifier.

export interface AssertionForNanopub {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  evidenceWeight?: number | null;
  domain: string;
  paper?: PaperRef | null;
  /** Short human-readable label for the nanopub (rdfs:label). Falls back to the paper title, then the claim id. */
  label?: string | null;
  /** Trusty URI of the earlier version of this nanopub (same signing key). */
  supersedes?: string | null;
  createdAt?: Date | null;
}

export function buildAssertionNanopub(assertion: AssertionForNanopub): { triples: NpTriple[]; preUri: string } {
  boundedScore(assertion.evidenceWeight, "assertion.evidenceWeight");
  const preUri = NP_BASE + SPACE_AC; // space placeholder — content uniquifies the trusty URI
  const { assertG, provG, pubG } = graphs(preUri);
  const now = (assertion.createdAt ?? new Date()).toISOString();

  // Caller-supplied values that land in IRI positions — canonicalized and validated
  // before use so a malformed or legacy row fails here rather than on the network.
  const subjIri = assertIri(assertion.subject, "assertion.subject");
  const predIri = assertIri(assertion.predicate, "assertion.predicate");
  const label = assertion.label || assertion.paper?.title || `ProbKnow claim ${assertion.id}`;

  const triples: NpTriple[] = [
    ...headTriples(preUri),

    // ── Assertion graph: the edge ── (object normalized: plain text → literal, URI stays a URI)
    { subject: subjIri, predicate: predIri, object: objectTerm(assertion.object, "assertion.object"), graph: assertG },

    // ── Provenance graph: what the assertion is and how much evidence backs it ──
    { subject: assertG, predicate: `${RDF}type`, object: `${PK}Claim`, graph: provG },
    { subject: assertG, predicate: `${DC}identifier`, object: lit(assertion.id), graph: provG },
    ...(assertion.evidenceWeight != null && isFinite(assertion.evidenceWeight)
      ? [{ subject: assertG, predicate: `${PK}weightOfEvidence`, object: dbl(assertion.evidenceWeight), graph: provG }]
      : []),
    ...paperProvenance(assertG, provG, assertion.id, assertion.paper),

    // ── Pubinfo graph (base metadata — key/signature added by sealNanopub) ──
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    ...pubinfoCommon(preUri, pubG, { label, nanopubType: `${PK}Claim`, supersedes: assertion.supersedes, domain: assertion.domain }),
  ];

  return { triples, preUri };
}

// ─── Intro (agent + key declaration) nanopub ────────────────────────────────
// Follows the bot-introduction pattern of the nanopub ecosystem: the nanopub
// introduces the AGENT (typed npx:Bot + npx:SoftwareAgent, with a name, homepage
// and owner), and embeds the key declaration that binds the signing key to it.
// Sign it with the agent's own key and `npx:signedBy` = the agent IRI.

export interface IntroForNanopub {
  publicKeyPem: string;
  /** The agent IRI; defaults to SYSTEM_ID. */
  agentIri?: string | null;
  /** Display name of the agent; defaults to SIGNER_LABEL. */
  name?: string | null;
  homepage?: string | null;
  /** ORCID iD (bare `0000-0000-0000-0000` or full IRI) of the person responsible for the agent. */
  ownerOrcid?: string | null;
  ownerName?: string | null;
  /** Trusty URI of the earlier introduction this one replaces (same signing key). */
  supersedes?: string | null;
  createdAt?: Date | null;
}

export function buildIntroNanopub(intro: IntroForNanopub | string): { triples: NpTriple[]; preUri: string } {
  const i: IntroForNanopub = typeof intro === "string" ? { publicKeyPem: intro } : intro;
  const preUri = NP_BASE + SPACE_AC;
  const { assertG, provG, pubG } = graphs(preUri);
  const keyDecl = `${preUri}/keyDeclaration`;
  const agent = assertIri(i.agentIri ?? SYSTEM_ID, "intro.agentIri");
  const name = i.name ?? SIGNER_LABEL;
  const homepage = i.homepage === undefined ? SYSTEM_HOMEPAGE : i.homepage;
  const owner = i.ownerOrcid ? assertIri(i.ownerOrcid.startsWith("http") ? i.ownerOrcid : ORCID + i.ownerOrcid, "intro.ownerOrcid") : null;
  const now = (i.createdAt ?? new Date()).toISOString();

  // Export public key as SPKI DER base64 (the format the nanopub network expects)
  const spkiBase64 = publicKeyDerBase64(i.publicKeyPem);

  const triples: NpTriple[] = [
    ...headTriples(preUri),

    // Assertion — the agent and its key declaration
    { subject: agent, predicate: `${RDF}type`, object: `${NPX}Bot`, graph: assertG },
    { subject: agent, predicate: `${RDF}type`, object: `${NPX}SoftwareAgent`, graph: assertG },
    { subject: agent, predicate: `${FOAF}name`, object: lit(name), graph: assertG },
    { subject: agent, predicate: `${RDFS}label`, object: lit(name), graph: assertG },
    ...(homepage ? [{ subject: agent, predicate: `${FOAF}homepage`, object: assertIri(homepage, "intro.homepage"), graph: assertG }] : []),
    ...(owner ? [{ subject: agent, predicate: `${FRBR}owner`, object: owner, graph: assertG }] : []),
    { subject: keyDecl, predicate: `${NPX}declaredBy`, object: agent, graph: assertG },
    { subject: keyDecl, predicate: `${NPX}hasAlgorithm`, object: '"RSA"', graph: assertG },
    { subject: keyDecl, predicate: `${NPX}hasPublicKey`, object: `"${spkiBase64}"`, graph: assertG },

    // Provenance — attributed to the owner when known, else to the agent itself
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: owner ?? agent, graph: provG },

    // Pubinfo
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: agent, graph: pubG },
    ...(owner && i.ownerName ? [{ subject: owner, predicate: `${FOAF}name`, object: lit(i.ownerName), graph: pubG }] : []),
    ...pubinfoCommon(preUri, pubG, { label: name, nanopubType: `${NPX}declaredBy`, introduces: agent, supersedes: i.supersedes }),
  ];

  return { triples, preUri };
}

// ─── Assessment (multi-LLM hypothesis evaluation) nanopub ───────────────────

export interface AssessmentForNanopub {
  /** Local id of the assessment; omit to mint it from the nanopub's artifact code. */
  id?: string | null;
  hypothesisId: string;
  hypothesisCode: string;
  hypothesisTitle: string;
  hypothesisDomain: string;
  model: string;
  modelLabel: string;
  probability: number | null;
  confidence: number | null;
  verdict: string | null;
  reasoning: string | null;
  evidenceFor: string[] | null;
  evidenceAgainst: string[] | null;
  createdAt: Date;
  /** Trusty URI of the earlier version of this nanopub (same signing key). */
  supersedes?: string | null;
}

export function buildAssessmentNanopub(a: AssessmentForNanopub): { triples: NpTriple[]; preUri: string } {
  boundedScore(a.probability, "assessment.probability");
  boundedScore(a.confidence, "assessment.confidence");
  const preUri = NP_BASE + SPACE_AC;
  const { assertG, provG, pubG } = graphs(preUri);
  const assessUri = resourceIri(`${PK}LLMClaimAssessment`, a.id);
  const hypUri = assertIri(`${PKR}hypothesis/${a.hypothesisId}`, "assessment.hypothesisId");
  // `model` is sanitized to an IRI-safe charset rather than validated.
  const modelUri = `${PKR}model/${a.model.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const now = a.createdAt.toISOString();
  const label = `Assessment of ${a.hypothesisTitle} by ${a.modelLabel}`;

  const triples: NpTriple[] = [
    ...headTriples(preUri),

    // ── Assertion: assessment facts ──
    { subject: assessUri, predicate: `${RDF}type`, object: `${PK}LLMClaimAssessment`, graph: assertG },
    { subject: assessUri, predicate: `${RDFS}label`, object: lit(label), graph: assertG },
    { subject: assessUri, predicate: `${PK}evaluatesHypothesis`, object: hypUri, graph: assertG },
    { subject: hypUri, predicate: `${RDFS}label`, object: lit(a.hypothesisTitle), graph: assertG },
    { subject: hypUri, predicate: `${DC}identifier`, object: lit(a.hypothesisCode), graph: assertG },
    { subject: assessUri, predicate: `${PK}assessedBy`, object: modelUri, graph: assertG },
    { subject: modelUri, predicate: `${RDF}type`, object: `${PK}Model`, graph: assertG },
    { subject: modelUri, predicate: `${RDFS}label`, object: lit(a.modelLabel), graph: assertG },
  ];

  if (a.probability !== null)
    triples.push({ subject: assessUri, predicate: `${PK}hasProbability`, object: dbl(a.probability), graph: assertG });
  if (a.confidence !== null)
    triples.push({ subject: assessUri, predicate: `${PK}hasConfidence`, object: dbl(a.confidence), graph: assertG });
  if (a.verdict)
    triples.push({ subject: assessUri, predicate: `${PK}hasVerdict`, object: lit(a.verdict), graph: assertG });
  if (a.reasoning)
    triples.push({ subject: assessUri, predicate: `${RDFS}comment`, object: lit(a.reasoning), graph: assertG });
  for (const ef of a.evidenceFor ?? [])
    triples.push({ subject: assessUri, predicate: `${PK}evidenceFor`, object: lit(ef), graph: assertG });
  for (const ea of a.evidenceAgainst ?? [])
    triples.push({ subject: assessUri, predicate: `${PK}evidenceAgainst`, object: lit(ea), graph: assertG });

  // ── Provenance: produced by the model, run by the ProbKnow system ──
  // (the hypothesis link is in the assertion as pk:evaluatesHypothesis)
  triples.push(
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: modelUri, graph: provG },
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG },
  );

  // ── Pubinfo ──
  triples.push(
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PK}assessmentType`, object: `"multi-llm-claim-evaluation"`, graph: pubG },
    ...pubinfoCommon(preUri, pubG, { label, nanopubType: `${PK}LLMClaimAssessment`, introduces: assessUri, supersedes: a.supersedes, domain: a.hypothesisDomain, template: TEMPLATES.assertion[`${PK}LLMClaimAssessment`] }),
  );

  return { triples, preUri };
}

// ─── Platonic hypothesis nanopub ────────────────────────────────────────────

export interface PlatonicForNanopub {
  code: string;
  title: string;
  claim: string;
  test: string;
  prior: number; // 0–100
  resolvability: number; // 0–100
  domain: string;
  /** Human-readable name of the source (e.g. a seminar); minted as pkr:source/<slug>. */
  sourceLabel: string;
  /** Optional resolvable IRI of the source; used instead of the minted pkr:source/ IRI when given. */
  sourceIri?: string | null;
  /** Trusty URI of the earlier version of this nanopub (same signing key). */
  supersedes?: string | null;
  createdAt?: Date | null;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function buildPlatonicNanopub(p: PlatonicForNanopub): { triples: NpTriple[]; preUri: string } {
  boundedScore(p.prior, "platonic.prior", 100);
  boundedScore(p.resolvability, "platonic.resolvability", 100);
  const preUri = NP_BASE + SPACE_AC;
  const { assertG, provG, pubG } = graphs(preUri);
  const hypUri = resourceIri(`${PK}TestableHypothesis`, p.code);
  const sourceIri = p.sourceIri ? assertIri(p.sourceIri, "platonic.sourceIri") : assertIri(`${PKR}source/${slug(p.sourceLabel)}`, "platonic.sourceLabel");
  const now = (p.createdAt ?? new Date()).toISOString();

  const triples: NpTriple[] = [
    ...headTriples(preUri),

    // ── Assertion: the testable hypothesis + its prior ──
    { subject: hypUri, predicate: `${RDF}type`, object: `${PK}TestableHypothesis`, graph: assertG },
    { subject: hypUri, predicate: `${RDFS}label`, object: lit(p.title), graph: assertG },
    { subject: hypUri, predicate: `${DC}identifier`, object: lit(p.code), graph: assertG },
    { subject: hypUri, predicate: `${RDFS}comment`, object: lit(p.claim), graph: assertG },
    { subject: hypUri, predicate: `${PK}proposedTest`, object: lit(p.test), graph: assertG },
    { subject: hypUri, predicate: `${PK}hasPriorProbability`, object: dbl(p.prior / 100), graph: assertG },
    { subject: hypUri, predicate: `${PK}hasResolvability`, object: dbl(p.resolvability / 100), graph: assertG },

    // ── Provenance: derived from a named source, attributed to the system ──
    { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: sourceIri, graph: provG },
    { subject: sourceIri, predicate: `${RDFS}label`, object: lit(p.sourceLabel), graph: provG },
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG },

    // ── Pubinfo ──
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PK}hypothesisType`, object: `"platonic-space-of-forms"`, graph: pubG },
    ...pubinfoCommon(preUri, pubG, { label: p.title, nanopubType: `${PK}TestableHypothesis`, introduces: hypUri, supersedes: p.supersedes, domain: p.domain, template: TEMPLATES.assertion[`${PK}TestableHypothesis`] }),
  ];

  return { triples, preUri };
}
