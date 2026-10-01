# w3id.org registration for `https://w3id.org/probknow/`

The ProbKnow ontology (`pk:` = `https://w3id.org/probknow/ontology/`) and
resource namespace (`pkr:` = `https://w3id.org/probknow/resource/`) are meant to
dereference, but the redirect is not registered yet (as of 2026-10 both return
404). This folder holds the ready-to-submit redirect rules.

To register, open a pull request against
<https://github.com/perma-id/w3id.org> adding a `probknow/` directory containing
the `.htaccess` file next to this README plus a short `README.md` naming the
contact person. w3id.org requires a named person as contact for every namespace.

What the rules do:

| Request | Redirects to |
| --- | --- |
| `/probknow/ontology` or `/probknow/ontology/1.1` from a browser (`Accept: text/html`) | `ONTOLOGY.md` on GitHub |
| the same from anything else (Turtle, RDF tools) | the raw `probknow.ttl` on GitHub |
| `/probknow/ontology/<Term>` (e.g. `/ontology/Claim`) from a browser | `ONTOLOGY.md` on GitHub |
| `/probknow/ontology/<Term>` from anything else | the raw `probknow.ttl` |
| `/probknow/resource/<kind>/<id>` | `https://probknow.com/resource/<kind>/<id>` (the resolver probknow.com needs to serve) |
| anything else under `/probknow/` | this repository |

Term IRIs are slash-based and unversioned (`https://w3id.org/probknow/ontology/Claim`),
which is what lets each term redirect on its own; the ontology's version lives only in
`owl:versionIRI`. Version 1.0 used hash terms under `…/ontology/1.0#`; those IRIs reach
the same document through the version rule, and the ontology maps them to the current
terms with `owl:equivalent*` axioms.
