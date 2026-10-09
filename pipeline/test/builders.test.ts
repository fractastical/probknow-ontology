import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { Parser } from "n3";
import {
  PK, PKR, PK_1_0, RDF, RDFS, DC, NP_NS, NPX, NT, XSD,
  ARTIFACT_CODE, LEGACY_TERMS, LEGACY_TERM_BASES, LEGACY_ENTITY_KINDS,
  RESOURCE_KIND, TEMPLATES, canonicalIri, resourceIri,
  buildEntityNanopub, buildAssertionNanopub, buildAssessmentNanopub,
  buildPlatonicNanopub, buildIntroNanopub, type NpTriple,
} from "../probknow-builders";

// No registry, key service, or other network access is permitted in this suite.
Socket.prototype.connect = function () { throw new Error("Offline test attempted network access"); } as any;
globalThis.fetch = async () => { throw new Error("Offline test attempted fetch"); };

const date = new Date("2026-01-02T03:04:05Z");
const entity = {
  id: "claim_123", type: PK + "Claim", label: "Claim text",
  description: "Full claim text", domain: "test-domain", createdAt: date,
};
const assessment = {
  id: "a1", hypothesisId: "h1", hypothesisCode: "H1", hypothesisTitle: "Hypothesis",
  hypothesisDomain: "test-domain", model: "test/model", modelLabel: "Test model",
  probability: null, confidence: null, verdict: null, reasoning: null,
  evidenceFor: null, evidenceAgainst: null, createdAt: date,
};
const platonic = {
  code: "P1", title: "Hypothesis", claim: "Claim", test: "Proposed test",
  prior: 50, resolvability: 75, domain: "test-domain", sourceLabel: "Test source",
};
const edge = {
  id: "edge1", subject: PKR + "claim/c1", predicate: RDFS + "label",
  object: "Claim text", domain: "test-domain", createdAt: date,
};
const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const intro = { publicKeyPem, agentIri: "https://probknow.com/test-agent", createdAt: date };
const oldUri = "https://w3id.org/np/RA" + "a".repeat(43);
const built = () => [
  buildEntityNanopub(entity), buildAssertionNanopub(edge),
  buildAssessmentNanopub(assessment), buildPlatonicNanopub(platonic),
  buildIntroNanopub(intro),
];
const objects = (triples: NpTriple[], predicate: string, graph?: string) =>
  triples.filter(t => t.predicate === predicate && (!graph || t.graph === graph)).map(t => t.object);

// Replace only the documented pre-signing markers; these aren't signed fixtures.
// Parsing the resulting N-Quads checks literal syntax and preservation independently
// of the builder's own escaping helpers.
function parsed(result: { triples: NpTriple[]; preUri: string }) {
  const iri = (v: string) => `<${v.replaceAll(result.preUri, "https://w3id.org/np/test")
    .replaceAll(ARTIFACT_CODE, "test")}>`;
  const term = (v: string) => v.startsWith('"')
    ? v.replace(/\^\^([^<].*)$/, (_, datatype) => "^^" + iri(datatype))
    : v.startsWith("_:") ? v : iri(v);
  return new Parser({ format: "N-Quads" }).parse(result.triples.map(t =>
    `${iri(t.subject)} ${iri(t.predicate)} ${term(t.object)} ${iri(t.graph)} .`).join("\n"));
}

test("every builder emits four linked named graphs and parseable RDF", () => {
  for (const result of built()) {
    const { triples, preUri } = result;
    assert.deepEqual(new Set(triples.map(t => t.graph)),
      new Set(["/", "/assertion", "/provenance", "/pubinfo"].map(s => preUri + s)));
    for (const [predicate, suffix] of [
      ["hasAssertion", "/assertion"], ["hasProvenance", "/provenance"],
      ["hasPublicationInfo", "/pubinfo"],
    ]) assert.deepEqual(objects(triples, NP_NS + predicate, preUri + "/"), [preUri + suffix]);
    assert.ok(triples.some(t => t.subject === preUri && t.predicate === RDF + "type"
      && t.object === NP_NS + "Nanopublication" && t.graph === preUri + "/"));
    assert.ok(parsed(result).length >= 10);
  }
});

test("all builder-emitted pk: terms and resource classes are declared in the ontology", () => {
  const ontology = new Parser().parse(readFileSync(new URL("../../probknow.ttl", import.meta.url), "utf8"));
  const declared = new Set(ontology.filter(q => q.predicate.value === RDF + "type").map(q => q.subject.value));
  for (const result of built()) for (const q of parsed(result)) {
    for (const t of [q.subject, q.predicate, q.object]) {
      if (t.termType === "NamedNode" && t.value.startsWith(PK)) {
        assert.ok(declared.has(t.value), `Undeclared ontology term: ${t.value}`);
      }
    }
  }
  for (const type of Object.keys(RESOURCE_KIND)) assert.ok(declared.has(type), type);
  for (const local of Object.values(LEGACY_TERMS)) assert.ok(declared.has(PK + local), local);
});

test("canonicalization covers documented term and entity mappings and is idempotent", () => {
  const cases: [string, string][] = [
    [PK_1_0 + "Claim", PK + "Claim"],
    ["urn:pkg:assessment:a", PKR + "assessment/a"],
    ["urn:pkg:hypothesis:h", PKR + "hypothesis/h"],
    ["urn:pkg:model:m", PKR + "model/m"],
    ["urn:pkg:platonic:p", PKR + "platonic/p"],
    ["urn:pkg:hasProbability", PK + "hasProbability"],
    ["urn:levin-kg:assertion:c", PKR + "claim/c"],
    ["urn:levin-kg:paper:p", PKR + "paper/p"],
    ["urn:levin-kg:property:domain", PK + "domain"],
    [NPX + "hasEvidenceWeight", PK + "weightOfEvidence"],
    [PKR + "claim/c", PKR + "claim/c"],
    ["https://doi.org/10.1000/test", "https://doi.org/10.1000/test"],
  ];
  for (const base of LEGACY_TERM_BASES) {
    for (const [old, local] of Object.entries(LEGACY_TERMS)) cases.push([base + old, PK + local]);
    for (const kind of LEGACY_ENTITY_KINDS) cases.push([base + kind + "-123", PKR + kind + "/123"]);
  }
  for (const [input, expected] of cases) {
    assert.equal(canonicalIri(input), expected);
    assert.equal(canonicalIri(canonicalIri(input)), expected);
  }
  assert.throws(() => canonicalIri(LEGACY_TERM_BASES[0] + "unknownTerm"), /no canonical/);
});

test("resource IDs are stable database keys or explicit artifact-code placeholders", () => {
  assert.equal(resourceIri(PK + "Claim", "abc_123-X"), PKR + "claim/abc_123-X");
  for (const id of [undefined, null, ""]) {
    assert.equal(resourceIri(PK + "Claim", id), PKR + "claim/" + ARTIFACT_CODE);
  }
  for (const id of ["a/b", "bad id", "../x", "x#y"]) assert.throws(() => resourceIri(PK + "Claim", id));
  assert.throws(() => resourceIri(PK + "UnknownClass", "id"));
  const result = buildEntityNanopub({ ...entity, id: undefined });
  assert.deepEqual(objects(result.triples, NPX + "introduces"), [PKR + "claim/" + ARTIFACT_CODE]);
});

test("an entity carries its grouped properties, reverse links, label and description", () => {
  const result = buildEntityNanopub({
    ...entity, statements: [
      { predicate: PK + "context", object: "First property" },
      { predicate: PK + "evidenceFor", object: "Second property" },
    ], about: [{ subject: PKR + "assessment/a1", predicate: PK + "evaluatesHypothesis" }],
  });
  const subject = PKR + "claim/" + entity.id;
  const assertion = result.triples.filter(t => t.graph === result.preUri + "/assertion");
  assert.deepEqual(objects(assertion, RDFS + "label"), ['"Claim text"']);
  assert.deepEqual(objects(assertion, DC + "description"), ['"Full claim text"']);
  for (const predicate of [PK + "context", PK + "evidenceFor"]) {
    assert.equal(assertion.find(t => t.predicate === predicate)?.subject, subject);
  }
  assert.equal(assertion.find(t => t.predicate === PK + "evaluatesHypothesis")?.object, subject);
  assert.deepEqual(objects(result.triples, NPX + "introduces"), [subject]);
});

test("legacy IRIs are rewritten in subject, predicate, type and object positions", () => {
  const result = buildEntityNanopub({
    ...entity, iri: "https://example.org/levin-kg/claim-123",
    type: "https://example.org/levin-kg/Assertion",
    statements: [{ predicate: "https://example.org/levin-kg/hasAssessment", object: "urn:pkg:assessment:a1" }],
  });
  assert.ok(result.triples.some(t => t.subject === PKR + "claim/123" &&
    t.predicate === PK + "hasAssessment" && t.object === PKR + "assessment/a1"));
  for (const q of parsed(result)) for (const t of [q.subject, q.predicate, q.object]) {
    if (t.termType === "NamedNode") assert.doesNotMatch(t.value, /example\.org|^urn:/);
  }
});

test("malformed and reserved IRIs fail before sealing", () => {
  for (const iri of ["natural language", "https://probknow.com/bad path", "https://example.com/x", 'https://probknow.com/"bad']) {
    assert.throws(() => buildEntityNanopub({ ...entity, iri }));
    assert.throws(() => buildEntityNanopub({ ...entity, statements: [{ predicate: iri, object: "x" }] }));
  }
  assert.throws(() => buildEntityNanopub({ ...entity, supersedes: "not an IRI" }));
});

test("literal round trip preserves Unicode, quotes, slashes, tabs and line endings", () => {
  const text = 'α → β "quoted" \\path\tline\nnext\rend';
  const quads = parsed(buildEntityNanopub({ ...entity, label: text, description: text }));
  assert.equal(quads.find(q => q.predicate.value === DC + "description")?.object.value, text);
  assert.ok(quads.filter(q => q.predicate.value === RDFS + "label").some(q => q.object.value === text));
});

test("template-backed entity, assessment and hypothesis builders emit template links", () => {
  // Legacy per-edge assertions and key introductions do not claim to match an
  // entity template. Arbitrary entity classes may also have no registered template.
  for (const result of [buildEntityNanopub(entity), buildAssessmentNanopub(assessment), buildPlatonicNanopub(platonic)]) {
    assert.equal(objects(result.triples, NT + "wasCreatedFromTemplate").length, 1);
    assert.deepEqual(objects(result.triples, NT + "wasCreatedFromProvenanceTemplate"), [TEMPLATES.provenance]);
    assert.ok(objects(result.triples, NT + "wasCreatedFromPubinfoTemplate").includes(TEMPLATES.pubinfoDomain));
  }
});

test("every registered entity template matches the committed signed-template manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../nanopubs/signed/template-iris.json", import.meta.url), "utf8"));
  const keys = {
    Claim: "probknow-claim", EvidenceItem: "probknow-evidence-item",
    BayesianAssessment: "probknow-bayesian-assessment",
    LLMClaimAssessment: "probknow-llm-assessment",
    TestableHypothesis: "probknow-testable-hypothesis",
  };
  for (const [type, key] of Object.entries(keys)) {
    assert.equal(TEMPLATES.assertion[PK + type], manifest[key].reference);
    const result = buildEntityNanopub({ ...entity, type: PK + type });
    assert.deepEqual(objects(result.triples, NT + "wasCreatedFromTemplate"), [manifest[key].reference]);
  }
  assert.equal(TEMPLATES.provenance, manifest["provenance-probknow-extraction"].reference);
  assert.equal(TEMPLATES.pubinfoDomain, manifest["pubinfo-probknow-domain"].reference);
});

test("supersedes preserves the old trusty URI exactly; omission creates no replacement link", () => {
  for (const result of [
    buildEntityNanopub({ ...entity, supersedes: oldUri }),
    buildAssertionNanopub({ ...edge, supersedes: oldUri }),
    buildAssessmentNanopub({ ...assessment, supersedes: oldUri }),
    buildPlatonicNanopub({ ...platonic, supersedes: oldUri }),
    buildIntroNanopub({ ...intro, supersedes: oldUri }),
  ]) assert.deepEqual(objects(result.triples, NPX + "supersedes", result.preUri + "/pubinfo"), [oldUri]);
  for (const result of built()) assert.deepEqual(objects(result.triples, NPX + "supersedes"), []);
  assert.ok(objects(buildEntityNanopub({ ...entity, supersedes: oldUri }).triples,
    NT + "wasCreatedFromPubinfoTemplate").includes(TEMPLATES.pubinfoSupersedes));
});

test("missing scores are absent while zero remains a real value", () => {
  for (const evidenceWeight of [undefined, null]) assert.deepEqual(
    objects(buildEntityNanopub({ ...entity, evidenceWeight }).triples, PK + "weightOfEvidence"), []);
  assert.deepEqual(objects(buildEntityNanopub({ ...entity, evidenceWeight: 0 }).triples,
    PK + "weightOfEvidence"), [`"0.0000"^^${XSD}double`]);
  for (const field of ["hasProbability", "hasConfidence"]) {
    assert.deepEqual(objects(buildAssessmentNanopub(assessment).triples, PK + field), []);
  }
});

test("bounded scores reject non-finite and out-of-range input", () => {
  for (const value of [-0.1, 1.1, NaN, Infinity, -Infinity]) {
    assert.throws(() => buildEntityNanopub({ ...entity, evidenceWeight: value }));
    assert.throws(() => buildAssertionNanopub({ ...edge, evidenceWeight: value }));
    assert.throws(() => buildAssessmentNanopub({ ...assessment, probability: value }));
    assert.throws(() => buildAssessmentNanopub({ ...assessment, confidence: value }));
  }
  for (const value of [-1, 101, NaN, Infinity]) {
    assert.throws(() => buildPlatonicNanopub({ ...platonic, prior: value }));
    assert.throws(() => buildPlatonicNanopub({ ...platonic, resolvability: value }));
  }
  for (const value of [0, 1]) {
    assert.doesNotThrow(() => buildEntityNanopub({ ...entity, evidenceWeight: value }));
    assert.doesNotThrow(() => buildAssessmentNanopub({ ...assessment, probability: value, confidence: value }));
    assert.doesNotThrow(() => buildPlatonicNanopub({ ...platonic, prior: value * 100, resolvability: value * 100 }));
  }
});

test("introduction declares the disposable public key and selected agent consistently", () => {
  const result = buildIntroNanopub(intro);
  const der = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  assert.deepEqual(objects(result.triples, NPX + "hasPublicKey"), [`"${der}"`]);
  assert.deepEqual(objects(result.triples, NPX + "declaredBy"), [intro.agentIri]);
  assert.deepEqual(objects(result.triples, NPX + "introduces"), [intro.agentIri]);
  assert.deepEqual(objects(result.triples, DC + "creator"), [intro.agentIri]);
});

test("fixed-input entity construction is deterministic and does not mutate input", () => {
  const input = structuredClone(entity);
  assert.deepEqual(buildEntityNanopub(input), buildEntityNanopub(input));
  assert.deepEqual(input, entity);
});
