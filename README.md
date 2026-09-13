# ARCAIS Control Assessment Reconciliation

Submission for the ARCAIS full-stack development intern assignment.

## Contents

- `reconcile.py` — Part A. Standard-library-only Python script that
  reconciles `data/controls.json` against `data/assessment_results.csv`.
- `data/controls.json` — the master control list, as provided.
- `data/assessment_results.csv` — the assessment results, exported from
  the `assessment_results.xlsx` I actually received (see
  `DATA_ISSUES.md` for why the file arrived as xlsx instead of csv).
  Every cell's raw value was preserved exactly during that export,
  messy formatting included.
- `reconciled.json` / `exceptions.json` — outputs of `reconcile.py`,
  committed here so the review UI has something to load out of the box.
- `review-ui/` — Part B. A small React (Vite) app for browsing and
  editing the reconciled data.
- `DATA_ISSUES.md` — Part C. Every anomaly found, how it was handled,
  what was assumed, and a scale section.
- `TIME_LOG.md` — Part D. Honest hours log.

## Running Part A (reconciliation script)

Requires Python 3.9+, no third-party packages.

```bash
python3 reconcile.py
```

This reads from `data/` and writes `reconciled.json` and
`exceptions.json` to the repo root, printing a per-domain summary to
the console.

## Running Part B (review UI)

```bash
cd review-ui
npm install
npm run dev
```

Open the printed local URL. The app reads `review-ui/public/reconciled.json`
and `review-ui/public/exceptions.json`. If you re-run `reconcile.py`,
copy the two new output files into `review-ui/public/` and refresh:

```bash
cp reconciled.json exceptions.json review-ui/public/
```

## Notes

- The reconciliation logic (status/date/completion normalization, the
  duplicate-`CTRL-003`-id handling, orphan-assessment detection) is all
  in `reconcile.py` and documented inline; the reasoning behind each
  decision is in `DATA_ISSUES.md`.
- The UI never crashes on missing or malformed fields — controls with no
  domain show under "Unassigned", unknown statuses render as a distinct
  "Unknown" badge rather than throwing.
