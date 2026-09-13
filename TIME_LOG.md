# TIME_LOG.md

Rough, honest log of hours spent, by part. Times are approximate —
I didn't stopwatch every minute, but this reflects the real split.

| Part | Activity | Hours |
|---|---|---|
| Setup | Reading the assignment PDF, opening `controls.json` and `assessment_results.xlsx`, spotting the csv-vs-xlsx mismatch, eyeballing the data for anomalies before writing any code | 0.75 |
| Part A | Writing `reconcile.py` (loading, normalization functions for status/date/completion, the CTRL-003 duplicate-id handling, exception collection), running it, fixing a double-counted exception bug | 1.75 |
| Part B | Scaffolding the Vite/React app, building the domain-grouped list with search, the status/evidence edit UI, the Exceptions tab, and the CSS pass | 1.75 |
| Part C | Writing `DATA_ISSUES.md` — cross-checking every anomaly against the actual output before describing it, plus the "logically suspicious" and "at 10,000 controls" sections | 1.0 |
| Part D | README, this time log, git commits along the way, final pass over everything | 0.5 |
| **Total** | | **~5.75** |

Note: I used an AI assistant (Claude) throughout, as the assignment
invited — for scaffolding the React app quickly and for a first pass at
spotting anomalies in the raw data, which I then verified by hand
against the actual files before writing them into `DATA_ISSUES.md`.
