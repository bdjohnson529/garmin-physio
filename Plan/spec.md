# Physio tracker: build spec for Claude Code

Oct 20, 2026 · @Benjamin Johnson

## Overview

Build a mobile-first web app (a PWA) that lays one athlete's Garmin activities next to their body notes, so they and their physiotherapist can see how training and recovery connect. The app never records workouts itself. Activities come only from Garmin files, and the only things the owner types are notes.

Who uses it:

- Owner: one person. They sign in, import a Garmin CSV, add notes, and share a read-only link.
- Physio or trainer: opens that link on a phone or tablet. No account, no editing.

MVP scope:

1. Import a Garmin activities CSV.
2. Activities screen: the week as a list of days, newest first.
3. Timeline screen: one row per sport across the week, with a filter for which sports show.
4. Notes on activities, with an optional body part.
5. Body screen: history by body part, with what came before and after each note.
6. Share screen: create and revoke a read-only link.

Done when:

- The owner uploads their real Garmin file (126 rows, April to October 2026) and sees every activity on the right day.
- A physio opens the link on a tablet, with no login, and sees Activities, Timeline and Body with no edit controls.
- Revoking the link stops access straight away.

## Stack and constraints

Use Next.js and TypeScript on Vercel, with Supabase for the database and sign-in, and keep every server secret out of the browser.

| Part | Choice | Notes |
| --- | --- | --- |
| Web app | Next.js (App Router), TypeScript | Server components by default. Client components only for interactive pieces. |
| Hosting | Vercel | Preview deploy for every branch. |
| Database and auth | Supabase (Postgres) | Project in the London or an EU region. Email magic-link sign-in. |
| Supabase client | @supabase/ssr | Cookie sessions. The service-role key is used only in server code. |
| Styling | CSS variables for tokens, plain CSS or Tailwind | Tokens live in one file, `styles/tokens.css`. |
| Tests | Vitest, Playwright | Vitest for parsing and date logic. Playwright for sign-in and the share link. |
| PWA | Web manifest plus a service worker | Serwist or hand-written. See the PWA section. |

Three surfaces share one codebase:

- `/(app)/...`: the signed-in owner's app (Activities, Timeline, Body, Share, Import).
- `/s/[token]`: the public read-only view for a physio or trainer.
- `/api/import`: the CSV upload endpoint. Server-side only.

How to work:

- Build one phase at a time (see Build phases). Commit at the end of each phase and run lint, type check and tests first.
- Ask before adding a dependency that is not listed here.
- Write tests for the CSV parser, the date and week logic, and the share-token check before building the screens that use them.
- Never commit real health data. The owner's real CSV stays out of the repo (add `*.csv` outside `fixtures/` to `.gitignore`). Tests use the anonymised fixture only.
- UI text is sentence case. No all caps, no italics, no emoji.

## Data model

Eight tables hold everything, and all but the shared body-part catalogue are keyed to the owner's `user_id`, with row-level security on all of them.

| Table | Columns | Notes |
| --- | --- | --- |
| `profiles` | `user_id` (pk, references auth.users), `timezone` (default `Europe/London`), `created_at` | Garmin timestamps have no time zone, so this decides which day an activity lands on. |
| `activities` | `id`, `user_id`, `source` (`garmin_csv`), `external_key`, `started_at` (timestamptz), `local_date` (date), `duration_s`, `distance_m`, `calories`, `title`, `type_raw`, `sport_key`, `raw` (jsonb), `import_id`, `created_at` | Unique on (`user_id`, `external_key`). `raw` keeps the whole CSV row so the mapping can be re-run later. |
| `sports` | `user_id`, `sport_key`, `label`, `kind` (`exercise` or `sport`), `visible`, `sort` | Controls which rows appear on the Timeline. Seeded with defaults. |
| `body_parts` | `key`, `label`, `side`, `region` | Shared catalogue of 17 parts. Seeded, not user-editable. |
| `user_body_parts` | `user_id`, `body_part_key`, `added_at` | The tags the owner has switched on for the Body screen. |
| `notes` | `id`, `user_id`, `occurred_on` (date), `activity_id` (nullable, on delete set null), `body_part_key` (nullable), `text` (required), `created_at`, `updated_at` | A note belongs to a day. It can also point at one activity and one body part. |
| `shares` | `id`, `user_id`, `token_hash` (unique), `label`, `range_weeks`, `show_notes`, `expires_at`, `revoked_at`, `last_viewed_at`, `created_at` | Only a hash of the link token is stored. See Sharing. |
| `imports` | `id`, `user_id`, `filename`, `rows_read`, `rows_new`, `rows_updated`, `rows_skipped`, `errors` (jsonb), `created_at` | One row per upload, so the owner can see what happened. |

Body part catalogue: neck, upper back, lower back, and left and right for shoulder, elbow, wrist, hip, knee, ankle and foot.

Derived, not stored:

- What aggravated it: the activities in the 3 days before a body note's `occurred_on`.
- What I did: the exercise-kind activities in the 7 days after it.
- Both windows are constants (`BEFORE_DAYS = 3`, `AFTER_DAYS = 7`) in one file. They are guesses to tune with real use.

Row-level security: every table allows select, insert, update and delete only where `user_id = auth.uid()`. `body_parts` is readable by any signed-in user. The public share page never queries these tables as an anonymous user. It goes through server code (see Sharing).

## Garmin CSV import

The import turns a Garmin Connect activities export into rows in `activities`, safely and repeatably. It must be possible to upload overlapping files again and again without duplicates.

The file (checked against the owner's real export, 126 rows from 7 April to 19 October 2026):

- Header row, then one row per activity. Values are in double quotes and lines end in CRLF.
- Columns to use: `Activity Type`, `Date`, `Title`, `Distance`, `Calories`, `Time`. Ignore the rest, but keep the whole row in `activities.raw`.
- Reject the file with a plain message if `Activity Type`, `Date` or `Time` is missing: "This doesn't look like a Garmin activities export."
- Limit uploads to 5 MB. Parse in memory and do not store the file.

Parsing rules:

- `Date` is `YYYY-MM-DD HH:MM:SS` with no time zone. Read it in `profiles.timezone`, store `started_at` in UTC, and store `local_date` as the date in that zone.
- A missing value is `--`. Treat it as null.
- Numbers can contain thousands commas (`1,836`). Strip them before parsing.
- `Time` is `HH:MM:SS`, sometimes with a decimal (`00:00:08.2`), and in one case `MM:SS.s` (`23:30.6`, a rowing session). Two parts means minutes and seconds. Store whole seconds.
- `Distance`: for activity types containing "Swim" the value is metres. For everything else it is kilometres. Store metres. A distance of `0` or `0.00` is null.
- `external_key` is the local start time plus `type_raw`, for example `2026-10-18 17:42:45|Pool Swim`. Upsert on (`user_id`, `external_key`). On a repeat, refresh the fields and keep the same `id` so notes stay attached.
- Skip a bad row, record the reason in `imports.errors`, and carry on with the rest.

Mapping from Garmin type to sport (a constant in `lib/sports.ts`, re-runnable from `raw`):

| Garmin type | Sport key | Kind | Rows in the owner's file |
| --- | --- | --- | --- |
| Running, Track Running | `run` | sport | 11 and 2 |
| Cycling | `bike` | sport | 10 |
| Pool Swim, Open Water Swimming | `swim` | sport | 12 and 11 |
| Hiking | `hike` | sport | 9 |
| Tennis, Padel, Rowing | `tennis`, `padel`, `rowing` | sport | 1 each |
| Strength Training | `strength` | exercise | 39 |
| Yoga | `yoga` | exercise | 21 |
| Pilates | `pilates` | exercise | 3 |
| Cardio | `cardio` | exercise | 5 |
| Anything else | `other`, labelled with the raw type | sport | none |

Never drop an unknown type. Seed `sports` with `strength`, `run`, `bike` and `swim` visible, and everything else hidden until the owner turns it on.

The summary export has no exercise names, sets or weights for strength sessions, only a total rep count. Showing those later means adding a FIT-file import. The `source` and `raw` columns are there so that can sit beside this one.

After an upload, show a summary: new, updated, skipped (with reasons).

Tests: add an anonymised fixture of 10 to 15 rows at `fixtures/garmin-activities.csv` that includes a thousands comma, a `--` value, the rowing time, two sessions of the same type on one day, and an unknown type.

## Screens and behaviour

The app has four main screens behind a bottom navigation bar (Activities, Timeline, Body, Share), plus Import, Settings (download and delete my data) and sign-in. The canvas mockup is the visual reference. Where this section differs from it, this section wins.

Week navigation, on both Activities and Timeline:

- Left and right arrows around the date range (for example "Oct 12 – 18") move one week. Weeks run Monday to Sunday.
- A round calendar-with-a-dot button jumps back to the current week. Show it only when another week is on screen.
- The week lives in the URL (`?week=2026-10-12`) so a refresh or a shared link keeps its place. Both screens use the same week.
- The mockup has these arrows on Timeline only. Add them to Activities too.

### Activities

- Title "Activities", then the week's date range.
- One row per day, newest first (Sunday at the top, Monday at the bottom).
- Each row shows the day, then one chip per session, such as "Run · 8 km" or "Yoga · 36 min". Exercise chips are lavender and sport chips are lime, both with a deep blue outline. Body notes never appear as chips.
- A day with no sessions says "Rest day".
- Tapping a row expands it to list each session with its title, distance, time and any notes. Tapping again closes it. Today's row is open when the week loads.
- Empty state, before any import: "Import your Garmin file to see your activities" with a button to the Import screen.

### Timeline

- Title "Timeline". The header has the week arrows, the calendar-dot button, and an "Activities" filter button with a count of rows shown.
- A grid of Monday to Sunday columns, with the date under each day name. Today's date has a lime highlight.
- One row per visible sport (default: Strength, Run, Bike, Swim). A day with one or more sessions of that sport shows a 28 px circle. Lavender for exercise, lime for sport, deep blue outline.
- A small dark dot on the circle's corner means at least one note is attached to a session that day.
- Tapping a circle selects it (white and deep blue ring) and fills a details card below: a pill with the kind and sport, the date, then each session's title, distance and time, then its notes. If a cell holds several sessions, list them all in the card.
- Moving to another week clears the selection. The card then says "Tap a marker to see its details and notes."
- The filter opens a checklist of every sport, each with a swatch. Ticking adds its row, unticking removes it. "Done" closes it. The choice is saved in `sports.visible`.
- If no row is ticked: "No activities selected. Use the Activities menu to add some."

### Adding a note

- Only on Timeline and Activities, inside the details of a session. Button: "Add a note".
- The form has a required text box, optional body part buttons, then "Cancel" and "Save note".
- Saving with an empty box shows "Write a note first." under the box and saves nothing.
- The body part buttons list the parts the owner has tagged on the Body screen. Choosing one is optional. If none is chosen, the note is saved without a body part.
- On save, store the note with `occurred_on` set to the session's local date, `activity_id` set to the session, and `body_part_key` if chosen. The new note appears in the card at once and the circle gets its dot.

### Body

- Title "Body". Under it, a row of tag buttons for each body part the owner has added, then a dashed "Add body part" button.
- "Add body part" opens a checklist of all 17 parts with checkboxes. Ticking adds a tag and selects it. Unticking removes the tag. The notes are kept.
- The selected part shows a horizontal line of circles, one per day it was noted, oldest on the left, with the date above each circle. Tapping a circle selects that day.
- Below it, "History" lists a card for each noted day, newest first, with the selected one outlined. Each card shows:
  - the date,
  - What aggravated it: the activities in the 3 days before, as chips with their details,
  - What I did: the exercise-kind activities in the 7 days after,
  - the note text.
- Cards carry no symptom tags such as "sore" or "tight".
- A part with no notes says "Nothing tagged for your right shoulder yet." With no parts at all: "Add a body part to see its history."

### Share

Create and manage read-only links. Details are in the Sharing section.

### Import

Not in the mockup. A new screen, reached from an upload icon in the Activities header and from the Activities empty state.

- A file picker for a CSV, then "Import".
- The result summary: new, updated and skipped, with the reasons for skipped rows.
- Below it, the last five imports from `imports`.

### Read-only view

The public page shows Activities, Timeline and Body with a "Read-only view" badge. It hides every control that changes data: Add a note, Add body part, Import, Share, the sign-out button. The Timeline filter stays, but it only affects what that viewer sees and is not saved.

### Sign-in

One screen: an email field and "Send me a link". Show "Check your email" afterwards.

## Sharing and read-only access

A share link is a revocable permission, and anyone holding the link can read the shared data, so treat the token like a password.

Creating a link:

- On the Share screen the owner picks a range (2 weeks, 4 weeks or 3 months) and taps "Create link".
- The range is rolling. A "4 weeks" link always shows the 4 weeks up to the day it is opened.
- Generate the token with 32 random bytes from a cryptographically secure source, encoded as base64url. Never derive it from anything else.
- Store only a SHA-256 hash of the token in `shares.token_hash`. The link is `https://<domain>/s/<token>`.
- Show the full link once, straight after creation, with a "Copy link" button. It cannot be shown again because only the hash is stored. If the owner loses it, they create a new link and stop the old one. This is a deliberate choice. See Open questions.
- The Share screen lists the owner's links with label, range, created date, last viewed and a "Stop sharing" button each. "Stop sharing" sets `revoked_at`.

Serving the public page:

- `/s/[token]` is a server-rendered page. It hashes the token, finds a share that is not revoked and not expired, and loads that owner's data with the service-role client in server code. The service-role key is never in the browser bundle.
- Return the same plain 404 for an unknown, revoked or expired token. Do not say which.
- Show only what the link allows: activities within the rolling range, and notes if `show_notes` is true.
- Fields shown on activities: sport, title, date, distance and time. Calories, heart rate and the `raw` row stay private.
- Update `last_viewed_at` on each view.
- Send `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` and `Cache-Control: private, no-store`. Put `noindex` in the page metadata too.
- Rate limit by IP, for example 30 requests a minute, to make guessing pointless.
- No sign-in prompt, no cookies set, and no third-party scripts on this page.

Tests (Playwright and unit):

- A revoked link returns 404 on the next request.
- An expired link returns 404.
- The database never contains the raw token.
- A second user's data never appears on the first user's share page.
- The public page has no element that changes data.

Later, physio accounts replace links. Keep `shares` as a permission record (who, what, how long) so a person can take the place of a token without a redesign.

## PWA requirements

The owner's app must install to a phone or tablet home screen and let them read their last few weeks without a connection. The physio's page is a normal web page and needs no install.

Installable:

- A web manifest with `name` and `short_name` as \[APP NAME\], `display: standalone`, `start_url: /`, `background_color: #F0F8FF`, `theme_color: #052B42`, and icons at 192 and 512 px plus a maskable icon. Use placeholder icons until real ones exist.
- Serve over HTTPS only (Vercel does this).
- On iPhone and iPad there is no install prompt. Show a small "Add to Home Screen" hint once, which the owner can dismiss.

Offline:

- A service worker caches the app shell and the signed-in owner's data for the 4 most recently viewed weeks, for reading only.
- When offline, show a banner: "You're offline. Showing your last saved weeks." Hide "Add a note" and the Import button. Do not queue writes in the MVP.
- Never cache `/s/[token]` pages or any response with `Cache-Control: no-store`.
- On sign-out, clear every cache the service worker holds.
- Do not rely on push notifications. They are out of scope.

Responsive layouts:

| Width | Layout |
| --- | --- |
| Under 640 px (phone) | One column. Bottom navigation. Designed at 390 px wide. |
| 640 to 1023 px (tablet) | Two columns. On Activities, the day list on the left and the open day's details on the right. On Timeline, the grid on the left and the details card on the right. Bottom navigation stays. |
| 1024 px and up | Same as tablet, with a maximum content width of 1100 px, centred. |

The tablet layout is not mocked up yet. Build it simply from the rules above and tell the owner what you chose.

Acceptance for this part:

- Lighthouse reports the app as installable.
- With the network off, the last 4 viewed weeks still open, read-only.
- Every tap target is at least 44 px square, and text meets 4.5:1 contrast.

## Security and privacy

Treat everything the app holds as health data: collect little, keep it in the UK or EU, expose it to no one by default, and be able to delete it.

- Row-level security is on for every table, with a test: a second signed-in user cannot read, change or delete the first user's rows.
- The Supabase service-role key exists only in server environment variables on Vercel. Add a check (lint rule or test) that it is never imported into client code.
- Put the Supabase project in the London or an EU region. Say which in the README.
- No analytics, advertising or tracking scripts, and no third-party fonts or scripts loaded at runtime. Self-host the Inter font.
- Logs must never contain note text, CSV rows or share tokens. Log ids and counts only.
- Do not keep uploaded files. Parse in memory. The `raw` column keeps the parsed row.
- Sign-in is by email link only, with session cookies set by `@supabase/ssr`. Sessions last up to 30 days.
- Add "Download my data" (a JSON file of the owner's rows) and "Delete my account and data" (cascades through every table) on a small Settings screen. Ask the owner to type their email to confirm deletion.
- Pin dependency versions and enable Dependabot or similar.

Outside this spec, and to settle before anyone other than the owner has data in the app: a privacy policy, explicit consent for sharing, a data protection impact assessment, and legal advice. The owner is in the UK, where health data gets extra protection. This document is not legal advice.

## Design reference

Match the canvas mockup, keep every colour and size in `styles/tokens.css`, and change values there, not in components.

Canvas: [Physio tracker MVP](https://claude.ai/artifact/GLcdfixBXVcdS6doQ2oKTy) (screens: Activities, Timeline, Body, Share). The mockup used a design system from the owner's organization by default, so the palette below is easy to swap. See Open questions.

Colours:

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#052B42` | Text, outlines, selected states, body-note dots |
| `--page` | `#F0F8FF` | Page background |
| `--surface` | `#FFFFFF` | Cards |
| `--divider` | `#DFEEFD` | Lines inside cards, navigation top border |
| `--exercise` | `#C1C1FF` | Exercise chips and circles |
| `--sport` | `#DAFF33` | Sport chips and circles, today highlight, selected tab |
| `--action` | `#5D52F6` | Filled primary buttons only, with white text |
| `--badge` | `#E0E2FD` | "Read-only view" badge |
| `--error` | `#C4001A` | Error text, "Stop sharing" |

Type and shape:

- Font: Inter, weights 400 and 600 only. Page title 32 px, weight 600, line height 1.4. Date range 18 px, 600. Body 14 px. Labels and captions 12 px, 600.
- Sentence case everywhere. No all caps, no italics, no emoji.
- Spacing in steps of 4 px (4, 8, 12, 16). Cards: white, radius 16 px, shadow `0 2px 8px rgba(5,43,66,0.08)`.
- Buttons are pills (radius 100 px), at least 44 px tall. Primary: `--action` fill. Secondary: white with a 1.5 px `--ink` outline. A dashed outline marks "add" buttons.
- Chips: 12 px, weight 600, padding 4 px by 12 px, pill shape, 1 px `--ink` outline.
- Timeline markers: 28 px circles with a 1.5 px `--ink` outline. The note dot is 14 px, `--ink` fill, 2 px white ring. A selected marker has a 2 px white ring and then a 2 px `--ink` ring.
- Focus: `0 0 0 3px rgba(93,82,246,0.28)` around the focused control.
- Icons: simple 22 px stroke icons (Lucide or similar). Navigation icons are a calendar, a rising line, a person and a share symbol.
- The active tab in the bottom bar has a lime pill behind its icon and a semibold label.

## Build phases

Build in six phases, in this order, and treat each phase's checks as a gate before starting the next.

1. Foundation
   - Next.js and TypeScript project, Vercel preview deploys, Supabase project, environment variables, lint, type check and test scripts.
   - `styles/tokens.css`, the page shell with bottom navigation, and email-link sign-in.
   - Gate: a signed-in user sees an empty Activities screen. A test proves one user cannot read another's rows.
2. Import
   - Schema and migrations for every table, seeds for `body_parts` and default `sports`.
   - The CSV parser in `lib/`, its fixture and unit tests, the `/api/import` endpoint and the Import screen.
   - Gate: the fixture imports with the expected counts, a second upload adds nothing new, a wrong file gets a plain error, and the owner's real file imports all 126 rows (checked by hand, not committed).
3. Activities and Timeline
   - Week logic and navigation, the Activities list, the Timeline grid, the sport filter, and the details card.
   - Gate: both screens match the mockup on a 390 px phone. Week arrows, the today button and the URL week all work. Two sessions of one sport on one day show as one circle and both appear in the card.
4. Notes and Body
   - Add a note, body part tags, the Body screen with its timeline and History cards, and the before and after windows.
   - Gate: a note saved on a session appears on its card and gives the circle a dot. Adding and removing a body part tag keeps the notes. Empty states show the right words.
5. Sharing
   - Share screen, token creation and revocation, the `/s/[token]` read-only page, headers, rate limit.
   - Gate: every test in the Sharing section passes, including revoke, expiry, no raw token stored, and no data-changing controls on the public page.
6. PWA, tablet and settings
   - Manifest, service worker, offline reading, the two-column tablet layout, and the Settings screen (download and delete my data).
   - Gate: Lighthouse reports installable, offline reading works for the last 4 viewed weeks, and every tap target is at least 44 px.

After the MVP, in rough order: FIT-file import for exercise names, sets and weights. An automatic Garmin connection, if Garmin reopens its developer program or an aggregator fits. A tappable body map. Accounts for physios and trainers.

## Out of scope and open questions

The MVP leaves out anything that records, predicts or sells, and nine decisions below are still open, each with the default to build until the owner says otherwise.

Out of scope:

- Logging workouts by hand. Activities come from Garmin files only.
- A live Garmin or Strava connection. Garmin's developer program is closed to new applicants and Strava's terms limit showing data to other people.
- FIT-file import, physio accounts, a marketplace, push notifications, a body map diagram, and any AI features.

Open questions:

| # | Question | Default to build |
| --- | --- | --- |
| 1 | App name and icon | Placeholder \[APP NAME\] and a plain icon |
| 2 | Can the owner re-copy a share link later? | No. Only a hash is stored, so a lost link means making a new one. |
| 3 | Visual identity. The mockup used an organization default palette (lime, lavender, deep blue). | Keep it. All values sit in `styles/tokens.css`. |
| 4 | The "Exercise" row in the mockup | Replaced by Strength, with Yoga, Pilates and Cardio also counted as exercise-kind |
| 5 | Are 3 days before and 7 days after the right windows for the Body screen? | 3 and 7, as constants to tune |
| 6 | Distance units | Kilometres, and metres for swims. Miles are not supported yet. |
| 7 | Time zone | `Europe/London`, editable in the profile |
| 8 | Should physios see calories or heart rate? | No. Sport, title, date, distance and time only. |
| 9 | Should a note be allowed with no activity, just a day? | Yes in the data model, but the MVP form only adds notes from a session |
