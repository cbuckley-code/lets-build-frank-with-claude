#!/usr/bin/env python3
"""Check the STUDENT-FACING surface against instructor/DECISIONS.md.

    python3 instructor/check-consistency.py [extra files...]

WHY THIS EXISTS, AND WHY IT IS DELIBERATELY NARROW
--------------------------------------------------
Every factual error in this course came from correcting one copy of a fact and
not the others. Seat cards survived a purge of seat cards. `az login` survived a
purge of Azure prerequisites. The warm-up server survived being deleted. Each
time the method was "grep for the old wording" - which finds the old wording and
never finds the old assumption.

So this checks for the dead THING, not the old phrasing.

It checks only what a STUDENT reads:

    README.md                        the first thing they open
    .github/workflows/*.yml          but only echo/error strings - the text
                                     they see when a deploy fails
    anything passed as an argument   e.g. the deck's SLIDES-SPEC.md

It does NOT check the ADRs or the instructor docs. A superseded ADR describing
the world it decided for is doing its job, and the runbook has to tell an
instructor what changed. Scoping this to the student surface is what keeps it at
zero false positives - and a checker that cries wolf gets ignored, which is
worse than no checker.

Run it before any PR that touches student-facing text.
"""
import sys, re, pathlib

DEAD = [
 ("D-03", r"hello.?frank|warm.?up server|must not fail|that is the floor",
  "No warm-up server. Connectors are the morning's own content, not a floor."),
 ("D-08", r"seat.card|setup-seat|provision-class|handout\.sh|scripts/",
  "No seat cards, no scripts/ directory. One command on screen, from a URL."),
 ("D-08", r"\baz login\b|Azure CLI",              "Students never run az login and need no Azure CLI."),
 ("D-08", r"[Aa]nthropic API key|ANTHROPIC_API_KEY", "Students need no Anthropic API key."),
 ("D-09", r"managed identit|[Rr]eader grant|[Rr]eader role",
  "No managed identity, no Reader grant. Frank uses the pipeline's credential."),
 ("D-10", r"Static Web App|SWA_NAME|AZURE_STATIC_WEB_APPS",
  "One container serves /, /mcp and /healthz."),
 ("D-08", r"(paste|puts?)[^.\n]{0,24}credential[^.\n]{0,16}(on|from)[^.\n]{0,6}screen",
  "The COMMAND goes on screen, never the key."),
 ("D-11", r"credential is secret|keeps? (it|the credential) secret|makes? it safe",
  "The credential is public. The command reduces accidental display, not authority."),
 ("D-06", r"ADR-008 and ADR-009|[Dd]raft ADR-008",
  "The class writes ADR-009 only. ADR-008 is an unscheduled stretch."),
]
NEG = re.compile(r"\b(no|nobody|none|not|never|without|remove[sd]?|deleted|gone|"
                 r"eliminat\w*|superseded|no longer|instead of|there is no|dead|"
                 r"used to|previously|deliberately NOT)\b[^.!?\n]{0,150}$", re.I)
# in a workflow, only the strings a student actually sees
MSG = re.compile(r"(?:echo|::error::|::notice::|::warning::)[^\n]*")

def chunks(f):
    """(text_to_scan, line_offset_fn) - workflows contribute only their messages."""
    text = f.read_text(errors="ignore")
    if f.suffix in {".yml", ".yaml"}:
        for m in MSG.finditer(text):
            yield m.group(0), text[:m.start()].count("\n") + 1
    else:
        yield text, 0

def main(argv):
    targets = [pathlib.Path(p).expanduser() for p in argv[1:]] or \
              [pathlib.Path("README.md")] + sorted(pathlib.Path(".github/workflows").glob("*.yml"))
    bad = 0
    for f in targets:
        if not f.is_file():
            print(f"  ?? {f} not found"); continue
        for text, base in chunks(f):
            for dec, pat, fix in DEAD:
                for m in re.finditer(pat, text):
                    lead = " ".join(text[max(0, m.start() - 200):m.start()].split())
                    if NEG.search(lead):
                        continue
                    line = base + (text[:m.start()].count("\n") if base else
                                   text[:m.start()].count("\n") + 1)
                    print(f"  {f}:{line}  [{dec}] {m.group(0)!r}\n        -> {fix}")
                    bad += 1
    print(f"\n{len(targets)} student-facing file(s) checked - " +
          ("CONSISTENT" if not bad else f"{bad} contradiction(s) of DECISIONS.md"))
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
