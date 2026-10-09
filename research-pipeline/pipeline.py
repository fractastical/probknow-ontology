"""Portable extraction of Delphi's starter-source discovery and ingestion scripts.

Discovery is read-only. Publishing requires explicit approval and --publish.
Python 3.10+, standard library only. No direct database or model access.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

CATALOGUE = Path(__file__).with_name("questions.json")


def clean(text):
    return html.unescape(re.sub("<[^>]+>", "", text or "")).strip()


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def request(url, payload=None):
    req = urllib.request.Request(
        url, data=None if payload is None else json.dumps(payload).encode(),
        headers={"User-Agent": "ProjectDelphiResearch/1.0 (source-metadata-review)",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def discover(topic):
    provider = topic.get("provider", "pmc")
    if provider == "pmc":
        url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(
            {"query": topic["query"], "format": "json", "resultType": "core", "pageSize": 6})
        rows = request(url)["resultList"]["result"]
        papers = [{
            "title": clean(r.get("title")), "doi": r.get("doi"),
            "abstract": clean(r.get("abstractText")),
            "authors": [a["fullName"] for a in r.get("authorList", {}).get("author", [])
                        if a.get("fullName")],
            "year": r.get("pubYear"),
            "journal": r.get("journalInfo", {}).get("journal", {}).get("title"),
            "sourceUrl": f"https://europepmc.org/article/{r['source']}/{r['id']}",
        } for r in rows]
    elif provider == "crossref":
        url = "https://api.crossref.org/works?" + urllib.parse.urlencode(
            {"query.title": topic["query"], "filter": "has-abstract:true,type:journal-article", "rows": 5})
        rows = request(url)["message"]["items"]
        papers = [{
            "title": clean((r.get("title") or [""])[0]), "doi": r.get("DOI"),
            "abstract": clean(r.get("abstract")),
            "authors": [" ".join([a.get("given", ""), a.get("family", "")]).strip()
                        for a in r.get("author", [])],
            "year": str((r.get("published", {}).get("date-parts") or [[None]])[0][0]),
            "journal": (r.get("container-title") or [""])[0], "sourceUrl": r.get("URL"),
        } for r in rows]
    else:
        raise ValueError("Unknown discovery provider")
    return [{
        **p, "topic": topic["id"], "question": topic["question"],
        "metadataSource": url, "abstractSha256": digest(p["abstract"]),
        "approved": False,
    } for p in papers if p["doi"] and len(p["abstract"]) >= 150]


def normalize_doi(value):
    return re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", value.strip(),
                  flags=re.I).lower()


def validate(paper):
    if paper.get("approved") is not True:
        raise ValueError("Every input record must have approved: true after source review")
    if paper.get("isPrivate"):
        raise ValueError("Private records cannot be published by this public-source pipeline")
    for key in ("title", "doi", "abstract", "question", "topic", "sourceUrl", "metadataSource"):
        if not isinstance(paper.get(key), str) or not paper[key].strip():
            raise ValueError(f"Missing {key}")
    if len(paper["abstract"]) < 150 or digest(paper["abstract"]) != paper.get("abstractSha256"):
        raise ValueError("Missing, short, or modified source abstract")
    if not re.fullmatch(r"10\.\d{4,9}/\S+", normalize_doi(paper["doi"])):
        raise ValueError("Invalid DOI")
    for key in ("sourceUrl", "metadataSource"):
        parsed = urllib.parse.urlsplit(paper[key])
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("Source URLs must be public HTTPS URLs without credentials")


def payload(paper):
    validate(paper)
    return {
        **{k: paper.get(k) for k in ("title", "abstract", "authors", "year", "journal")},
        "doi": normalize_doi(paper["doi"]), "domain": "everyday-science", "isPrivate": False,
        "provenance": {
            "collection": "oracle-starter-questions", "question": paper["question"],
            "sourceUrl": paper["sourceUrl"], "metadataSource": paper["metadataSource"],
            "abstractSha256": paper["abstractSha256"],
            "abstractSource": paper.get("abstractSource", paper["metadataSource"]),
            "sourceType": paper.get("sourceType", "journal-article"),
            "abstractKind": "source_abstract_markup_removed",
            "reviewScope": "editorial relevance selection; not a systematic review",
        },
    }


def publish(papers, base, manifest_path):
    parsed = urllib.parse.urlsplit(base)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment or parsed.username or parsed.password):
        raise ValueError("--base-url must be an HTTPS origin without credentials")
    base = base.rstrip("/")
    # Validate the whole batch before the first write.
    bodies = [payload(p) for p in papers]
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for paper, body in zip(papers, bodies):
        key = base + "|" + body["doi"]
        if key in manifest:
            continue
        matches = request(base + "/api/papers?search=" + urllib.parse.quote(body["title"]))
        if not isinstance(matches, list):
            raise ValueError("Unexpected paper search response")
        same = [p for p in matches if normalize_doi(p.get("doi") or "") == body["doi"]]
        if any(p.get("isPrivate") is not False for p in same):
            raise ValueError("Refusing to reuse a private or visibility-unknown record")
        if same:
            record = same[0]
            status = "existing"
        else:
            record = request(base + "/api/papers", body)
            status = "created"
        if not isinstance(record.get("id"), str):
            raise ValueError("Ingestion did not return a paper ID")
        manifest[key] = {"paperId": record["id"], "status": status,
                         "question": paper["question"], "abstractSha256": paper["abstractSha256"]}
        temporary = manifest_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(manifest, indent=2))
        temporary.replace(manifest_path)
        print(status, paper["topic"], body["doi"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    discovery = commands.add_parser("discover")
    discovery.add_argument("--topic", required=True)
    discovery.add_argument("--output", type=Path, required=True)
    ingestion = commands.add_parser("ingest")
    ingestion.add_argument("--input", type=Path, required=True)
    ingestion.add_argument("--base-url")
    ingestion.add_argument("--manifest", type=Path, default=Path("ingestion.json"))
    ingestion.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    if args.command == "discover":
        topics = json.loads(CATALOGUE.read_text())
        topic = next((t for t in topics if t["id"] == args.topic), None)
        if topic is None:
            parser.error("Unknown topic; see questions.json")
        candidates = discover(topic)
        args.output.write_text(json.dumps(candidates, indent=2))
        print(f"Saved {len(candidates)} unreviewed candidates; nothing published.")
    else:
        papers = json.loads(args.input.read_text())
        if not isinstance(papers, list) or not papers:
            parser.error("Input must be a nonempty JSON array")
        for paper in papers:
            payload(paper)
        if not args.publish:
            print(f"Validated {len(papers)} approved records. Dry run; nothing published.")
        elif not args.base_url:
            parser.error("--publish requires --base-url")
        else:
            publish(papers, args.base_url, args.manifest)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Remote service returned HTTP {error.code}; no automatic retry.")
