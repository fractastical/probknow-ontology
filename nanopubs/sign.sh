#!/usr/bin/env bash
# Sign the ProbKnow Space and its governed templates with the local nanopub profile key,
# in dependency order, and derive the maintained-resource declarations that make the
# space maintain each template kind. Nothing is published.
#
#   bash nanopubs/sign.sh [OUT_DIR] [src files…]   # default: nanopubs/signed, all of src/01…08
#
# With explicit source files, only those are signed (new versions of already published
# templates, say) and no maintained-resource declarations are derived: the kinds already
# exist and stay maintained. The template-IRI table and the builders are updated either way.
#
# Requires: java, the nanopub-java jar (set JAR, default: newest nanopub-*.jar in
# ../nanopub-skill or the current dir), and ~/.nanopub/profile.yaml with the signer's ORCID.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$HERE/signed}"; shift || true
ONLY=("$@")
JAR="${JAR:-$( (ls -1 "$HERE"/../../nanopub-skill/nanopub-*-jar-with-dependencies.jar "$HERE"/../nanopub-*-jar-with-dependencies.jar 2>/dev/null || true) | sort -V | tail -1)}"
[ -f "$JAR" ] || { echo "nanopub-java jar not found; set JAR=…" >&2; exit 1; }
mkdir -p "$OUT" "$OUT/tmp"
SPACE="https://w3id.org/spaces/probknow"
# "Listing a template as a maintained resource": lists an ASSERTION template kind as maintained by a
# space and assigns the Maintained-template preset (the standard views of a template page).
LISTING_TEMPLATE="https://w3id.org/np/RA1_mJ1G8d-5riusOFBQHtR8gG6pQHIH1W_e6S7ahIRTQ/template"
TEMPLATE_PRESET="https://w3id.org/np/RAsfqb0NCvXnSsJgsx75aqbR-O_4q8uqp0YDgeX83fHIE/maintained-template-preset"
# Generic "Defining a maintained resource" (legacy chain, takes an existing IRI): for the provenance
# and pubinfo template kinds, which the listing template (fixed to nt:AssertionTemplate) cannot take.
MAINTAINED_TEMPLATE="https://w3id.org/np/RAuoIiBPtkpMCALeI5AWNlQHoXdBfqZwqj_sVHiBGbfQo"
ORCID="$(grep -m1 '^orcid_id:' ~/.nanopub/profile.yaml | sed 's/orcid_id: *//')"
NAME="$(grep -m1 '^name:' ~/.nanopub/profile.yaml | sed 's/name: *//')"

sign() {  # sign <src> <out-name>
  local src="$1" out="$OUT/$2"
  local now; now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sed "s/__NOW__/$now/" "$src" > "$OUT/tmp/$2"
  java -jar "$JAR" sign -o "$out" "$OUT/tmp/$2" >/dev/null
  grep -q "npx:signedBy" "$out" || { echo "no npx:signedBy in $out" >&2; exit 1; }
  echo "signed $2 -> $(grep -m1 '^@prefix this:' "$out" | grep -oE 'RA[A-Za-z0-9_-]{43}')"
}

if [ "${#ONLY[@]}" -gt 0 ]; then
  for f in "${ONLY[@]}"; do sign "$f" "$(basename "$f")"; done
else
  for f in "$HERE"/src/0[1-8]-*.trig; do sign "$f" "$(basename "$f")"; done
fi

# Maintained-resource declarations: one per template kind, so the space maintains the kinds.
# The declaring nanopub's pubinfo rdfs:label must be EXACTLY the resource's own name (the
# same string as <resource> rdfs:label in the assertion): Nanodash takes a maintained
# resource's display name from the declaring nanopub's label (until nanodash PR #764 ships),
# so a sentence there ("X is a template maintained by Y") becomes the resource's name.
i=9
[ "${#ONLY[@]}" -gt 0 ] && i=99   # explicit files: kinds exist already, skip
for f in "$OUT"/0[2-8]-*.trig; do
  [ "$i" -ge 99 ] && break
  np="$(grep -m1 '^@prefix this:' "$f" | grep -oE 'https://w3id.org/np/RA[A-Za-z0-9_-]{43}')"
  kindname="$(grep -oE 'npx:introduces (sub:|<[^>]*/)([A-Za-z]+Kind)' "$f" | head -1 | grep -oE '[A-Za-z]+Kind$' || true)"
  kind="$np/$kindname"
  # the nanopub's own label: the rdfs:label inside the `this:` block of pubinfo
  label="$(awk '/^  this: /{on=1} on&&/rdfs:label "/{match($0,/rdfs:label "[^"]+"/); print substr($0,RSTART+12,RLENGTH-13); exit} on&&/^$/{on=0}' "$f")"
  [ -n "$label" ] || { echo "could not derive label from $f" >&2; exit 1; }
  ttype="$(grep -oE 'nt:(Assertion|Provenance|Pubinfo)Template' "$f" | head -1 || true)"
  [ -n "$kindname" ] && [ -n "$ttype" ] || { echo "could not derive kind/type from $f" >&2; exit 1; }
  name="$(printf '%02d-maintained-%s' "$i" "$(basename "$f" .trig | sed 's/^0[0-9]-template-//')")"
  if [ "$ttype" = "nt:AssertionTemplate" ]; then
    assertion_extra="

  sub:assignment a gen:ActivatedPresetAssignment, gen:PresetAssignment ;
    gen:isAssignmentFor <$kind> ;
    gen:isAssignmentOfPreset <$TEMPLATE_PRESET> ."
    pubinfo_extra="npx:embeds sub:assignment ;
    npx:hasNanopubType gen:MaintainedResource, gen:PresetAssignment ;"
    np_label="$label"
    from_template="$LISTING_TEMPLATE"
  else
    assertion_extra=""
    pubinfo_extra="npx:hasNanopubType gen:MaintainedResource ;"
    np_label="$label"
    from_template="$MAINTAINED_TEMPLATE"
  fi
  cat > "$HERE/src/$name.trig" <<TRIG
@prefix this: <http://purl.org/nanopub/temp/np001/> .
@prefix sub: <http://purl.org/nanopub/temp/np001/> .
@prefix np: <http://www.nanopub.org/nschema#> .
@prefix npx: <http://purl.org/nanopub/x/> .
@prefix nt: <https://w3id.org/np/o/ntemplate/> .
@prefix gen: <https://w3id.org/kpxl/gen/terms/> .
@prefix dct: <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

sub:Head {
  this: a np:Nanopublication ;
    np:hasAssertion sub:assertion ;
    np:hasProvenance sub:provenance ;
    np:hasPublicationInfo sub:pubinfo .
}

sub:assertion {
  <$kind> a gen:MaintainedResource, $ttype ;
    rdfs:label "$label" ;
    dct:description "The ProbKnow template '$label' (all its versions), maintained by the ProbKnow space so that its members can publish the next version." ;
    gen:isMaintainedBy <$SPACE> .$assertion_extra
}

sub:provenance {
  sub:assertion prov:wasAttributedTo <$ORCID> .
}

sub:pubinfo {
  <$ORCID> foaf:name "$NAME" .

  this: dct:created "__NOW__"^^xsd:dateTime ;
    dct:creator <$ORCID> ;
    dct:license <https://creativecommons.org/licenses/by/4.0/> ;
    rdfs:label "$np_label" ;
    $pubinfo_extra
    npx:introduces <$kind> ;
    nt:wasCreatedFromProvenanceTemplate <https://w3id.org/np/RA7lSq6MuK_TIC6JMSHvLtee3lpLoZDOqLJCLXevnrPoU> ;
    nt:wasCreatedFromPubinfoTemplate <https://w3id.org/np/RAukAcWHRDlkqxk7H2XNSegc1WnHI569INvNr-xdptDGI>, <https://w3id.org/np/RACJ58Gvyn91LqCKIO9zu1eijDQIeEff28iyDrJgjSJF8> ;
    nt:wasCreatedFromTemplate <$from_template> .
}
TRIG
  sign "$HERE/src/$name.trig" "$name.trig"
  i=$((i+1))
done

echo
echo "Checking all signed nanopubs:"
java -jar "$JAR" check "$OUT"/*.trig 2>&1 | tail -1
echo "Publish order: $(ls "$OUT"/*.trig | xargs -n1 basename | tr '\n' ' ')"

# The template IRIs the pipeline must reference (assertion templates by their embedded
# identity <np>/template, provenance/pubinfo templates by nanopub URI).
HERE="$HERE" python3 - "$OUT" <<'PY'
import sys, re, json, glob, os
out = sys.argv[1]; iris = {}
for f in sorted(glob.glob(os.path.join(out, "0[1-8]-*.trig"))):
    t = open(f).read()
    np = re.search(r"@prefix this: <([^>]+)>", t).group(1)
    key = re.sub(r"^0\d-(template-)?", "", os.path.basename(f)[:-5])
    emb = "/template" if re.search(r"npx:embeds sub:template", t) else ""
    iris[key] = {"nanopub": np, "reference": np + emb}
json.dump(iris, open(os.path.join(out, "template-iris.json"), "w"), indent=2)
import subprocess; subprocess.run([sys.executable, os.path.join(os.environ["HERE"], "update-builders.py"), out], check=True)
print("\nTemplate IRIs (also in template-iris.json):")
for k, v in iris.items(): print(f"  {k:40s} {v['reference']}")
PY
