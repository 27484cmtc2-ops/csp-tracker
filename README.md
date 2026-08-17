# Investing Dashboard

Personal investing dashboard for tracking wheel-strategy trades, assigned shares, covered calls, completed positions, and dividend income.

## Core capabilities

- Wheel/CSP and spread tracking
- Assignment, covered-call, and share-sale workflows
- Dividend holdings, income projections, and account breakdowns
- Account-specific local persistence and Supabase synchronization
- Responsive desktop and mobile interfaces

## Local development

```sh
npm install
npm start
```

Run validation with:

```sh
npm test -- --runInBand --watchAll=false
npm run build
git diff --check
```

Environment variables required for authenticated cloud synchronization:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_PUBLISHABLE_KEY`

This is a private personal application. Portfolio data, migrations, storage keys, and synchronization payload formats must be treated as compatibility-sensitive.
