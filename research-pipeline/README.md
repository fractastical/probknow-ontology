# Common-question research pipeline

Portable, review-first extraction of the Delphi application's
`scripts/starter-evidence.py` and `scripts/ingest-starter-evidence.py`.
Python 3.10+; no third-party dependencies, Replit account, model keys, or database
connection required. Place this directory beside the ontology repository's
existing `pipeline/`, not inside or in place of its nanopublication builders.

## What this does

1. Discover candidate source abstracts from Europe PMC or Crossref.
2. Let a contributor review source identity, relevance, and coverage.
3. Validate reviewed records and publish them through Delphi's existing paper API,
   preserving question provenance and source-text hashes.

This publishes **paper records**, not verified answers, scored claims, or signed
nanopublications. The application owns asynchronous claim extraction. The ontology
repository's existing `pipeline/` owns nanopublication building/signing.
Publication does not establish successful extraction, independent replication,
or sufficient evidence for a complete answer.

## Local workflow

From this directory:

```sh
python3 pipeline.py discover --topic stress --output candidates.json
python3 -m unittest discover -s tests -v
```

Review the candidates against their source URLs. Remove irrelevant records, retain
relevant contrary findings, and set `approved` to `true` only for reviewed records.
Save the selected array as `reviewed.json`. Do not change source abstracts or
replace them with AI summaries. The hash detects changed text; it does **not**
prove authenticity or perform scientific review.

```sh
python3 pipeline.py ingest --input reviewed.json
```

That is a dry run. Publishing requires a separate explicit command, using an
operator-approved deployment origin:

```sh
python3 pipeline.py ingest --input reviewed.json \
  --base-url https://YOUR-APP-HOST --manifest ingestion.json --publish
```

**Publishing changes the target public graph and can trigger paid extraction.**
Never run this against someone else's app. No production host is baked in.
Do not put credentials in URLs, files, patches, or pull requests.
This adapter matches the current app's `GET /api/papers?search=...` and
`POST /api/papers` contract; if a deployment requires authentication, it will fail
rather than bypass that requirement. Add an operator-approved authentication
adapter before using it there. The batch ingestion endpoint is deliberately not
used because it currently discards the question provenance needed by the Oracle.

The manifest is scoped to the destination origin and DOI. It is written after each
successful record, so a run can resume. Existing matching records are not modified
or republished; in particular, this does not attach an additional question to an
existing paper. Private or visibility-unknown matches are rejected.
Run only one publisher at a time: the current single-paper API has no atomic
DOI-idempotency contract, so concurrent publishers can race.

## Contributing through PRs

- Edit `questions.json` to improve question wording or discovery queries.
- Change `pipeline.py` and add offline tests for discovery or publishing behavior.
- Use stable question IDs. Query results are candidates, not automatically trusted
  sources. Europe PMC focuses on life sciences; Crossref's abstract coverage is
  uneven and can miss foundational books and historical experiments.
- Do not commit downloaded abstracts, private datasets, run manifests, credentials,
  or generated answers. Check redistribution rights before adding source fixtures.
- Explain how the change improves coverage and preserves contrary evidence.
- Run the test command above; network access is not needed for tests.

## Current boundaries / integration handoff

This is a staged code extraction, not a completed application migration. The
running app still uses its existing scripts; after review and merge, pin this
directory to an ontology-repository commit and replace the app's duplicate
discovery/ingestion entry points with calls to it.

There is **no recurring common-question scout yet**. Discovery can be rerun, but
neither a cron job nor an automatic publish action is installed by this patch.
A recurring scout still needs coverage prioritization, review policy, a single
queue owner, and verification of resulting claims/answers. Do not schedule
unreviewed candidates for automatic publication.
