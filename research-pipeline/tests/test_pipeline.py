import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pipeline


def source():
    text = "Synthetic source text for offline tests only. " * 5
    return {"approved": True, "title": "Synthetic paper", "doi": "10.1234/test",
            "abstract": text, "abstractSha256": pipeline.digest(text),
            "question": "What does this test?", "topic": "test",
            "sourceUrl": "https://example.org/paper",
            "metadataSource": "https://example.org/metadata",
            "authors": [], "year": "2026", "journal": "Test"}


class PipelineTests(unittest.TestCase):
    def test_catalogue(self):
        topics = json.loads(pipeline.CATALOGUE.read_text())
        self.assertEqual(len(topics), 20)
        self.assertEqual(len({t["id"] for t in topics}), len(topics))
        self.assertTrue(all(t["question"] and t["query"] for t in topics))

    def test_provenance_and_public_scope(self):
        body = pipeline.payload(source())
        self.assertIs(body["isPrivate"], False)
        self.assertEqual(body["domain"], "everyday-science")
        self.assertEqual(body["provenance"]["collection"], "oracle-starter-questions")
        self.assertEqual(body["provenance"]["abstractSha256"], source()["abstractSha256"])

    def test_rejects_unreviewed_private_and_modified(self):
        for changes in ({"approved": False}, {"approved": "true"}, {"isPrivate": True},
                        {"abstract": "invented"}, {"doi": "bad"},
                        {"sourceUrl": "https://user:password@example.org"}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                pipeline.payload({**source(), **changes})

    def test_pmc_discovery_unapproved(self):
        row = {"title": "<i>Study</i>", "doi": "10.1234/test",
               "abstractText": source()["abstract"], "source": "MED", "id": "123"}
        with patch.object(pipeline, "request", return_value={"resultList": {"result": [row]}}):
            papers = pipeline.discover({"id": "test", "question": "Question?", "query": "test"})
        self.assertEqual(papers[0]["title"], "Study")
        self.assertIs(papers[0]["approved"], False)
        self.assertEqual(papers[0]["abstractSha256"], pipeline.digest(papers[0]["abstract"]))

    def test_crossref_discovery(self):
        row = {"title": ["Study"], "DOI": "10.1234/test", "abstract": source()["abstract"]}
        with patch.object(pipeline, "request", return_value={"message": {"items": [row]}}):
            papers = pipeline.discover({"id": "test", "question": "Q?", "query": "test",
                                        "provider": "crossref"})
        self.assertEqual(len(papers), 1)
        self.assertIs(papers[0]["approved"], False)

    def test_resume_and_destination_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "ingestion.json"
            with patch.object(pipeline, "request", side_effect=[[], {"id": "p1"}]) as api:
                pipeline.publish([source()], "https://example.org", manifest)
                pipeline.publish([source()], "https://example.org", manifest)
                self.assertEqual(api.call_count, 2)
            with patch.object(pipeline, "request", side_effect=[[], {"id": "p2"}]) as api:
                pipeline.publish([source()], "https://other.example.org", manifest)
                self.assertEqual(api.call_count, 2)

    def test_deduplication_does_not_write_existing(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(pipeline, "request", return_value=[
                {"id": "p1", "doi": "https://doi.org/10.1234/TEST", "isPrivate": False}
            ]) as api:
                pipeline.publish([source()], "https://example.org", Path(directory) / "m.json")
                self.assertEqual(api.call_count, 1)

    def test_private_match_aborts(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(pipeline, "request", return_value=[
                {"id": "private", "doi": "10.1234/test", "isPrivate": True}
            ]), self.assertRaises(ValueError):
                pipeline.publish([source()], "https://example.org", Path(directory) / "m.json")

    def test_whole_batch_validation_before_writes(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(pipeline, "request") as api:
            invalid = copy.deepcopy(source())
            invalid["approved"] = False
            with self.assertRaises(ValueError):
                pipeline.publish([source(), invalid], "https://example.org", Path(directory) / "m.json")
            api.assert_not_called()

    def test_dry_run_never_calls_network(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "reviewed.json"
            path.write_text(json.dumps([source()]))
            with patch.object(sys, "argv", ["pipeline.py", "ingest", "--input", str(path)]), \
                    patch.object(pipeline, "request") as api:
                pipeline.main()
                api.assert_not_called()


if __name__ == "__main__":
    unittest.main()
