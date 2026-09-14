# Parent Pressure — Project Context & Progress

> This file is auto-loaded by Claude Code at the start of every session in this repo. Read it before making changes — it captures where the project stands, decisions made, and what's next.
>
> **Instruction to Claude Code:** at the end of each working session, update this file with what was done, any new decisions, and the next steps — so the next session starts with accurate context.

## Concept
AI-powered fitness and nutrition "one stop shop" app. Core features:
- Progressive overload-based workout programming
- Meal tracking with dietary restriction customization
- Macronutrient customization
- AI-powered personalization for workouts and meal plans

## Target Market
- Busy parents, ages 30–50 (broadened from original "busy dads" focus)
- Positioning: simple, results-focused — NOT a "fitness bro" or Instagram-aesthetic app
- Primary value prop: easy-to-follow, all-in-one plan for exercise + nutrition

## Brand
- Name: **Parent Pressure** (renamed from "Father Figure" — trademark conflict)
- Confirmed via manual USPTO TESS search: name appears unused/unclaimed
- Domain: parentpressure.com (purchased)
- Instagram & YouTube: @parentpressure
- TikTok: @parent.pressure (exact match was taken)

## Platform Strategy
- **Android first** (Kotlin + Jetpack Compose) — user is Android-native
- iOS port planned for month 4–5, after Android validation, beta tested with friends

## Business Model (MVP)
**Free tier:**
- Stock workout programs (upper/lower splits, 3x/week)
- Basic nutrition tracking
- Progress tracking
- Sync with Apple Health / Google Fit

**Paid tier ($9.99/mo or $79.99/yr):**
- AI-customized workout progression
- Meal plan customization
- AI nutritional insights
- Advanced analytics

## Tech Stack
- **Backend:** Node.js/Express, PostgreSQL, JWT auth, bcrypt password hashing
- **Frontend:** Android — Kotlin + Jetpack Compose
- **Database:** Supabase (PostgreSQL) — or fallback to Railway/Render/Neon
- **Deployment options:** Railway, Render, or Supabase (all have free tiers)

## Repos
- **Backend:** this repo — `parent-pressure-backend` (github.com/ckline209-cyber/parent-pressure-backend), local path `C:\Users\cklin\OneDrive\Documents\GitHub\parent-pressure-backend`
- **Android:** `parent-pressure-android` (github.com/ckline209-cyber/parent-pressure-android), local path `C:\Users\cklin\OneDrive\Documents\GitHub\parent-pressure-android` — sibling folder to this repo

## Status as of last session (Sep 14, 2026)
Backend is now **actually working end-to-end**, not just scaffolded — a lot of what the previous status section claimed as "complete" turned out to be stubs (see below). This session:

- ✅ **Resolved the Supabase ETIMEDOUT issue** — it was transient; connection now works reliably.
- ✅ Ran `src/db/setup.js` — all 10 tables created and verified in Supabase (`users`, `workouts`, `exercises`, `user_workouts`, `exercise_logs`, `meals`, `foods`, `daily_nutrition_targets`, `progress_snapshots`, `subscription_events`).
- ✅ **The sample data seeder didn't actually exist** despite prior notes claiming it was done. Wrote `src/db/seed.js` for real, ran it: seeds 2 stock workouts (Upper Body Strength, Lower Body Strength, both 3x/week) with 12 exercises total. Script is idempotent — skips seeding if stock workouts already exist.
- ✅ **Repo cleanup:** added a proper `.gitignore`; `node_modules` (was committed — 1300+ files) and `.env` are now untracked (still present locally, just not in git); removed stray junk files (`cls`, `dir`, a zip, a file literally named `{`) that came from misfired shell commands.
- ⚠️→✅ **Found that `.env` (with the real Supabase DB password) had been committed and pushed to GitHub** in the initial commit, before `.gitignore` existed. Decided to rotate credentials rather than rewrite git history: generated a new Supabase DB password and a new `JWT_SECRET`, updated `.env` locally, verified the new connection works. The leaked old values are now dead.
- ✅ **Found the entire auth system was stubbed, not implemented** — `hashPassword`/`comparePassword` did no hashing (plaintext), `createAccessToken`/`verifyAccessToken` returned fake placeholder values without using the `jsonwebtoken` package, `authenticate` middleware accepted any non-empty header, `/auth/login` ignored the request body and always returned the same fake token, and there was no `/auth/register` endpoint at all. Implemented real versions of all of these: bcrypt password hashing, real signed/verified JWTs, a working `/auth/register`, `/auth/login` that checks the DB, `authenticate` that actually verifies tokens, `requirePremium` that checks subscription tier, and `/user/profile` returning real user data. Manually tested register, duplicate-email rejection (409), login, wrong-password rejection (401), and profile access with/without/invalid tokens — all behave correctly.
- ✅ **Started the Android app** in a new sibling repo, `parent-pressure-android` (Kotlin + Jetpack Compose, pushed to GitHub). Scaffolded: Gradle project (AGP 8.5.2, Kotlin 1.9.24, Compose BOM 2024.06.00), package `com.parentpressure.app`. Login/Register screens wired via Retrofit to the backend's real `/auth/login` and `/auth/register`, an `AuthViewModel` for request state and backend error messages, JWT persisted via `EncryptedSharedPreferences`, and a `HomeScreen` shown after successful auth with logout. Base URL is `10.0.2.2:3000` (the emulator's alias for the host machine's `localhost`), so the backend needs to be running locally (`npm run dev`) for the app to work against it.
- ⚠️ **The Android app has not been built or run yet.** No JDK/Gradle on `PATH` in the dev environment used to scaffold it, and the Gradle wrapper jar wasn't generated — opening the project in Android Studio (already installed) and letting it sync is the next step, and the actual first real test.

### Other routes are still stubs (not yet touched)
`workouts.js`, `nutrition.js`, and `subscription.js` all still return hardcoded placeholder data (e.g. `GET /workouts` returns `{workouts: []}` regardless of the seeded data). Only `auth.js` and `user.js` (profile) were made real this session. Worth keeping in mind: prior "complete" claims in this file have twice turned out to be stubs on inspection, so verify before trusting old status notes on these too.

## Next Steps (in order)
1. Open `parent-pressure-android` in Android Studio, let it sync (generates the Gradle wrapper), and actually build/run it on an emulator with the backend running locally — try registering and logging in for real and see what breaks.
2. Wire up `GET /workouts` to return the real seeded stock workouts instead of a hardcoded empty array (currently a stub), then build the Android screen that displays them.
3. Implement real `nutrition.js` and `subscription.js` routes when their features are needed.

## Known Constraints
- Limited starting capital — overhead budgeted around $200 (developer accounts + hosting)
- Development happens on a single computer; Android Studio required for app builds
- Revenue is subscription-based — needs a user base before meaningful income
- Realistic build timeline: 2–3 months to MVP, 4–8 months to meaningful recurring revenue
