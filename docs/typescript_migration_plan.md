# TypeScript Migration Plan (deferred)

Status: **NOT started**. Recommended as a dedicated session, not bundled with feature work.

## Why defer

The codebase is ~3,000 LOC of `App.jsx` plus ~800 LOC of helpers. Migrating to TypeScript means:

1. Adding `tsconfig.json` + Vite TS handling.
2. Renaming `*.jsx` / `*.js` → `*.tsx` / `*.ts` (≥10 files).
3. Adding types for: every Supabase row (8 tables), every Gemini helper (parsed JSON shapes from `synthesizeDecisionMemo`, `suggestMeetingDesign`, `suggestTopicFromNews`, `generateBriefing`, `summarizeProgress`), `roundConfig`, `extractConfidence`, message/session/project shapes, i18n key types, persona files etc.
4. Resolving every `any` that surfaces (probably ~50 spots).
5. Fixing whatever compile errors fall out of strict-null-checks (probably 20+ since the existing JS is loose with `?.` chains).

Realistic effort: 4–6 hours of focused work. Mixing this into a feature bundle risks pollution and long debug cycles.

## Recommended approach when ready

1. **Phase A — infra only** (safe, ~30 min):
   - Add `tsconfig.json` with `"allowJs": true`, `"checkJs": false`, `"strict": true`, `"noEmit": true`.
   - Install `@types/node`, ensure `@types/react` already in.
   - Add `npm run typecheck` script: `tsc --noEmit`.
   - Verify the build still works unchanged.

2. **Phase B — leaf modules first** (~1.5 hr):
   - `src/lib/roundConfig.js` → `.ts`. Add return type `{ type: RoundType; agents: AgentId[] }`.
   - `src/lib/gemini.js` → `.ts`. Extract types: `RoundType`, `Confidence`, `Briefing`, `MeetingDesign`, `NewsTopic`, `LiveSummary`. These are the shapes the prompts promise to return.
   - `src/lib/agents_manager.js` → `.ts`. Type `Persona`.
   - `src/lib/SessionPDF.jsx` → `.tsx`. Props types from labels object.

3. **Phase C — components** (~1 hr):
   - `src/components/AuthBar.jsx`, `LanguageToggle.jsx` → `.tsx`. Small, isolated.

4. **Phase D — App.jsx** (~2 hr):
   - The big one. Best done in passes:
     - Pass 1: rename to `.tsx`, add `// @ts-nocheck` to the top, fix only the things that break.
     - Pass 2: remove `@ts-nocheck`, fix one sub-section at a time (state declarations → effects → handlers → JSX).
     - Pass 3: tighten `any` and add discriminated unions where round flow / gate state branches.

## What this would buy us

- Catches the `setBriefingMode` / unused-import / shape-mismatch class of bugs (already caught one in extractConfidence via vitest, more will surface).
- Refactor safety for the planned architecture changes (multi-tier agent org, autonomous execution).
- Better IDE autocomplete around the JSON shapes returned by Gemini.

## What it does NOT buy us

- Runtime safety (Gemini still returns whatever JSON it likes — types only verify our assumption).
- Performance.
