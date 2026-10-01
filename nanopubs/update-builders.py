#!/usr/bin/env python3
"""Paste the signed templates' IRIs (signed/template-iris.json) into the TEMPLATES table of
pipeline/probknow-builders.ts. Run by sign.sh after signing; safe to re-run."""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
signed = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "signed")
iris = json.load(open(os.path.join(signed, "template-iris.json")))
p = os.path.join(here, "..", "pipeline", "probknow-builders.ts")
s = open(p).read()
mapping = {
    "Claim": "probknow-claim", "EvidenceItem": "probknow-evidence-item",
    "BayesianAssessment": "probknow-bayesian-assessment", "LLMClaimAssessment": "probknow-llm-assessment",
    "TestableHypothesis": "probknow-testable-hypothesis",
}
# only the TEMPLATES.assertion block (RESOURCE_KIND uses the same `${PK}Class` keys)
start = s.index("export const TEMPLATES = {"); end = s.index("} as Record<string, string>,", start)
block = s[start:end]; n = 0
for cls, key in mapping.items():
    block, k = re.subn(r'(\[`\$\{PK\}%s`\]: ")[^"]*(")' % cls, r'\g<1>%s\2' % iris[key]["reference"], block); n += k
s = s[:start] + block + s[end:]
s, k = re.subn(r'(  provenance: ")[^"]*(")', r'\g<1>%s\2' % iris["provenance-probknow-extraction"]["reference"], s); n += k
s, k = re.subn(r'(  pubinfoDomain: ")[^"]*(")', r'\g<1>%s\2' % iris["pubinfo-probknow-domain"]["reference"], s); n += k
assert n == 7, n
open(p, "w").write(s)
print("updated TEMPLATES in pipeline/probknow-builders.ts (7 IRIs)")
