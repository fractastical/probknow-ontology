// ProbKnow nanopublication builders — the exact triple-construction logic used
// to mint every nanopublication ProbKnow publishes to the public network.
//
// This is published so anyone auditing a ProbKnow nanopub can see *how* its
// assertion / provenance / pubinfo triples were assembled — not just verify the
// signature. The cryptographic half (trusty-URI RA hash + RSA-SHA256 signing,
// `signNanopub`) lives in the standalone, dependency-free `nanopub-js` package:
//   https://github.com/fractastical/nanopub-js
//
// These functions return UNSIGNED triples plus the placeholder `preUri`
// (`NP_BASE + " "`). Pass both to `signNanopub(triples, preUri, keyPair)` from
// nanopub-js to produce the final signed TriG with its `RA…` trusty URI.
//
// This file is intentionally DEPENDENCY-FREE so the construction logic can be
// read and run (`npx tsx reproduce-example.ts`) without installing anything.
//
// Term definitions: ../probknow-1.0.ttl   (PK = ontology / T-Box, PKR = resources / A-Box)
//
// SPDX-License-Identifier: MIT

import * as crypto from "node:crypto";

// ─── Standard RDF / nanopub vocabulary (identical to nanopub-js constants) ───
export const NP_BASE = "https://w3id.org/np/";
export const NPX = "http://purl.org/nanopub/x/";
export const NP_NS = "http://www.nanopub.org/nschema#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const PROV = "http://www.w3.org/ns/prov#";
export const DC = "http://purl.org/dc/terms/";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const FOAF = "http://xmlns.com/foaf/0.1/";
// Artifact-code placeholder used during construction (Java trusty-uri convention).
export const SPACE_AC = " ";

/** A quad in the internal nanopub format (identical to nanopub-js `NpTriple`). */
export interface NpTriple {
  subject: string;
  predicate: string;
  object: string;
  graph: string; // named graph URI
}

// ─── ProbKnow-specific namespaces & identity ────────────────────────────────
// Authoritative term definitions live in ../probknow-1.0.ttl
export const PK = "https://w3id.org/probknow/ontology/1.0#"; // classes & predicates
export const PKR = "https://w3id.org/probknow/resource/"; // individuals
export const SYSTEM_ID = "https://bioelectricitynexus.com/nanopub-system";

// ─── Literal escaping (matches nanopub-js `escapeLit`) ──────────────────────
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

// Export a PEM public key as SPKI DER base64 (the format the nanopub network
// expects in `npx:hasPublicKey`).
function publicKeyDerBase64(publicKeyPem: string): string {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" }) as Buffer;
  return der.toString("base64");
}

// Smart term for assertion objects: detects URIs vs plain-text literals.
// If the value is not a URI or an already-quoted literal, wrap it as a string
// literal. Handles the case where the source object is stored as plain text
// (e.g. a title) rather than a quoted literal or URI.
function assertionObjectTerm(v: string): string {
  if (v.startsWith('"')) return v; // already a quoted literal
  if (v.startsWith("_:")) return v; // blank node (passthrough)
  if (/^(https?|ftp|urn|mailto):/.test(v)) return v; // URI
  return `"${esc(v)}"`; // plain text → quoted literal
}

// ─── Assertion (extracted claim) nanopub ────────────────────────────────────

export interface AssertionForNanopub {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  evidenceWeight?: number | null;
  domain: string;
  paper?: { title: string; doi?: string | null; year?: number | null } | null;
}

export function buildAssertionNanopub(assertion: AssertionForNanopub): { triples: NpTriple[]; preUri: string } {
  const preUri = NP_BASE + SPACE_AC; // space placeholder — content uniquifies the trusty URI
  const headG = `${preUri}/`; // Head graph named with trailing / (nanopub-py convention)
  const assertG = `${preUri}/assertion`;
  const provG = `${preUri}/provenance`;
  const pubG = `${preUri}/pubinfo`;
  const now = new Date().toISOString();

  const triples: NpTriple[] = [
    // ── Head graph (NP structure declaration) ──
    { subject: preUri, predicate: `${RDF}type`, object: `${NP_NS}Nanopublication`, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasAssertion`, object: assertG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasProvenance`, object: provG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasPublicationInfo`, object: pubG, graph: headG },

    // ── Assertion graph ── (object normalized: plain text → literal, URI stays a URI)
    { subject: assertion.subject, predicate: assertion.predicate, object: assertionObjectTerm(assertion.object), graph: assertG },
    ...(assertion.evidenceWeight != null && isFinite(assertion.evidenceWeight)
      ? [{ subject: `${PKR}claim/${assertion.id}`, predicate: `${PK}weightOfEvidence`, object: `"${assertion.evidenceWeight.toFixed(4)}"^^${XSD}double`, graph: assertG }]
      : []),

    // ── Provenance graph ──
    ...(assertion.paper?.doi
      ? [
          { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: `https://doi.org/${assertion.paper.doi}`, graph: provG },
          { subject: `https://doi.org/${assertion.paper.doi}`, predicate: `${DC}title`, object: `"${esc(assertion.paper.title)}"`, graph: provG },
          ...(assertion.paper.year ? [{ subject: `https://doi.org/${assertion.paper.doi}`, predicate: `${DC}date`, object: `"${assertion.paper.year}"^^${XSD}gYear`, graph: provG }] : []),
        ]
      : assertion.paper
        ? [
            { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: `${PKR}paper/${assertion.id}`, graph: provG },
            { subject: `${PKR}paper/${assertion.id}`, predicate: `${DC}title`, object: `"${esc(assertion.paper.title)}"`, graph: provG },
          ]
        : [{ subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG }]),

    // ── Pubinfo graph (base metadata — key/signature added by signNanopub) ──
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PROV}wasGeneratedBy`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PK}domain`, object: `"${assertion.domain}"`, graph: pubG },
  ];

  return { triples, preUri };
}

// ─── Intro (key-declaration) nanopub ────────────────────────────────────────

export function buildIntroNanopub(publicKeyPem: string): { triples: NpTriple[]; preUri: string } {
  const preUri = NP_BASE + SPACE_AC;
  const headG = `${preUri}/`;
  const assertG = `${preUri}/assertion`;
  const provG = `${preUri}/provenance`;
  const pubG = `${preUri}/pubinfo`;
  const keyDecl = `${preUri}/keyDeclaration`;
  const now = new Date().toISOString();

  // Export public key as SPKI DER base64 (the format the nanopub network expects)
  const spkiBase64 = publicKeyDerBase64(publicKeyPem);

  const triples: NpTriple[] = [
    // Head
    { subject: preUri, predicate: `${RDF}type`, object: `${NP_NS}Nanopublication`, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasAssertion`, object: assertG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasProvenance`, object: provG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasPublicationInfo`, object: pubG, graph: headG },

    // Assertion — key declaration (standard nanopub intro format)
    { subject: keyDecl, predicate: `${NPX}declaredBy`, object: SYSTEM_ID, graph: assertG },
    { subject: keyDecl, predicate: `${NPX}hasAlgorithm`, object: '"RSA"', graph: assertG },
    { subject: keyDecl, predicate: `${NPX}hasPublicKey`, object: `"${spkiBase64}"`, graph: assertG },
    { subject: SYSTEM_ID, predicate: `${RDFS}label`, object: '"Bioelectricity Nexus KG Publisher"', graph: assertG },
    { subject: SYSTEM_ID, predicate: `${FOAF}homepage`, object: "https://bioelectricitynexus.com", graph: assertG },

    // Provenance
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG },

    // Pubinfo — npx:introduces is required for the network to accept this as a key intro
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${NPX}introduces`, object: keyDecl, graph: pubG },
  ];

  return { triples, preUri };
}

// ─── Assessment (multi-LLM hypothesis evaluation) nanopub ───────────────────

export interface AssessmentForNanopub {
  id: string;
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
}

export function buildAssessmentNanopub(a: AssessmentForNanopub): { triples: NpTriple[]; preUri: string } {
  const preUri = NP_BASE + SPACE_AC;
  const headG = `${preUri}/`;
  const assertG = `${preUri}/assertion`;
  const provG = `${preUri}/provenance`;
  const pubG = `${preUri}/pubinfo`;
  const assessUri = `${PKR}assessment/${a.id}`;
  const hypUri = `${PKR}hypothesis/${a.hypothesisId}`;
  const modelUri = `${PKR}model/${a.model.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const now = a.createdAt.toISOString();

  const triples: NpTriple[] = [
    // ── Head ──
    { subject: preUri, predicate: `${RDF}type`, object: `${NP_NS}Nanopublication`, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasAssertion`, object: assertG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasProvenance`, object: provG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasPublicationInfo`, object: pubG, graph: headG },

    // ── Assertion: assessment facts ──
    { subject: assessUri, predicate: `${RDF}type`, object: `${PK}LLMClaimAssessment`, graph: assertG },
    { subject: assessUri, predicate: `${PK}evaluatesHypothesis`, object: hypUri, graph: assertG },
    { subject: hypUri, predicate: `${RDFS}label`, object: `"${esc(a.hypothesisTitle)}"`, graph: assertG },
    { subject: hypUri, predicate: `${DC}identifier`, object: `"${a.hypothesisCode}"`, graph: assertG },
    { subject: assessUri, predicate: `${PK}assessedBy`, object: modelUri, graph: assertG },
    { subject: modelUri, predicate: `${RDFS}label`, object: `"${esc(a.modelLabel)}"`, graph: assertG },
  ];

  if (a.probability !== null)
    triples.push({ subject: assessUri, predicate: `${PK}hasProbability`, object: `"${a.probability.toFixed(4)}"^^${XSD}double`, graph: assertG });
  if (a.confidence !== null)
    triples.push({ subject: assessUri, predicate: `${PK}hasConfidence`, object: `"${a.confidence.toFixed(4)}"^^${XSD}double`, graph: assertG });
  if (a.verdict)
    triples.push({ subject: assessUri, predicate: `${PK}hasVerdict`, object: `"${esc(a.verdict)}"`, graph: assertG });
  if (a.reasoning)
    triples.push({ subject: assessUri, predicate: `${RDFS}comment`, object: `"${esc(a.reasoning)}"`, graph: assertG });
  for (const ef of a.evidenceFor ?? [])
    triples.push({ subject: assessUri, predicate: `${PK}evidenceFor`, object: `"${esc(ef)}"`, graph: assertG });
  for (const ea of a.evidenceAgainst ?? [])
    triples.push({ subject: assessUri, predicate: `${PK}evidenceAgainst`, object: `"${esc(ea)}"`, graph: assertG });

  // ── Provenance ──
  triples.push(
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: modelUri, graph: provG },
    { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: hypUri, graph: provG },
    { subject: assertG, predicate: `${PROV}wasGeneratedBy`, object: SYSTEM_ID, graph: provG },
    { subject: modelUri, predicate: `${DC}description`, object: `"AI language model performing scientific claim assessment"`, graph: provG },
  );

  // ── Pubinfo ──
  triples.push(
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PK}domain`, object: `"${a.hypothesisDomain}"`, graph: pubG },
    { subject: preUri, predicate: `${PK}assessmentType`, object: `"multi-llm-claim-evaluation"`, graph: pubG },
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
  sourceLabel: string;
}

export function buildPlatonicNanopub(p: PlatonicForNanopub): { triples: NpTriple[]; preUri: string } {
  const preUri = NP_BASE + SPACE_AC;
  const headG = `${preUri}/`;
  const assertG = `${preUri}/assertion`;
  const provG = `${preUri}/provenance`;
  const pubG = `${preUri}/pubinfo`;
  const hypUri = `${PKR}platonic/${p.code}`;
  const now = new Date().toISOString();

  const triples: NpTriple[] = [
    // ── Head ──
    { subject: preUri, predicate: `${RDF}type`, object: `${NP_NS}Nanopublication`, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasAssertion`, object: assertG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasProvenance`, object: provG, graph: headG },
    { subject: preUri, predicate: `${NP_NS}hasPublicationInfo`, object: pubG, graph: headG },

    // ── Assertion: the testable hypothesis + its prior ──
    { subject: hypUri, predicate: `${RDF}type`, object: `${PK}TestableHypothesis`, graph: assertG },
    { subject: hypUri, predicate: `${RDFS}label`, object: `"${esc(p.title)}"`, graph: assertG },
    { subject: hypUri, predicate: `${DC}identifier`, object: `"${esc(p.code)}"`, graph: assertG },
    { subject: hypUri, predicate: `${RDFS}comment`, object: `"${esc(p.claim)}"`, graph: assertG },
    { subject: hypUri, predicate: `${PK}proposedTest`, object: `"${esc(p.test)}"`, graph: assertG },
    { subject: hypUri, predicate: `${PK}hasPriorProbability`, object: `"${(p.prior / 100).toFixed(4)}"^^${XSD}double`, graph: assertG },
    { subject: hypUri, predicate: `${PK}hasResolvability`, object: `"${(p.resolvability / 100).toFixed(4)}"^^${XSD}double`, graph: assertG },

    // ── Provenance ──
    { subject: assertG, predicate: `${PROV}wasDerivedFrom`, object: `"${esc(p.sourceLabel)}"`, graph: provG },
    { subject: assertG, predicate: `${PROV}wasAttributedTo`, object: SYSTEM_ID, graph: provG },

    // ── Pubinfo ──
    { subject: preUri, predicate: `${DC}created`, object: `"${now}"^^${XSD}dateTime`, graph: pubG },
    { subject: preUri, predicate: `${DC}creator`, object: SYSTEM_ID, graph: pubG },
    { subject: preUri, predicate: `${PK}domain`, object: `"${esc(p.domain)}"`, graph: pubG },
    { subject: preUri, predicate: `${PK}hypothesisType`, object: `"platonic-space-of-forms"`, graph: pubG },
  ];

  return { triples, preUri };
}
