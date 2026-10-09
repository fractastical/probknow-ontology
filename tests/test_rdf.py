"""Offline syntax and actual SPARQL-result tests; never query the public registry."""
import socket
import unittest
from pathlib import Path
from rdflib import Dataset, Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, RDFS, XSD

ROOT = Path(__file__).resolve().parents[1]
PK = Namespace("https://w3id.org/probknow/ontology/")
OLD = Namespace("https://w3id.org/probknow/ontology/1.0#")
PKR = Namespace("https://w3id.org/probknow/resource/")
NP = Namespace("http://www.nanopub.org/nschema#")


def no_network(*args, **kwargs):
    raise AssertionError("Offline tests attempted network access")


socket.socket.connect = no_network
socket.create_connection = no_network


class OntologyTests(unittest.TestCase):
    def test_all_turtle_and_trig_parse(self):
        paths = sorted(ROOT.glob("*.ttl"))
        for directory in ("examples", "nanopubs"):
            paths += sorted((ROOT / directory).rglob("*.ttl"))
            paths += sorted((ROOT / directory).rglob("*.trig"))
        paths = [p for p in paths if "tmp" not in p.relative_to(ROOT).parts]
        self.assertGreater(len(paths), 2, "RDF discovery unexpectedly found no examples")
        for path in paths:
            with self.subTest(path=str(path.relative_to(ROOT))):
                graph = Dataset() if path.suffix == ".trig" else Graph()
                text = path.read_text()
                # Source templates deliberately leave the publication date for
                # sign.sh. Expand only that marker in unsigned source templates;
                # signed and historical examples are always parsed unchanged.
                if path.is_relative_to(ROOT / "nanopubs" / "src"):
                    text = text.replace("__NOW__", "2026-01-02T03:04:05Z")
                graph.parse(data=text, publicID=path.as_uri(),
                            format="trig" if path.suffix == ".trig" else "turtle")
                self.assertGreater(len(graph), 0)

    def dataset(self):
        dataset = Dataset()
        # Register the empty default graph before GRAPH queries enumerate contexts.
        # RDFLib's memory store otherwise adds it during iteration.
        dataset.store.add_graph(dataset.default_context)
        # New/old vocabulary, exactly-on-threshold, low, missing and unrelated
        # examples exercise selection, aggregation, and backwards compatibility.
        for ident, vocabulary, weight, domain, entity in [
            ("new", PK, .9, "bio", True),
            ("boundary", OLD, .8, "bio", False),
            ("low", PK, .79, "chemistry", True),
            ("missing", PK, None, "chemistry", True),
            ("unrelated", Namespace("https://unrelated.test/vocab/"), .99, None, True),
        ]:
            np = URIRef("https://fixtures.test/np/" + ident)
            assertion = URIRef(str(np) + "/assertion")
            claim = PKR["claim/" + ident] if domain else URIRef("https://unrelated.test/claim")
            head = dataset.graph(URIRef(str(np) + "/head"))
            head.add((np, RDF.type, NP.Nanopublication))
            head.add((np, NP.hasAssertion, assertion))
            head.add((np, NP.hasPublicationInfo, URIRef(str(np) + "/pubinfo")))
            dataset.graph(assertion).add((claim, RDF.type, vocabulary.Claim))
            # Older single-edge weights can be in provenance, not assertion.
            score_graph = dataset.graph(assertion if entity else URIRef(str(np) + "/provenance"))
            score_subject = claim if entity else assertion
            score_graph.add((score_subject, RDFS.label, Literal(ident)))
            if weight is not None:
                score_graph.add((score_subject, vocabulary.weightOfEvidence, Literal(weight, datatype=XSD.double)))
            if domain:
                pub = dataset.graph(URIRef(str(np) + "/pubinfo"))
                value = PKR["domain/" + domain] if vocabulary == PK else Literal(domain)
                pub.add((np, vocabulary.domain, value))
                if vocabulary == PK:
                    pub.add((value, RDFS.label, Literal(domain)))
        return dataset

    def query(self, name):
        return list(self.dataset().query((ROOT / "queries" / name).read_text()))

    def test_all_probknow_query_excludes_unrelated_vocab(self):
        rows = self.query("all-probknow-nanopubs.rq")
        self.assertEqual({str(row[0]).rsplit("/", 1)[-1] for row in rows},
                         {"new", "boundary", "low", "missing"})

    def test_domain_counts_fold_legacy_literal_and_current_resource(self):
        rows = self.query("claims-by-domain.rq")
        self.assertEqual({str(row[0]): int(row[1]) for row in rows},
                         {"bio": 2, "chemistry": 2})

    def test_high_confidence_boundary_and_absence(self):
        rows = self.query("high-confidence-claims.rq")
        self.assertEqual([(str(row[1]), float(row[2])) for row in rows],
                         [("new", .9), ("boundary", .8)])

    def test_all_queries_parse_and_execute_on_empty_dataset(self):
        paths = sorted((ROOT / "queries").glob("*.rq"))
        self.assertGreaterEqual(len(paths), 3)
        for path in paths:
            with self.subTest(query=path.name):
                dataset = Dataset()
                dataset.store.add_graph(dataset.default_context)
                self.assertEqual(list(dataset.query(path.read_text())), [])


if __name__ == "__main__":
    unittest.main()
