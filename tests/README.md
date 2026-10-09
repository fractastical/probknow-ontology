# Offline ontology tests

Run from the repository root (Node.js 22 and Python 3.11):

```sh
npm ci --ignore-scripts --prefix pipeline
python -m pip install -r tests/requirements.txt
npm test --prefix pipeline
python -m unittest discover -s tests -v
```

Dependency installation needs internet access. The tests themselves run offline,
deny socket/fetch access, require no credentials or database, and never publish.
The introduction test generates a disposable RSA key in memory; no production
key is read or written.

## Coverage

- Parse the ontology, example RDF, and committed nanopub sources/signed fixtures.
  The documented `__NOW__` date marker is expanded only in unsigned source
  templates. Historical and signed artifacts are not modified.
- Check all five builders' four-graph structure and parse their output using N3.
- Check emitted ProbKnow terms against ontology declarations and canonicalization
  of known legacy term/entity mappings, including idempotence and unknown
  `example.org/levin-kg/` terms.
- Check database-key and artifact-code identities, grouped entity properties,
  reverse links, literal escaping, labels, descriptions, and malformed IRIs.
- Check supported entity-template links against the committed signed-template
  manifest, provenance/pubinfo links, and exact `supersedes` relationships.
- Check absent versus zero scores, score ranges, and non-finite input rejection.
  Probabilities/confidence/evidence weights use [0,1]; the Platonic builder's
  prior/resolvability inputs use [0,100] and are converted to [0,1].
- Check introduction agent/public-key consistency and deterministic construction
  with fixed inputs.
- Execute every supplied SPARQL query against local fixtures and an empty dataset.
  Assert current/legacy vocabulary coverage, high-confidence boundary handling,
  and domain counts that combine legacy literals with current resource IRIs.

The legacy single-edge builder and introduction builder do not emit an entity
assertion-template link; the tests deliberately do not pretend they do.
Upstream database-row grouping, production key authorization, and identifier
migration are outside this repository's offline test boundary.

## Continuous integration

`.github/workflows/ontology-tests.yml` runs these commands on pull requests,
pushes to `main`, and manual dispatch. The job has read-only repository
permissions, no secrets, and a ten-minute timeout. Do not switch it to
`pull_request_target` or add publishing steps.

Network availability, w3id resolution, test-registry publishing, and independent
Java signature/hash verification are separate integration checks, not assertions
made by this suite. Successful parsing of a signed fixture is not cryptographic
verification of its signature.
