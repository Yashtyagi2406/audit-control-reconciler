# DATA_ISSUES.md

Reasoning behind every anomaly `reconcile.py` found and how it was
handled. Anomalies are grouped by where they live. Row numbers below
refer to `data/assessment_results.csv` (row 2 is the first data row,
since row 1 is the header) — that's the file `reconcile.py` actually
reads; the source spreadsheet's row numbers are one higher.

One general note: the assignment PDF describes the second input file as
`assessment_results.csv`, but the file I actually received was
`assessment_results.xlsx`. I treated this as an artifact of the email
attachment rather than an anomaly in the data itself: I exported the
xlsx to CSV, preserving every cell's raw value exactly (including the
already-messy strings and the stray integer), and pointed the script at
that CSV so it matches the spec and stays stdlib-only.

## Anomalies in `controls.json`

1. **Duplicate control id `CTRL-003`.** Two entries share this id: one
   in Access Management ("Privileged access restriction") and one in
   Change Management ("Emergency change post-review"; this is clearly
   also a copy-paste error, since the intended id was probably
   `CTRL-0XX` for a genuinely new Change Management control). I kept
   both records in `reconciled.json` — dropping either would lose real
   control metadata — but flagged the collision as a `control`-level
   exception, since a downstream system keying on `id` alone would
   silently merge or overwrite one of them.

2. **The one `CTRL-003` assessment result is ambiguous.** With two
   controls sharing that id, the single assessment row ("Admin group
   membership extract reviewed", status COMPLETE) could belong to
   either. I assigned it to the Access Management control
   ("Privileged access restriction") because the evidence text is
   specifically about admin group membership, which matches privileged
   access review far better than an emergency-change post-review. This
   is a judgment call, not a certainty, so I logged it as an exception
   with the reasoning attached, and left the Change Management
   `CTRL-003` with no status at all (`null`) rather than guessing a
   second status for it.

3. **`CTRL-008` is missing a `domain` field entirely** (every other
   control has one). I left it as `null` in the output rather than
   guessing "Incident Management" from its neighbors, and grouped it
   under "(no domain)" in the summary and "Unassigned" in the UI. I
   flagged it as an exception rather than silently inferring the
   domain, since inferring domain from a text description is exactly
   the kind of quiet assumption an auditor shouldn't make on someone
   else's behalf.

4. **`"CTRL-010 "` has trailing whitespace** in its id. I trim all
   control and assessment ids before matching (this is also what makes
   `CTRL-010`'s assessment match correctly at all), and logged the trim
   as an exception so the source system can be told to fix it upstream.

5. **`CTRL-012`'s `parent_id` points at itself** (`"parent_id":
   "CTRL-012"`). A control can't be its own parent, so I ignored the
   parent relationship for hierarchy purposes and flagged it — this
   looks like a copy-paste error where the child id was never updated.

6. **`CTRL-014`'s `parent_id` points at `CTRL-099`, which doesn't
   exist anywhere in the file.** Flagged as a dangling reference. I
   didn't try to guess the intended parent.

## Anomalies in `assessment_results.csv`

7. **`CTRL-002` has two assessment rows** with different date formats:
   `15/08/2026` (a string) and `2026-08-28` (ISO). Since `15` can't be
   a month, the first is unambiguously `15 Aug 2026` under a
   day-first (DD/MM/YYYY) convention — I assumed the whole file uses
   day-first dates whenever a date is ambiguous, since this is a
   Toronto-based firm but the assessors' names and the one explicit
   `Aug 5 2026` format both read as month-name-first, which sidesteps
   the ambiguity entirely for that row. Whichever convention is meant,
   28 Aug is later than 15 Aug either way, so the later row
   (`complete`, 0.85, "Q3 certification finalized") wins under the
   "latest assessment per control" rule. Not itself an exception — this
   is exactly the reconciliation logic the assignment asks for — but
   worth flagging that the two rows also disagree on status casing and
   on completion (0.6 vs 0.85), which is normal for a re-assessment.

8. **Status values are inconsistently cased and punctuated**:
   `Complete` / `complete` / `COMPLETE`, `In-Progress` / `in progress` /
   `In Progress`, `Not started` / `Not Started` / `not started`. I
   normalize all of these (lowercase, strip, collapse `-` to space) onto
   three canonical values: `Not Started`, `In Progress`, `Complete`.
   Any value that doesn't match one of these after normalization is
   treated as an "unrecognized status" exception rather than silently
   dropped.

9. **Row 8: `control_id` is the bare integer `5`, not `"CTRL-005"`.**
   This is very likely a data-entry error for `CTRL-005` (same numeric
   part, plausible date sequence right after `CTRL-005`'s Aug 20 row).
   I deliberately did **not** auto-correct it to `CTRL-005`: silently
   merging a malformed id into an existing control's history is a
   bigger risk than leaving it visible, since if I'm wrong about the
   intended target I'd have corrupted a real control's assessment
   trail. Instead I kept it as its own record, which — because no
   control with id `"5"` exists — surfaces as an orphan-assessment
   exception an analyst can resolve by hand. The note in the exception
   says a match to `CTRL-005` is the likely intended target.
   This choice is not free: it means `CTRL-005`'s reconciled record
   shows `Not Started` at 0% completion (from its one matched row,
   2026-08-20), when the orphaned row — if it is in fact the same
   control, one day later, from the same assessor (A. Thomas) — would
   make it `In Progress` at 30%. I judged that silently accepting that
   swap was riskier than surfacing it, but anyone relying on the
   0%-vs-30% figure for `CTRL-005` should know this exception is
   sitting behind it.

10. **Row 5: `CTRL-004`'s date is `"Aug 5 2026"`**, a third date
    format (`%b %d %Y`) alongside ISO and `DD/MM/YYYY`. Parsed
    correctly by trying multiple formats in sequence; not an exception
    once parsed, but it's the kind of format drift that will keep
    happening if assessors paste from different spreadsheet locales.

11. **Row 9 (`CTRL-006`): `assessed_on` is the raw Unix epoch integer
    `1755302400`**, not a date string at all. It decodes to
    **16 Aug 2025** — a full year before every other assessment in the
    batch, which itself is logically suspicious for a control that
    supposedly has a "Complete" backup-verification status the auditors
    are relying on today. I parse epoch-looking integers as timestamps
    (so the record isn't silently dropped) but this is exactly the kind
    of "technically valid, logically wrong" case called out below.

12. **Row 12 (`CTRL-009`): `completion` is the string `"N/A"`**, not a
    number. Flagged as a non-numeric-completion exception. In practice
    this doesn't affect the final reconciled record, because a later,
    clean assessment for `CTRL-009` (`2026-09-02`, 0.25) exists and wins
    under "latest wins" — but the bad row is still worth surfacing,
    since a dataset with fewer duplicate assessments wouldn't have had a
    clean fallback.

13. **Row 14 (`CTRL-011`): `assessed_on` is `2030-01-01`** — over three
    years in the future relative to "today" (pinned at 13 Sep 2026 for
    reproducibility). Kept as the latest (and only) assessment for that
    control, but flagged as an exception, since a future-dated
    assessment can't have actually happened yet and likely reflects a
    fat-fingered year (2030 instead of 2026, or an auto-filled
    default date).

14. **Row 18: `CTRL-021` has an assessment but no matching control** in
    `controls.json`. Flagged as an orphan assessment. No guess made
    about which real control it might have meant — `021` doesn't
    numerically resemble any existing id closely enough to assume a
    typo.

## Technically valid but logically suspicious (auditor's eye, not parser's)

- **`CTRL-007`: status is `Complete` but completion is `0.2`.** A
  control can't be both "done" and "20% of the way there" — this is
  exactly the kind of thing a parser would happily accept (both fields
  are individually well-formed) but an auditor should never sign off
  on without asking the assessor which one is wrong. Flagged as an
  exception even though nothing failed to parse.
- **`CTRL-002`'s same pattern in miniature**: the final status is
  `complete` at `0.85` completion, not `1.0`. Less severe than
  `CTRL-007` (0.85 is at least "nearly done"), but worth a second look —
  "complete" should mean 100%, not "mostly."
- **`CTRL-006`'s year-old assessment date** (see #11) being the sole
  basis for a "Complete" status today is a staleness risk: nothing in
  the data confirms the backup control is still working *now*, only
  that it was a year ago.
- **`CTRL-013`'s evidence note names three vendors** ("Alpha, Beta and
  Gamma Corp") for a single control record — fine as free text, but a
  reminder that a "% complete" figure for a vendor-assessment control
  can hide the fact that not all in-scope vendors were actually
  covered; the completion field alone can't tell you that.
- **The `CTRL-012` self-referencing parent and `CTRL-014` dangling
  parent** (see #5, #6) both point at the same underlying risk: nobody
  can currently produce a reliable control hierarchy report from this
  file, which likely means the hierarchy has never actually been
  exercised or validated by whoever maintains it.

## What would break at 10,000 controls

1. **Latest-wins-by-date is too naive at scale.** Right now "the most
   recent `assessed_on` wins" is fine for a handful of controls I can
   eyeball. At 10,000 controls, silent overwrites from bad data
   (wrong-year dates, epoch ints, timezone drift) would quietly corrupt
   the reconciled dataset with no one noticing. I'd add a confidence /
   provenance score per assessment and route anything below a threshold
   to manual review instead of auto-selecting it.
2. **In-memory dict-of-lists won't scale as a matching strategy.**
   Loading everything into Python dicts and doing linear scans for
   orphan detection is fine for 15 controls; at 10,000 controls times
   several assessments each, this needs an actual indexed store
   (even SQLite) so matching, dedup, and referential checks are O(log n)
   lookups instead of full-list scans repeated per exception check.
3. **Exceptions need triage, not just a flat list.** A 10,000-control
   run would likely produce hundreds or thousands of exceptions; a flat
   `exceptions.json` array becomes unusable. I'd add severity levels
   (structural / logical / cosmetic) and owner routing so the right
   team sees the right subset, rather than one long undifferentiated
   list an analyst has to page through.
4. **Status/date normalization rules need to be data-driven, not
   hardcoded.** The `STATUS_MAP` and date-format list in `reconcile.py`
   are hand-written for the formats seen in this one file. At scale,
   across many assessors and tools feeding in data, I'd expect new
   format variants constantly; a config file (or a small learned
   normalizer with a fallback to manual mapping) that can be updated
   without a code change would be necessary.
5. **The React UI's client-side edit model doesn't scale or persist.**
   Right now edits live only in React state and vanish on refresh. At
   10,000 controls I'd need pagination or virtualization in the list,
   a real backend to persist status/evidence changes, and an audit
   trail of who changed what and when — which, for a compliance tool
   specifically, is arguably more important than any other feature.
