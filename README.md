# Lucky Streak — Cloudflare leaderboard

This version keeps the game itself in `index.html` and adds a Cloudflare Pages Function at:

`/api/scores`

The leaderboard is stored in Cloudflare D1, so players on different phones/computers see the same scores.

## Why the original leaderboard did not work

The original game used `window.storage`. That works in the environment where the game was being previewed, but it is not a normal browser storage API supplied by Cloudflare Pages. The published site therefore falls into the game's `catch` blocks and uses an empty history.

This version:
- provides a `localStorage` fallback so the game still works offline;
- sends completed scores to `/api/scores`;
- reads the shared leaderboard from D1;
- keeps the existing Daily / Weekly / All-time / Unlimited ranking rules;
- lets the same `run_id` be updated if a player changes their initials after finishing.

## Cloudflare setup

### 1. Replace the GitHub `index.html`

Use this folder structure in the GitHub repo:

```text
lucky-streak/
├── index.html
├── schema.sql
└── functions/
    └── api/
        └── scores.js
```

Do not put `scores.js` inside the public HTML folder. `functions/` must be at the repository root.

Your Pages settings can remain:
- Build command: none
- Build output directory: `/`

Cloudflare Pages Functions are automatically deployed from the `functions` directory.

### 2. Create a D1 database

Cloudflare dashboard:

**Workers & Pages → D1 → Create database**

Name it something like:

`lucky-streak`

Then open the D1 database's SQL console and paste/run the contents of `schema.sql`.

### 3. Bind D1 to the Pages project

Cloudflare dashboard:

**Workers & Pages → your Lucky Streak Pages project → Settings → Bindings**

Add:

- Type: **D1 database**
- Variable name: **`DB`**
- D1 database: **`lucky-streak`**

Save, then redeploy the Pages project.

The variable name must be exactly `DB`, because `functions/api/scores.js` uses `env.DB`.

### 4. Test the API

After redeployment, visit:

`https://cats.amyhackmannconsulting.com/api/scores?tab=day&start=2026-09-04&end=2026-09-07`

You should get JSON like:

```json
{"ok":true,"rows":[]}
```

An empty list is correct before anyone has submitted a score.

Then play a game, enter initials, and save. Open Scores again. The score should appear.

## Important

This is a public casual-game leaderboard, not a cheat-proof competitive ranking system. The browser sends the score to the server, so a technically savvy person could forge a request. The endpoint does basic sanity checking, but it does not replay the entire puzzle to cryptographically prove the score.

For Lucky Streak, that is probably the right trade-off: very small, free, and simple.

## Cloudflare free tier

D1 is available on Cloudflare's Workers Free plan. As of 2026, the documented free allowance is 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. A small game leaderboard should be nowhere near those limits unless it becomes very popular.
