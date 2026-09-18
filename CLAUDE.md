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

## Status as of last session (Sep 17–19, 2026)
Hardware was upgraded (or the dev environment moved) since the prior session — this machine has **~5.83GB RAM** (still under Android Studio's stated 8GB minimum, but enough to actually work, unlike the prior ~3.7GB machine). Android Studio opened, synced, and ran an emulator successfully this session. All three previously-stubbed feature routes plus exercise logging are now real and fully wired end-to-end (backend + Android), tested live on an emulator, committed, and pushed:

- ✅ **Exercise logging** (the item that was top of Next Steps): `GET /workouts/started/:id` (a started workout's exercises plus any logs so far), `POST /workouts/logs` (sets/reps-per-set/weight/RPE against an exercise, validating the requester owns the `user_workout` and the exercise exists), `PATCH /workouts/started/:id/complete`. Android's workouts screen now navigates to a new "Log Exercises" screen once a workout is started (tracked via a `workoutId -> userWorkoutId` map in `WorkoutsViewModel`), which lists each exercise with a reps/weight/RPE form and a "Complete Workout" button. Verified live end-to-end: started a workout, logged a real set on Barbell Back Squat, confirmed the row in `exercise_logs`, tapped Complete, confirmed `completed_date` set in `user_workouts`.

- ✅ **`GET /workouts`** now returns the real seeded stock workouts with nested exercises (was a hardcoded `{workouts: []}` stub). Added **`POST /workouts/:id/start`**, which inserts a `user_workouts` row to assign/start a workout for the logged-in user.
- ✅ **Android workouts screen** (`workouts/WorkoutsScreen.kt`, `WorkoutsViewModel.kt`): lists workouts with exercises, "Start Workout" button per card with loading/started state. Verified live: tapped Start on both stock workouts, confirmed real `user_workouts` rows landed in Postgres.
- ✅ **`nutrition.js`** implemented for real: `GET /nutrition/daily/:date` (meals + nested foods + computed totals), `POST /nutrition/meals` (transactional, computes totals server-side from per-serving values rather than trusting the client), `DELETE /nutrition/meals/:id` (owner-scoped).
- ✅ **Android nutrition screen** (`nutrition/`): daily totals card, meal list, FAB → "Log Food" dialog (single food per meal, meal-type chips), delete per meal. Verified live end-to-end including DB cascade cleanup on delete.
- ✅ **`subscription.js`** implemented for real: `GET /subscription/status`, `POST /subscription/upgrade` (`plan`: `monthly`/`yearly`, price and expiry computed server-side, logs a `subscription_events` row), `POST /subscription/cancel`. **No real Google Play Billing/receipt verification yet** — `google_play_order_id` is stored as given; this needs real Play Billing integration before launch.
- ✅ **Fixed a correctness bug found while wiring subscriptions:** `requirePremium` middleware was checking the `tier` claim baked into the JWT at login, which goes stale the moment a user upgrades/cancels without getting a new token. It now queries live `users.subscription_tier/active/end_date` (and correctly rejects an expired-but-not-yet-downgraded premium sub). Not wired to any route yet (nothing premium-gated exists yet), but ready.
- ✅ **Android subscription screen** (`subscription/`): Free/Premium status card, monthly/yearly upgrade buttons or Cancel button depending on state. Verified live: free → upgrade → premium/active → cancel → free again, each step confirmed against the actual API response.

### Build/tooling notes from this session (useful if hitting Android build issues again)
- No `gradlew`/`gradlew.bat` wrapper exists in the repo yet (Android Studio hasn't generated one, or it isn't committed). To build from the command line, the cached Gradle 8.7 distribution under `~/.gradle/wrapper/dists/gradle-8.7-bin/.../gradle-8.7/bin/gradle.bat` was invoked directly with `installDebug`.
- **JAVA_HOME matters:** Android Studio's own bundled JBR is JDK 25, which Gradle 8.7 does **not** support (fails with a bare `25.0.3` error, no useful message). Used the older bundled JBR 21 instead: `C:\Users\<user>\.jdks\jbr-21.0.11`. Set `JAVA_HOME` to that before invoking `gradle.bat`.
- Two Android Studio installs exist under `C:\Program Files\Android\` — `Android Studio` (incomplete/broken, missing most of `lib/`) and `Android Studio1` (the real, complete install). Use the latter.
- `adb`'s default path-mangling in Git Bash breaks `/sdcard/...` paths (rewrites them as Windows paths). Use a doubled leading slash, e.g. `adb shell uiautomator dump //sdcard/window_dump.xml`, to avoid it.
- `git push` hangs indefinitely when run from Claude Code's non-interactive shell — Git Credential Manager tries to prompt but nothing renders. Workaround each time: run `git push` manually from a real terminal window instead.

## Hardware Notes
- This machine has ~5.83GB RAM — under Google's stated 8GB minimum for Android Studio, but it built and ran an emulator successfully this session (unlike the prior ~3.7GB machine, which needed heavy JVM tuning and still eventually got blocked). No custom `studio64.exe.vmoptions` override was needed this time.
- `gradle.properties` was already tuned for low RAM from the prior machine (`daemon=false`, `parallel=false`, `workers.max=1`, low `-Xmx`) — this was reverted this session now that there's more headroom: `org.gradle.jvmargs=-Xmx2048m`, daemon/parallel back to defaults.
- `build.gradle.kts` now redirects the Gradle build output directory to `C:\GradleBuilds\parent-pressure-android` instead of inside the OneDrive-synced project folder, avoiding OneDrive file-lock contention during builds.
- **`.env` is NOT in git, by design** — it only exists locally under `OneDrive\Documents\GitHub\parent-pressure-backend\.env`, mirrored via OneDrive sync. If moving machines again: confirm OneDrive shows "up to date," and/or save `DATABASE_URL`/`JWT_SECRET` somewhere separate as a cheap safety net.

## Next Steps (in order)
1. **Progressive overload logic**, now that exercise logging exists. Plan discussed: a deterministic rule-based progression algorithm first (free tier, e.g. "add weight when last session hit target reps at RPE ≤8"), with an LLM layered on top later for personalization/explanation (paid tier), not an LLM doing the arithmetic itself. Will need to read from `exercise_logs` history per user+exercise.
2. Real Google Play Billing integration for `subscription.js` (receipt/purchase token verification) before this is production-ready — current `upgrade`/`cancel` endpoints are real DB writes but don't verify any actual payment.
3. Minor UI polish noticed but not fixed: the "Snack" meal-type chip in the nutrition Log Food dialog is cut off/needs scrolling (4 `FilterChip`s don't fit the dialog width).
4. `daily_nutrition_targets` table exists but has no endpoints yet — not needed until diet customization/AI meal planning is built.
5. The exercise logging UI logs one set at a time per exercise with no way to edit/delete a mis-entered log — fine for MVP data collection, but worth a delete endpoint/button if wrong entries become a real annoyance.

## Known Constraints
- Limited starting capital — overhead budgeted around $200 (developer accounts + hosting)
- Development happens on a single computer; Android Studio required for app builds
- Current dev machine has ~5.83GB RAM — under Android Studio's stated 8GB minimum, workable but not ideal
- Revenue is subscription-based — needs a user base before meaningful income
- Realistic build timeline: 2–3 months to MVP, 4–8 months to meaningful recurring revenue
