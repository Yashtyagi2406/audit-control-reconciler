# Control Review UI

A small React (Vite) app for reviewing reconciled control assessments.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL. The app fetches `public/reconciled.json`
and `public/exceptions.json` on load — after re-running `reconcile.py` at
the repo root, copy the two output files into `review-ui/public/` and
refresh.

## What it does

- Groups controls by domain in the main panel, with a domain-level
  completion bar in the sidebar and an overall completion figure in the
  header.
- A search box filters by control id, name, domain, or owner.
- Click a control to expand it, change its status (Not Started / In
  Progress / Complete), or edit its evidence note. Edits are kept in
  React state for the session — there's no backend to persist them.
- An Exceptions tab lists every record `reconcile.py` couldn't cleanly
  match, with its reason.
- Missing/null fields (no domain, no evidence, unrecognized status) are
  rendered as explicit placeholders rather than crashing the app.
