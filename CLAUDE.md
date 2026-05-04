# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # tsc + vite build → dist/
npm run preview   # preview the dist/ build locally
```

No test suite exists yet. Type-check only via `tsc --noEmit`.

## Deployment

The app is deployed on Vercel. Every push to `main` triggers an automatic redeploy. Always commit and push after completing work.

## Architecture

Single-page Vite/React/TypeScript app. All persistent state lives in one Zustand store (`src/store/index.ts`) backed by `localStorage` under the key `cheddar-store-v3`. There is no backend — the Anthropic API is called directly from the browser using a user-supplied key stored in the store.

### Core data model (`src/types/index.ts`)

- **`Bill`** — a recurring expense. `dueDayOfMonth: null` means it applies every pay period (variable/spending bills). `dueMonths[]` is pre-computed for quarterly/annual frequency; empty means every month.
- **`PayPeriod`** — one paycheck cycle. `id === startDate` (YYYY-MM-DD). `openingBalance` is the real bank balance after the paycheck lands; `null` means it hasn't been set and will be projected.
- **`PeriodItem`** — a join between a period and a bill, created lazily by `ensurePeriodItems`. Tracks `paid`, `actualAmount`, and `dismissed` (hides an item from just that period).
- **`Extra`** — a one-off unplanned expense attached to a period.
- **`PeriodActuals`** — AI-analyzed statement data saved to a period for budget-vs-actual display.

### Period/bill logic (`src/lib/periods.ts`)

`billIncludedInPeriod` determines whether a bill falls within a pay period by checking its `dueDayOfMonth` against the period's date range across all calendar months the period spans. `calcForecast` computes projected remaining balance: `openingBalance − unpaid items − unpaid extras`. Opening balance is either the stored real value or projected as `prevForecast + payAmount`.

### Store patterns

- `ensurePeriodItems(periodId)` is idempotent — call it on every period card mount; it only adds items that don't exist yet.
- `ensureFuturePeriods` / `ensurePastPeriods` grow the periods array as the user navigates; called on app mount.
- `regeneratePeriods()` wipes and rebuilds all periods from the anchor date — used when pay settings change.
- Period IDs are their `startDate` string, so `periods.find(p => p.id === someDate)` is always valid.

### App layout (`src/App.tsx`)

Top-level module switcher: `budget | savings | college | retirement | bills`. Only `budget` and `bills` are implemented. The budget view renders a window of `periodsVisible` (1–5) `CurrentPeriod` cards plus up to 3 `UpcomingPeriod` cards when at the present view. Navigation shifts the window index; `periodsWindowDate: null` means "show current period."

### AI statement analysis (`src/lib/analyzeStatement.ts`)

Uses `claude-opus-4-7` with `thinking: { type: 'adaptive' }`. Takes a CSV bank statement, sends it with the user's bill list, and returns categorized transactions, budget-vs-actual summary, and suggestions. The `StatementPanel` component drives a 3-step flow: upload → loading → results.

## Tailwind

Uses Tailwind v4 via `@tailwindcss/vite`. No `tailwind.config.js` — configuration is in `src/index.css` via `@import "tailwindcss"`.
