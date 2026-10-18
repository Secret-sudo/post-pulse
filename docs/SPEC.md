# Post Pulse: Product & Technical Specification

> Working title: **Post Pulse** (final name open, see §14).
> Version 1.5 · 18 Oct 2026
> Audience: Claude Code (implementation) and future contributors.
> Status: Ready for Phase 1 implementation.

### Changes in 1.5 (18 Oct 2026)
- Public repository `post-pulse`, licence PolyForm Noncommercial 1.0.0: free for personal and noncommercial use, no commercial use (§14). The real-export tests and their expected values move to `docs/data/tests/` (gitignored, §11.4); examples in this spec use synthetic URLs and titles. The live example `lipulse.netlify.app` keeps building from the archived private repository (§10.4).

### Changes in 1.4 (17 Oct 2026)
- Share carousel: **no slide is ever left out**, bad news included (a falling reach shows that the feed is changing). Neutral wording, no claimed causes. A checkbox per slide lets the user leave pages out of the PDF (§9.2 screen 8, TC-SC01–SC09).

### Changes in 1.3 (17 Oct 2026)
- The share card becomes a **share carousel** and moves from Phase 2 into Phase 1 as an **Alpha** feature (§9.2 screen 8): cover with a standout finding, lesson, momentum and recap slides, closing slide; light or dark; absolute numbers optional; no name, photo or typing; downloads as one PDF for a LinkedIn document post. Tests TC-SC01–SC08.

### Changes in 1.2 (17 Oct 2026, owner review)
- Beta notice: header badge and footer line "Beta version … post performance export only" (§9.1).
- Window length 7 / 30 / 90 days and **All time** moved from Phase 2 into Phase 1; windows are labelled "Last 30 days", "Previous 30 days" and by dates instead of W3/W2, with an explanation line (§6.1, §9.2).
- Filter rows are labelled (Window length, Time window, Post types, Options); "Include growing posts" has a help tooltip (§9.2).
- KPI sparklines show the selected window in weeks (days for a 7-day window), with a tooltip per point (§9.2).
- Seven new insight rules and a prioritised "What stands out" selection (§7). The Insights tab is removed; the overview shows the top 5 and "Show more" (§9.2).
- Timeline full-screen mode; posting rhythm by day, week or month; reaction and comment bars in the posts table (§9.2).
- Viral posts can also be a fixed number of impressions, default 15,000 (§6.2).

### Changes in 1.1 (16 Oct 2026)
- Owner decisions recorded (§14): hosting on **Netlify**, repository name `linkedin-pulse` kept (risk accepted), private repository with proprietary licence, real exports live in `docs/data/` (gitignored).
- Verified against the owner's real export `PostPerformance_2026-07-17_2026-10-14.xlsx`: structure confirmed, all acceptance numbers reproduced by an independent reference script.
- Gaps closed: window boundaries (§6.1), parsing rules incl. day units in durations (§4.3), hashtag-opener rule (§4.5), status-chip thresholds (§6.2), minimum sample sizes and scopes per insight rule (§7), file types (CSV dropped from Phase 1), date-format handling per locale.
- Corrected the breakout tooltip example (3 × 285 = 855, not 828).
- New §11: binding catalogue of executable test cases with exact expected values, and a traceability table from acceptance criteria to tests.

---

## 0. How to use this document

- This file is the single source of truth for scope and behaviour. It lives in the repo as `docs/SPEC.md`.
- Implement **one phase at a time** (§12). Do not build Phase 2/3 features during Phase 1, but keep the architecture ready for them.
- Where this spec says **MUST**, it is a requirement with acceptance criteria. **SHOULD** is strongly recommended. **MAY** is optional.
- Every MUST is covered by at least one test case in §11. A feature is done only when its test cases exist, run in the stated environment and pass.
- Anything marked **[VERIFY]** depends on real LinkedIn export files that we don't have yet and must be confirmed against fixtures before it is coded as final.
- If something is ambiguous, ask the owner before building. Never invent export column names.

---

## 1. Product summary

**One sentence:** Post Pulse turns a LinkedIn analytics export into a private, interactive performance dashboard with plain-language insights, in the browser, without uploading data anywhere.

**Problem.** LinkedIn's built-in analytics show single numbers per post and short time windows. Creators can't easily answer: *Is my reach declining? Which formats and topics work for me? Why did one post go viral? What should I change?* Existing third-party tools require logins, browser extensions that scrape LinkedIn (against LinkedIn's terms) or uploading data to unknown servers.

**Solution.** A web app installable as a progressive web app (PWA). The user clicks **Import**, picks the `.xlsx` file they exported from LinkedIn, and gets:
1. A dashboard (timeline, window comparison, formats, topics, reach outside network, rankings).
2. Plain-language insights and concrete suggestions derived from their own data.
3. A growing history: every new export is merged, so trends go beyond LinkedIn's own limits.
4. A shareable carousel (PDF) of their key results.

**Core promise (non-negotiable):** *Your data never leaves your device.* No backend, no accounts, no tracking, no third-party requests at runtime.

---

## 2. Target users & jobs to be done

| Persona | Description | Main job |
|---|---|---|
| **Active creator** (primary) | Posts 2 to 10 times a week, 1k to 50k followers, thought leader or consultant | "Tell me what's working, what's slowing down and what to change next." |
| **Occasional poster** | Posts monthly, wants to grow | "Show me in 30 seconds which of my posts did well and why." |
| **Coach / ghostwriter** (Phase 3) | Manages several creators | "Compare performance across clients and report it." |

Primary success moment: within **60 seconds of first import** the user sees one insight they didn't know and that feels specific to them.

---

## 3. Scope

### In scope (overall product)
- Import of LinkedIn **member (personal profile) creator analytics** exports (`.xlsx`).
- Local storage of all data in the browser (IndexedDB), merge across imports, backup/restore.
- Dashboard, insights engine, topic tagging, share card, installable PWA, offline use.
- UI languages: English (Phase 1), German (Phase 2), more later.
- Export formats from LinkedIn in English, German and French interface languages (header mapping).

### Out of scope (explicitly)
- Scraping LinkedIn pages, browser extensions, or automating LinkedIn in any way.
- Any server-side processing, user accounts, cloud sync (Phase 3 may revisit with explicit opt-in).
- LinkedIn **company page** analytics exports (different structure; possible later).
- Posting or scheduling to LinkedIn.
- Time-of-day analysis (exports do not contain publish time).
- CSV import (no CSV export layout is known; revisit if LinkedIn offers one).

---

## 4. Input data: LinkedIn export formats

### 4.1 Supported files

| ID | Export | How the user gets it | Status |
|---|---|---|---|
| **F1** | **Per-post performance export** | LinkedIn home page → Post impressions → "Show all posts" → "Load more" until all posts are loaded → Export (§9.2 screen 1) | Confirmed from the owner's real file (see §4.2) |
| **F2** | **Content analytics export** (multi-sheet: discovery, engagement over time, top posts, followers, demographics) | LinkedIn → Analytics → Content → Export | **Phase 2.** No sample file yet. **[VERIFY]** structure with a real file before implementation |

Phase 1 MUST support F1 only. The architecture (detector + per-format parser) MUST allow adding F2 without changing the F1 parser.

### 4.2 F1: confirmed structure (English interface)

Confirmed on 16 Oct 2026 against `PostPerformance_2026-07-17_2026-10-14.xlsx`.

- File name pattern: `PostPerformance_<YYYY-MM-DD>_<YYYY-MM-DD>.xlsx` (start and end of the selected range). Parse range start and end from the name; if the name doesn't match, `rangeEnd` = latest post date and `rangeStart` is unset.
- One sheet named `POST PERFORMANCE`. Row 1 = headers, one row per post. Detection MUST NOT depend on the sheet name (pick the first sheet that passes header detection).
- Workbook has no default style; parsers must not depend on styles.
- **All values arrive as text**, including numbers. Empty cells are empty strings. Parsers MUST also accept native numbers and dates in case LinkedIn changes this.
- `Impressions (in-network)` + `Impressions (out-of-network)` = 100 % on every row of the real file (±1 rounding). A row where the sum is off by more than 1 gets a parser warning, not an error.

| # | Header (EN, exact) | Example | Type after parsing | Notes |
|---|---|---|---|---|
| 1 | `Post URL` | `https://www.linkedin.com/posts/sample_how-we-plan-a-...-ugcPost-7400000000000000011-AbCd` | string | Primary source of post ID and title slug |
| 2 | `Post Publish Date` | `10/14/2026`, `7/1/2026` | ISO date | M/D/YYYY in EN export, no leading zeros. Other locales: §4.3 |
| 3 | `Post type` | `Image`, `Video`, `Repost`, `Text`, `Article`, `Document`, `Poll`, `Celebration` | enum | All 8 seen in the real file. Unknown values map to `Other` and keep the raw label |
| 4 | `Impressions` | `212`, `48210` | int | No thousands separator in the EN file |
| 5 | `Impressions (in-network)` | `82%` | float 0 to 100 | Percent string |
| 6 | `Impressions (out-of-network)` | `18%` | float 0 to 100 | Percent string |
| 7 | `Members reached` | `115` | int | |
| 8 | `Views` | `44` or empty | int or null | Video only (filled for every video in the real file) |
| 9 | `Watch time` | `10m 1s`, `1h 3m`, `1d 13h` or empty | seconds or null | Units `d h m s` (see §4.3) |
| 10 | `Avg watch time` | `13s` | seconds or null | |
| 11 | `Followers gained` | `1` | int | |
| 12 | `Profile viewers` | `1` | int | |
| 13 | `Reactions` | `14` | int | |
| 14 | `Comments` | `0` | int | |
| 15 | `Reposts` | `0` | int | |
| 16 | `Saves` | `1` | int | |
| 17 | `Sends` | `0` | int | |
| 18 | `Custom button engagements` | `0` | int | |
| 19 | `Visits to links` | empty | int or null | |

### 4.3 Value parsing rules (MUST)

All parsers live in `src/import/normalise.ts`, are pure functions and never throw on bad input: they return `null` plus a warning that names the row and column.

| Kind | Rule |
|---|---|
| Empty | `""`, whitespace only, `-`, `–` → `null`. For required count fields (`impressions`, `reactions`, `comments`, `reposts`, `saves`, `sends`) `null` becomes `0` with a warning. |
| Integer | Strip all whitespace incl. U+00A0 and U+202F. Remove thousands separators `,` `'` `’` `.` (integer fields never have decimals, so any of these is a separator). Result must match `^\d+$`, else `null` + warning. Native numbers are rounded. |
| Percent | Strip whitespace and `%`, replace decimal `,` with `.`, parse float, clamp to 0..100. `82%`, `82 %`, `82,5 %` are all valid. Native numbers ≤ 1 are treated as fractions (× 100). |
| Duration | Sum all `(\d+)\s*(d|h|m|s)` tokens case-insensitively: d = 86,400 s, h = 3,600 s, m = 60 s. Any leftover non-space text → `null` + warning. German/French unit labels **[VERIFY]**. |
| Date | Accept, in order: native date cell; Excel serial number (days since 1899-12-30); `YYYY-MM-DD`; `D.M.YYYY` (DE); `M/D/YYYY` (EN) or `D/M/YYYY` (FR). For slash dates the order comes from the detected header language (EN → M/D, FR → D/M). If any date in the file is invalid under that order but all are valid under the other, use the other and add a warning. Dates outside the file-name range by more than 1 day → warning. |

### 4.4 Header mapping registry (MUST)

- Implement a registry `src/import/headers.ts` mapping each canonical field (e.g. `impressions`, `outOfNetworkPct`) to a list of known header labels per language (EN confirmed; DE/FR placeholders added from fixtures when available **[VERIFY]**).
- Matching is case-insensitive, trims whitespace, normalises Unicode (NFKC) and ignores punctuation and spacing differences (`Impressions (in-network)` = `impressions in network`).
- Detection: a sheet is F1 if all required fields are matched AND at least 80 % of all 19 canonical fields are matched. Required for F1: `postUrl`, `publishDate`, `postType`, `impressions`.
- The language with the most matched headers becomes the file's `headerLanguage` (used for date order).
- Unknown extra columns are kept in `raw` and ignored by the UI.
- If detection fails, show a friendly error that lists the headers found and a "Copy details" button (so users can report new formats). Never crash.

### 4.5 Derived fields

| Field | Rule |
|---|---|
| `postId` | Numeric activity ID from the URL: regex `(?:ugcPost|share|activity)-(\d{15,25})`. Fallback: SHA-1 (hex) of the normalised URL (lowercased host, no query, no fragment, no trailing slash), prefixed `h:`. This is the **merge key**. |
| `authorSlug` | Text between `/posts/` and the first `_` (e.g. `sample`). Used to detect mixed profiles in one history. |
| `title` | From the URL slug: decode URI components, NFKC-normalise (LinkedIn's bold/italic Unicode letters become plain letters), strip the `authorSlug_` prefix and everything from the last `-ugcPost-`/`-share-`/`-activity-` onward, replace `-` with spaces, collapse spaces, trim to 120 chars. Case is kept as delivered. |
| `titleIsHashtags` | True when the post most likely opens with hashtags (LinkedIn drops the `#` in slugs). Rule: split the lowercased title on spaces; true if (a) no token is a stop word (shared EN/DE/FR list in `src/topics/stopwords.ts`), (b) no token contains a digit or starts with `http`, and (c) there are ≥ 3 tokens or at least one token has ≥ 12 characters. On the real file this flags exactly 11 posts (TC-R14). The stop-word list MUST contain at least: EN `a an the and or of to in on at as be by for from about over is was has can it this these that i we you my no so`; DE `der die das und ist hat am im wir ich nicht mit für`; FR `le la les de des et est un une pour`. It MUST NOT contain `ai`. The UI labels these posts "Hashtag opener". |
| `engagements` | `reactions + comments + reposts + saves + sends` |
| `engagementRate` | `engagements / impressions` (0 if impressions = 0) |
| `exportEndDate` | `rangeEnd` of the import (§4.2). For a merged history, "latest export date" = max `rangeEnd` over all imports. |
| `ageDays` | `latest export date − publishDate` in whole days |
| `isMature` | `ageDays >= 7`. Posts younger than 7 days are still collecting impressions; they MUST be flagged "still growing" and excluded from window comparisons by default (setting `includeImmature`, default `false`). |

---

## 5. Data model & storage

Use **IndexedDB via Dexie**. Schema versioned with migrations from day one.

```ts
// Canonical post (latest known values)
interface Post {
  postId: string;               // merge key
  url: string;
  authorSlug: string;
  title: string;
  titleIsHashtags: boolean;
  publishDate: string;          // YYYY-MM-DD
  postType: PostType;           // enum + 'Other'
  postTypeRaw: string;
  metrics: PostMetrics;         // latest snapshot values
  metricsAsOf: string;          // export end date of the snapshot used
  topics: string[];             // topic IDs (user tags + rule matches)
  raw?: Record<string, string>; // unknown extra columns
  language?: 'en' | 'de' | 'fr' | 'other'; // Phase 2 heuristic
}

interface PostMetrics {
  impressions: number; inNetworkPct: number | null; outOfNetworkPct: number | null;
  membersReached: number | null; views: number | null;
  watchTimeSec: number | null; avgWatchTimeSec: number | null;
  followersGained: number | null; profileViewers: number | null;
  reactions: number; comments: number; reposts: number; saves: number; sends: number;
  customButton: number | null; linkVisits: number | null;
}

// Every import keeps per-post snapshots (metrics grow over time)
interface Snapshot { postId: string; importId: string; asOf: string; metrics: PostMetrics; }

interface ImportRecord {
  importId: string; fileName: string; fileHash: string; // SHA-256 of file bytes
  format: 'F1' | 'F2'; headerLanguage: 'en' | 'de' | 'fr';
  importedAt: string; rangeStart?: string; rangeEnd: string;
  postsNew: number; postsUpdated: number; postsUnchanged: number; warnings: string[];
}

interface Topic { id: string; name: string; color: string; keywords: string[]; manualPostIds: string[]; }
interface Settings { locale: string; theme: 'system'|'light'|'dark'; breakoutMultiplier: number; viralMultiplier: number; includeImmature: boolean; }
// Defaults: breakoutMultiplier 3, viralMultiplier 10, includeImmature false, theme 'system', locale 'en'
```

### Merge rules (MUST)
1. Re-importing the **same file** (same `fileHash`) is a no-op with a toast "Already imported".
2. For each post: add a `Snapshot`. If the snapshot's `asOf` is newer than or equal to `Post.metricsAsOf`, it becomes the post's current `metrics`. An older export imported later adds snapshots but never overwrites newer metrics.
3. A post counts as **updated** if any metric value changed, **unchanged** otherwise, **new** if its `postId` was unknown.
4. Never delete posts that are missing from a newer export (exports are date-range based).
5. If an import contains a different `authorSlug` than the existing history, warn: "This file seems to be from another profile. Import anyway / Cancel." (Phase 3 adds "Start a separate profile".)
6. Show an import summary: new, updated, unchanged posts, date range, warnings.
7. The whole import is one Dexie transaction: it either fully applies or not at all.

### Data controls (MUST)
- **Backup**: download all data as one versioned JSON file (`postpulse-backup-YYYY-MM-DD.json`, top-level `{ app: "post-pulse", backupVersion: 1, exportedAt, posts, snapshots, imports, topics, settings }`).
- **Restore**: import that JSON (validated with a zod schema; merge or replace). Invalid or newer-version files are rejected with a clear message and change nothing.
- **Delete all data**: with an in-page confirmation step (not `confirm()`).
- After every import, show a dismissible backup reminder and call `navigator.storage.persist()` once.

---

## 6. Metrics & analysis definitions

All analysis code lives in **pure TypeScript functions** in `src/analysis/` with unit tests. UI never computes metrics itself.

### 6.1 Time windows
- Let `E` = latest export date. Window `k` back from the end covers publish dates in the half-open interval **(E − 30·(k+1) days, E − 30·k days]**, i.e. each window includes its last day and excludes the day before its first day.
- The three most recent windows are named `W3` (k = 0, last 30 days), `W2` (k = 1, prior 30), `W1` (k = 2). For the real file (E = 2026-10-14): W3 = 15 Sep–14 Oct, W2 = 16 Aug–14 Sep, W1 = 17 Jul–15 Aug 2026.
- Older posts fall into further windows (k ≥ 3), shown when history is longer. A window with no posts shows "No posts".
- Comparisons ("change") are always the selected window vs the one before it; the default is W3 vs W2.
- **Window length** 7, 30 (default) or 90 days, or **All time**: one window from the oldest post to `E`, with no window before it (change shows "–"). URL: `size=7|90|all`. In the UI windows are named "Last N days", "Previous N days" and by their dates; W3/W2/W1 stay the internal names used in this spec. The 4 most recent windows are chips, older ones are in an "Earlier windows…" menu.
- Insights always use 30-day windows (§7), whatever window length the views show.
- **Custom range** filter for every view (inclusive start and end dates).

### 6.2 Headline metrics per window

Unless noted, a metric uses the posts of the window, without immature posts when `includeImmature = false`.

| Metric | Definition |
|---|---|
| Posts | count |
| Median impressions / post | median of `impressions` |
| Median reach / post | median of `membersReached` (nulls skipped) |
| Median engagement rate | median of `engagementRate` |
| Median outside-network share | median of `outOfNetworkPct` (nulls skipped) |
| Personal median | median `impressions` over the **full history**, same maturity rule. The base for breakout/viral. |
| Breakout posts | posts with `impressions >= breakoutMultiplier × personal median` (default 3×) |
| Viral posts | `impressions >= viralMultiplier × personal median` (default 10×), or, when the user picks "a fixed number of impressions" in Settings, `impressions >= viralImpressions` (default **15,000**, whole number 100 to 10,000,000) |
| Comments, Saves, Followers gained, Profile viewers | sums (nulls count as 0) |
| Impressions without viral posts | sum of impressions excluding viral posts |
| Zero-comment share | share of posts with 0 comments |
| Concentration | share of total impressions from the top-1 and top-5 posts |
| Best post | post with max impressions (ties: earlier publish date, then lower `postId`) |
| Change | `selected / prior − 1`, shown signed with ▲/▼ and colour (inverted for zero-comment share). If prior = 0 or empty: show "–" and no status chip. |

**Median**: of an even count = mean of the two middle values; of an empty list = `null` (shown as "–").

**Status chip** (KPI tiles) from Change: **Growing** ≥ +10 %; **Flat** between −10 % and +10 % (exclusive); **Slipping** ≤ −10 % and > −30 %; **Down sharply** ≤ −30 %. Inverted for zero-comment share. Thresholds live in `src/analysis/constants.ts`. Every threshold comparison (here and in §7) uses the ratio rounded to 4 decimals, so floating-point noise never flips a result (90 / 100 − 1 = −0.1000 → Slipping). Displayed percentages use 1 decimal in tooltips and whole numbers in insight text.

**Source for the 15,000 default** (owner decision 17 Oct 2026): AuthoredUp analysed 476,465 personal-profile posts (Sep 2025 – Feb 2026): median ≈ 840 impressions; 10,000 = 92nd percentile; 15,000+ = 94th percentile, "the edge of viral"; its top-5 % tier had a median of 34,121. Vendor guides that call 50,000+ or 100,000+ viral give no data. No independent study defines "viral" on LinkedIn.

**Design decision:** thresholds are **relative to the user's own median**, not fixed numbers, because a fixed 1,000 impressions means nothing for a user with 300 or 300,000 followers. Show the resolved absolute value in tooltips ("Breakout = 3× your median (285) = 855+ impressions").

### 6.3 Breakdowns
- By **post type**, **topic**, **outside-network bucket** (`≤ 40`, `> 40 and ≤ 60`, `> 60 and ≤ 80`, `> 80`; labelled 0–40 %, 41–60 %, 61–80 %, 81–100 %), **weekday** (from publish date, Monday first), **language** (Phase 2), **posts per day** (1 vs 2+ same-day posts).
- Breakdowns cover the full history (or the active filter), same maturity rule.
- Each breakdown shows posts, median impressions, median ER, median outside-network share. Groups with fewer than 3 posts are greyed out with "too few posts" and never trigger insights.
- **Rolling median** (trailing 7 posts by publish date, including the current one; fewer than 7 at the start → median of what's there) for the timeline line.
- **Rhythm series** by day, ISO week (Monday start, the default) or calendar month: posts and impressions per period (regular vs viral split), gaps filled with zeros.
- **Video**: views, view rate (`views / impressions`), average watch time, by window.

### 6.4 Statistical honesty (MUST)
- Use **medians**, not means, for "typical post" figures (distributions are heavily skewed).
- Never claim causation. Insight wording uses "coincided with", "posts like this tended to".
- Show sample size next to every comparison.

---

## 7. Insights engine

A rule-based engine in `src/insights/` (no AI in Phase 1). Each rule is a pure function `(dataset, settings) => Insight | null`.

```ts
interface Insight {
  id: string; severity: 'positive' | 'info' | 'warning' | 'critical';
  title: string;            // short headline
  evidence: string;         // the numbers that triggered it
  suggestion: string;       // one concrete action
  effectSize: number;       // for ordering, see below
  relatedFilter?: Partial<Filters>; // clicking the insight applies this filter
}
```

Phase 1 rules. All thresholds and minimum sample sizes live in `src/insights/constants.ts`. "Current" = W3 and "prior" = W2 (or the selected pair). Maturity follows `includeImmature` unless the rule says otherwise.

| ID | Severity | Trigger | Min. sample | Example output |
|---|---|---|---|---|
| `reach_decline` | warning (critical if ≤ −30 %) | median impressions current vs prior ≤ −15 % | ≥ 5 posts in each window | "Your typical post reaches fewer people: 267 → 210 (−21 %)." |
| `resonance_holds` | info | `reach_decline` fired AND median ER change within ±15 % | as above | "People still engage at the same rate. The issue is distribution, not quality." |
| `no_breakouts` | warning | 0 breakout posts in current while W1 or W2 had ≥ 2 | ≥ 5 posts in current | "No breakout post in the last 30 days (6 in the 30 before)." |
| `oon_driver` | info | Spearman correlation (average ranks for ties) of outside-network share vs impressions ≥ 0.5, over the full history | ≥ 20 posts | "Your big posts are the ones LinkedIn shows outside your network." |
| `comment_drought` | warning | zero-comment share in current ≥ 50 % | ≥ 5 posts | "58 % of recent posts got no comments. End with one specific question." |
| `over_posting` | info | posts/week in current (`count / 30 × 7`) > 5 OR ≥ 3 days with 2+ posts. Uses **all** posts, also immature ones | ≥ 5 posts | "You often post several times a day; your posts may compete with each other." |
| `weak_format` | warning | a post type has median < 0.7 × overall median (full history). One insight per type | ≥ 3 posts of that type | "Reposts reach 37 % fewer people than your typical post." |
| `strong_format` | positive | a post type has median > 1.3 × overall median (full history). One insight per type | ≥ 3 posts of that type | "Videos reach 45 % more people than your typical post." |
| `topic_winner` / `topic_loser` | positive / warning | same logic per topic, only when topics are tagged | ≥ 3 posts | **Phase 2** |
| `concentration` | info | top-1 share of impressions > 50 % over the full history, all posts | ≥ 10 posts | "One post produced 70 % of all impressions." |
| `hashtag_opener` | warning | posts with `titleIsHashtags` have median < 0.8 × overall median (full history) | ≥ 3 hashtag posts and ≥ 3 other posts | "Posts that open with hashtags underperform. Start with a scene or a number." |
| `growing_posts` | info | posts with `isMature = false` exist | ≥ 1 | "4 posts are still collecting impressions and are excluded from comparisons." |
| `reach_growth` | positive | median impressions current vs prior ≥ +15 % | ≥ 5 posts in each window | "Your typical post reaches more people: 210 → 267 (+27 %)." |
| `engagement_shift` | positive if up, warning if down | median engagement rate current vs prior, change ≥ +20 % or ≤ −20 % | ≥ 5 posts in each window | "Fewer people react to what they see: 2.0 % → 1.6 % (−20 %)." |
| `oon_shift` | positive if up, warning if down | median outside-network share current − prior ≥ +10 or ≤ −10 percentage points (rounded to 2 decimals) | ≥ 5 posts in each window | "Fewer of your impressions come from outside your network: 30 % → 20 %." |
| `breakout_run` | positive | ≥ 2 breakout posts in current and more than in prior | ≥ 5 posts in current | "3 breakout posts in the last 30 days (1 in the 30 before)." |
| `same_day_split` | warning | full history: median impressions of posts sharing their day with another post < 0.8 × median of posts alone on their day | ≥ 3 posts in each group | "Posts that share a day with another post reach 33 % fewer people." |
| `cadence_drop` | info | posts in current ≤ 0.5 × posts in prior; **all** posts, growing ones too | ≥ 4 posts in prior | "You posted less: 3 posts in the last 30 days vs 8 in the 30 before." |
| `follower_drivers` | info | full history, all posts: the 3 posts with the most followers gained hold ≥ 50 % of all followers gained (ties: more impressions first) | ≥ 10 posts and ≥ 10 followers gained | "3 posts brought 62 % of the followers your posts gained." |

**Ordering**: by severity (critical, warning, positive, info), then by `effectSize` descending, then by `id` so ties are stable. `effectSize` = absolute relative difference that triggered the rule (e.g. 0.213 for −21.3 %), `|ρ|` for `oon_driver`, the share for `concentration` and `comment_drought`, the count for `growing_posts` divided by 100. Decided on 16 Oct 2026 where the table left it open: `resonance_holds` uses the reach change it explains, so it sorts next to `reach_decline`; `no_breakouts` uses 1; `over_posting` uses max(posts per week ÷ 5 − 1, days with 2+ posts ÷ 10, 0). Rules added on 17 Oct 2026 use: |change| for `reach_growth` and `engagement_shift`, |points| ÷ 100 for `oon_shift`, (current − prior) ÷ current breakouts for `breakout_run`, 1 − ratio for `same_day_split` and `cadence_drop`, the share for `follower_drivers`.

**Notes vs findings**: `resonance_holds` and `growing_posts` are *notes* (context for other insights). The full list puts findings first, then notes, each in the order above.

**Prioritising "What stands out"** (overview, top 5), so one theme can't crowd out the rest and good news isn't buried:
1. Walk the findings in order; take at most **2 per family**. Families: reach (`reach_decline`, `reach_growth`, `no_breakouts`, `breakout_run`), engagement (`engagement_shift`, `comment_drought`), audience (`oon_driver`, `oon_shift`, `concentration`, `follower_drivers`), format (`weak_format`, `strong_format`, `hashtag_opener`), rhythm (`over_posting`, `same_day_split`, `cadence_drop`).
2. If any positive finding exists, the best one is always shown. It replaces the lowest pick of its own family when that family already has 2, otherwise the last pick.
3. Free slots are filled with the skipped findings, then notes.
4. The five keep the overall order. "Show more" lists the rest below them; there is no separate Insights tab.

**Rule details decided on 16 Oct 2026**:
- Every threshold compares the ratio rounded to 4 decimals (§6.2); "below"/"above" are strict and "≤"/"≥" inclusive as written in the table.
- "Overall median" for format and hashtag rules = median impressions of all posts that count (same maturity rule).
- `growing_posts` only fires while growing posts are left out; with "Include growing posts" on there's nothing to report.
- Insight text uses whole percentages ("−21 %", "58 %"); tooltips use one decimal.

---

## 8. Topics (tagging) — Phase 2

- Users create topics (name, colour, keywords). A post matches if any keyword appears in its `title` (case-insensitive, word boundary). Users can also tag posts manually from the table.
- Provide **suggested topics**: the 15 most frequent meaningful words/bigrams across titles (stop-word lists for EN/DE/FR, shared with §4.5), so users can create topics in one click.
- Untagged posts are grouped as "Untagged".
- Topic definitions are part of backup/restore (the backup format includes `topics` from Phase 1, empty until Phase 2).
- Phase 3 MAY add AI tagging (see §12).

---

## 9. UX & UI specification

### 9.1 Design language
- Clean, professional, familiar to LinkedIn users: warm light-grey canvas, white cards with 8 px radius and subtle 1 px shadow ring, one blue primary accent, green for positive, red for negative, pill-shaped filter chips, system font stack.
- **Beta notice**: a "Beta" badge next to the app name and a footer line "Beta version. Post Pulse analyses your post performance export only, not followers, profile visitors or audience data."
- **Do NOT use the LinkedIn logo, the "in" mark, the LinkedIn name in the app name/logo, or LinkedIn's exact brand assets.** Text may say "for your LinkedIn analytics export". Add footer: "Not affiliated with LinkedIn Corporation."
- Light and dark themes (system default, manual toggle). All colours as CSS custom properties.
- Post-type colours are consistent across every chart.

### 9.2 Screens

1. **Welcome / empty state**
   - Headline, the privacy promise, big **Import LinkedIn export** button + drag-and-drop zone (accepts `.xlsx` only).
   - "How to export from LinkedIn" as an expandable section, four steps, each with a screenshot (`public/howto/step1–4.webp`, personal data blurred, LinkedIn's navigation bar and logo cropped off, the click area framed in red):
     1. LinkedIn (web): open the Post impressions stats on the home page.
     2. Under "Most recent post performance", choose "Show all posts".
     3. At the bottom of the page, choose "Load more" repeatedly until all posts are loaded.
     4. Choose "Export" at the top of the page.
   - **Try with sample data** button (bundled synthetic dataset, clearly labelled as sample; a banner stays visible while sample data is loaded and offers "Remove sample data"). The first real import replaces the sample instead of mixing with it, and the import summary says so.
2. **Import flow**
   - File picker / drop → parse in a Web Worker with progress → summary dialog (new/updated/unchanged, range, warnings) → dashboard.
   - Errors: unsupported file type, file too large, password-protected file, unknown headers (with "Copy details"), empty file (no data rows).
3. **Overview (default tab)**
   - Profile header (initials avatar, author slug, history range, total posts).
   - One-sentence takeaway generated from the top insight.
   - Filter rows, each with a visible label: **Window length** (7 / 30 / 90 days / All time), **Time window** (hidden for All time), **Post types**, **Options** ("Include growing posts" with a help tooltip, "Clear filters"). Below them one line explains the windows ("Your history is cut into blocks of 30 days, counted back from your latest export (Oct 14, 2026)…").
   - KPI strip: 6 tiles (median impressions, median reach, breakouts, comments, followers gained, engagement rate), each with value for the selected window, change vs previous window (▲/▼ coloured), status chip (§6.2) and a **sparkline of the selected window**: one point per 7 days counted back from the window's last day (one per day for a 7-day window; the oldest point may be shorter), empty points as gaps. Hover, or focus and the arrow keys, show "Sep 17 – Sep 23, 2026: 200 (4 posts)"; screen readers get every point in the label.
   - "What stands out": the top 5 insights (§7 "Prioritising") and a "Show N more" button that expands the rest in place.
   - "Best post per window" list.
4. **Timeline**
   - Scatter of every post (x = date, y = metric on log scale by default; size = comments; colour = type), rolling median line, shaded windows, top-3 labels, hover tooltip with all metrics, click opens the post on LinkedIn (new tab, `rel="noopener noreferrer"`).
   - Metric switch: impressions / reach / engagements / engagement rate / outside-network share.
   - Filters: window, post type chips, include growing posts.
   - **Full screen** button: the chart card fills the window; the button or Escape returns to normal.
5. **Breakdowns** (Phase 1): format tier list, outside-network buckets, posting rhythm (bars with viral split) grouped by **day, week or month** (URL `period=day|month`, week is the default); chart and "Show data" table follow the choice. Topics, weekday and video stats are Phase 2.
6. **Posts table**: sortable, searchable, filterable; columns date, type, title (link), impressions, reactions and comments (each with an in-cell bar scaled to the largest value in the current rows), outside-network %, reactions, comments, reposts, saves, ER, status (growing / breakout / viral). Topic column in Phase 2. Virtualised for 5,000+ rows. CSV export of the current view.
7. **Insights**: removed on 17 Oct 2026 (it repeated the overview). Every insight is on the overview ("Show more"); clicking applies the related filter: insights about a set of posts (a post type, hashtag openers) open the posts table with that filter, window-level ones open the overview. Old `?view=insights` links open the overview.
8. **Share carousel (Alpha, Phase 1)**, decided by the owner on 17 Oct 2026. Purpose: a user shares a story from their own numbers that is useful to their audience (a lesson), shows progress (momentum) or thanks their network (recap), without vanity screenshots.
   - **Entry**: a "Share" button with an "Alpha" badge on the Overview, next to the one-sentence takeaway. Nowhere else.
   - **Dialog** "Share your LinkedIn story" with an Alpha note ("An early version: slides and wording may still change"), two choices and nothing to type: theme **Light / Dark** (independent of the app theme) and **Show absolute numbers** (on by default; off shows only changes and shares, with a one-line reason why), the slides as thumbnails that update at once, each with an **include** checkbox (all ticked; "Every slide is included, good news and bad. Untick the ones you don't want in the PDF; the closing slide with the app's address always stays."), except the closing slide, which is marked "always included" and can't be left out (owner decision 17 Oct 2026: it's the signature slide that markets the app), a privacy note, **Download PDF** (unticked slides are left out and the page numbers count only the included ones).
   - **Output**: one PDF, one 1080 × 1350 page per slide (LinkedIn shows an uploaded PDF as a carousel). Drawn on a canvas and written as PDF in the browser by own code (`src/share/`); nothing is uploaded. File name `post-pulse-carousel-<latest export date>.pdf`.
   - **Slides** (always English, first person, no name, photo or initials; footer `lipulse.netlify.app` and "n / total", "Swipe for more" except on the last slide):
     1. **Cover**: "My LinkedIn · <range>" and one standout finding: the best positive overview insight not used by the lesson (`reach_growth`, `breakout_run`, `engagement_shift`, `oon_shift`, `strong_format`, in overview order); else, if one post has ≥ 25 % of the impressions in the recap range, "1 post brought N % of all my impressions."; else "What N posts taught me about LinkedIn." With sample data a "SAMPLE DATA" badge.
     2. **Lesson** (always): the format insight (`weak_format` / `strong_format`) with the largest effect; without one, the post type (≥ 3 posts) furthest from the typical post if at least 10 % away; otherwise "My formats reached about as many people as my typical post."; with no type of 3 posts "Not enough posts per format yet to compare formats." Bars of median impressions per post type (≥ 3 posts), a "typical post" line, the highlighted type in green (stronger) or red (weaker), and "It shows what went together, not what caused it."
     3. **Momentum** (always, good or bad news): last 30 days vs the 30 before, change of median impressions in green (up), red (down) or neutral (±0 % or nothing to compare), one plain sentence without causes ("More / Fewer / About as many people saw my typical post than the month before.", or "Not enough posts in the last 60 days to compare yet."), the medians (absolute), "Based on only N and M posts." when a window has fewer than 5, a 13-week trend line, breakouts (absolute) or engagement-rate change (relative), outside-network share.
     4. **Recap**: the last 90 days up to the latest export (shorter histories: weeks or days): posts, impressions, comments, followers gained (absolute) or posts, share of posts with comments, typical outside-network share, best format (relative); the most-read post (title from its link, capitalised, ending in "…") and a thank-you line.
     5. **Closing**: "Made with Post Pulse", the URL, "Analysed in my browser from my LinkedIn export. My data never left my device." and "Not affiliated with LinkedIn Corporation."
   - Colours: `--share-light-*` / `--share-dark-*` tokens in `tokens.css`.
9. **Settings & data**: theme, thresholds (breakout multiplier; viral as a multiple of the median **or** a fixed number of impressions, with the source of the 15,000 default), include growing posts (the default; each view can still override it in the URL with `growing=1/0`), backup, restore, delete all data, and a read-only list of imports. **Restore a backup** is also offered on the welcome screen, so an emptied history can be restored. Language, topics manager and import history management (deleting a single import) are Phase 2.

### 9.3 Interaction rules
- All filters live in the URL query string (shareable deep links to a view, no data in the URL).
- Every number has a tooltip explaining its definition.
- Empty and loading states are designed (skeletons, no spinners over 300 ms without text).
- Keyboard navigable, visible focus, charts have a data-table fallback (`<details>` "Show data").

### 9.4 Copy tone
Plain, direct, encouraging but honest. No jargon ("outside your network", not "OON"). No emoji in UI chrome; MAY be used in share-card templates.

---

## 10. Architecture & tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Build | **Vite** | fast, simple static output |
| UI | **React 18 + TypeScript (strict)** | ecosystem, Claude Code familiarity |
| Styling | CSS Modules or vanilla CSS with custom properties (no heavy UI kit) | small bundle, full control of the look |
| State | Zustand (UI state) + Dexie live queries (data) | minimal boilerplate |
| Excel parsing | **SheetJS Community Edition from the official SheetJS CDN tarball, pinned version** (`https://cdn.sheetjs.com/xlsx-<ver>/xlsx-<ver>.tgz`, newest stable at implementation time) | the `xlsx` package on the npm registry is outdated and has a known vulnerability; do not use it |
| Parsing runtime | Web Worker (`comlink`) | keeps UI responsive |
| Storage | **Dexie** (IndexedDB) | versioned schema, live queries |
| Charts | **Apache ECharts** with modular imports (`echarts/core`) | interactive, performant, theming |
| Share carousel | Canvas 2D rendering and a minimal PDF writer (own code) | no DOM-to-image or PDF library, exact output, nothing leaves the browser |
| PWA | `vite-plugin-pwa` (Workbox) | installable, offline |
| i18n | `i18next` with JSON resources | EN now, DE next; numbers/dates via `Intl` |
| Validation | `zod` | backup/restore and parsed rows |
| Tests | **Vitest** + Testing Library + `fake-indexeddb` (unit/component), **Playwright** + `@axe-core/playwright` (e2e) | |
| Lint/format | ESLint (typescript-eslint) + Prettier | |
| Bundle budget | `size-limit` | enforced in CI |
| Runtime | **Node 24 LTS**, pinned in `.nvmrc` and `netlify.toml` | same version locally, in CI and on Netlify |
| CI | GitHub Actions: typecheck, lint, unit, e2e, build, size, Lighthouse | runs on every push and PR |
| Hosting / CD | **Netlify** (Git integration): production deploy on merge to `main`, deploy preview per PR | owner decision; real HTTP headers for CSP |

### 10.1 Repository structure

```
post-pulse/
├─ docs/
│  ├─ SPEC.md                   ← this file
│  └─ data/                     ← real user exports and the tests that use them (tests/), GITIGNORED, never committed
├─ CLAUDE.md                    ← working agreement for Claude Code
├─ README.md
├─ netlify.toml                 ← build, headers (CSP), SPA redirect
├─ .nvmrc
├─ fixtures/
│  └─ synthetic/                ← committed, generated sample exports + *.expected.json
├─ scripts/
│  ├─ make-fixtures.ts          ← generates synthetic .xlsx fixtures (deterministic, fixed seed)
│  └─ make-derived.ts           ← local only: derives a "next export" from files in docs/data/ (TC-M08)
├─ public/ (icons, manifest assets)
├─ src/
│  ├─ app/ (routing, layout, providers)
│  ├─ import/ (headers.ts, detect.ts, parseF1.ts, importFile.ts, worker.ts, normalise.ts, derive.ts, types.ts)
│  ├─ db/ (schema.ts, migrations.ts, repo.ts, merge.ts, backup.ts)
│  ├─ analysis/ (windows.ts, metrics.ts, breakdowns.ts, stats.ts, constants.ts)
│  ├─ insights/ (rules/*.ts, engine.ts, constants.ts)
│  ├─ topics/ (stopwords.ts; topic features Phase 2)
│  ├─ features/ (overview, timeline, breakdowns, posts, insights, settings)
│  ├─ components/ (KpiTile, Chip, Card, Tooltip, ChartFrame, DataTable…)
│  ├─ i18n/ (en.json)
│  └─ styles/ (tokens.css, themes.css)
├─ tests/
│  ├─ builders/                 ← in-memory post/dataset builders for unit tests
│  └─ e2e/
└─ .github/workflows/ci.yml
```

### 10.2 Security & privacy requirements (MUST)
- No network requests at runtime except loading the app's own static assets. Verified by an e2e test that fails on any request to another origin (TC-S01).
- Content Security Policy, identical in two places:
  - as an HTTP header from `netlify.toml` (adds the header-only directives `frame-ancestors 'none'`), and
  - as a `<meta>` tag injected into the **production** `index.html` only (Vite's dev server needs inline scripts).
  - Policy: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`.
- Further headers from `netlify.toml`: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`. The service worker file is served with `Cache-Control: no-cache`.
- Netlify features that inject code (analytics, snippet injection, forms, identity) stay off.
- No analytics, no error-reporting SDKs, no fonts from external CDNs.
- Treat all spreadsheet cell content as untrusted text: never inject as HTML (no `dangerouslySetInnerHTML`, ESLint rule enforces it).
- Post URLs are untrusted too: only `https:` links to `linkedin.com` (or a subdomain) become clickable; anything else (`javascript:`, `data:`, other hosts) is shown as plain text (TC-S04).
- CSV exports neutralise spreadsheet formulas: a field starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'` (TC-S04).
- Accept only `.xlsx` up to 20 MB, checked by extension and by the ZIP signature `PK\x03\x04`. Reject `.xlsm`, `.xls`, `.csv` and everything else with a friendly message.
- `.gitignore` excludes `docs/data/`, Excel lock files (`~$*`) and every `*.xlsx`/`*.xls`/`*.xlsm`/`*.csv` outside `fixtures/synthetic/`. CI fails if such a file is ever tracked (TC-S05).

### 10.3 Non-functional requirements
| Area | Requirement |
|---|---|
| Performance | Import of a 1,000-post file < 2 s on a mid-range laptop; dashboard interactions < 100 ms; supports 5,000 posts |
| Bundle | Initial JS < 350 KB gzipped; SheetJS and ECharts lazy-loaded |
| Browsers | Last 2 versions of Chrome, Edge, Safari, Firefox; iPadOS Safari |
| Responsive | Usable from 360 px width; tables scroll horizontally inside their container |
| Accessibility | WCAG 2.2 AA: contrast, keyboard, focus, aria labels, reduced motion respected |
| Offline | After first load, the full app works offline |
| Reliability | DB schema migrations tested; backup format versioned |
| Lighthouse | ≥ 90 in Performance, Accessibility, Best Practices; PWA installable |

### 10.4 Netlify setup
- `netlify.toml`: build command `npm run build`, publish directory `dist`, `NODE_VERSION = "24"`, SPA fallback `/* → /index.html 200`, headers from §10.2.
- Live example: `lipulse.netlify.app` builds from the archived private repository `linkedin-pulse`; the public repository `post-pulse` has no Netlify connection (owner decision 18 Oct 2026). Anyone can connect their own fork the same way.
- The owner connects the Netlify site to the GitHub repo once (Netlify UI → Add new site → Import from Git). Suggested site name `post-pulse` (`post-pulse.netlify.app`).
- Netlify's build fetches SheetJS from `cdn.sheetjs.com` at install time; this is build time, not runtime, and does not break §10.2.
- Deploy previews are public URLs but contain no user data (data only ever exists in the visitor's browser).

---

## 11. Quality & testing

### 11.1 Test principles (MUST)
- Every test case below is an **automated** test with the given ID in its name (e.g. `it('TC-P03 parses durations with day units', …)`), so results map back to this spec.
- Expected values are **never produced by the code under test**. They come from this spec, from hand-written `*.expected.json` files next to synthetic fixtures, or from the independent reference computation done on 16 Oct 2026 (§11.4).
- `npm test` runs all unit and component tests; `npm run test:e2e` runs Playwright; `npm run test:private` runs `docs/data/tests/` against the exports in `docs/data/`.
- Coverage: ≥ 90 % lines for `src/import/`, `src/db/`, `src/analysis/`, `src/insights/`; CI fails below.
- Environments: **CI** = runs on GitHub Actions on every push/PR; **Local** = needs files in `docs/data/` and is skipped (reported as skipped, not passed) when they're missing.

### 11.2 Synthetic fixtures (committed)
Generated by `scripts/make-fixtures.ts` with a fixed seed; each `.xlsx` has a hand-written `<name>.expected.json` with the exact values to assert.

| Fixture | Purpose |
|---|---|
| `syn-basic-en.xlsx` | 40 posts over 90 days, all 8 post types, EN headers and formats. Golden metrics per window. |
| `syn-insights-en_2026-07-17_2026-10-14.xlsx` | Designed so that every rule of 16 Oct 2026 except topic rules fires at least once (some on the full history, some on W3 vs W2); of the rules added on 17 Oct, `same_day_split` and `oon_shift` fire, the others are covered by TC-I01. Order, overview selection, severities, titles and effect sizes in `syn-insights.expected.json`. Reactions are whole numbers (`round(impressions / 50) − comments`). |
| `syn-quiet-en_2026-07-17_2026-10-14.xlsx` | Stable, healthy profile: **no** warning or critical insight fires (only the growing-posts note). |
| `syn-merge-a_2026-07-01_2026-09-30.xlsx` / `syn-merge-b_2026-07-15_2026-10-14.xlsx` | Overlapping ranges: b drops the 5 oldest posts of a, changes metrics of 10, keeps 15 identical, adds 4 new. Expectations for both import orders in `syn-merge.expected.json`. The date range in the name is what gives each export its "as of" date. |
| `syn-format-variants.xlsx` | Header variants (case, spacing, punctuation, NFKC), thousands separators `1,234` `1'234` `1.234` `1 234`, `82,5 %`, durations with `d`, native number and date cells, Excel serial dates. |
| `syn-de.xlsx`, `syn-fr.xlsx` | Placeholder header sets and D.M.YYYY / D/M/YYYY dates **[VERIFY against real DE/FR exports]**. |
| `syn-other-author_2026-09-01_2026-10-14.xlsx` | Same structure, author slug `someoneelse`. |
| `syn-unknown-headers.xlsx` | Only 2 of 4 required headers. |
| `syn-empty.xlsx` | Header row only. |
| `syn-large-1000.xlsx`, `syn-large-5000.xlsx` | Performance tests. Generated on the fly in CI if too big to commit. |
| `syn-xss.xlsx` | URL slug containing `%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E` and a post type `<b>x</b>`. |

### 11.3 Unit test cases (CI)

**Parsing (`src/import/`)**

| ID | Input | Expected |
|---|---|---|
| TC-P01 | integers `212`, `1,234`, `1'234`, `1’234`, `1.234`, `1 234`, `1 234`, `1 234`, native `1234.0` | 212, then 1234 for all others |
| TC-P02 | integers `""`, `" "`, `-`, `abc`, `12a` | `null` (+ warning for `abc`, `12a`); required count field `""` → 0 + warning |
| TC-P03 | durations `13s`, `10m`, `10m 1s`, `1h 3m`, `6h 21m`, `1h 2m 3s`, `1d 13h`, `""`, `5 minutes` | 13, 600, 601, 3780, 22860, 3723, 133200, null, null + warning |
| TC-P04 | percents `82%`, `18 %`, `0%`, `100%`, `82,5 %`, native `0.18`, `""`, `120%` | 82, 18, 0, 100, 82.5, 18, null, 100 (clamped) + warning |
| TC-P05 | dates EN `10/14/2026`, `7/1/2026`; DE `14.10.2026`; FR `14/10/2026`; ISO `2026-10-14`; serial `46309`; native Date | `2026-10-14`, `2026-07-01`, then `2026-10-14` for all others |
| TC-P06 | EN file whose dates include `13/10/2026` and all are valid as D/M | parsed as D/M + warning |
| TC-P07 | URLs with `-ugcPost-7400000000000000011-AbCd`, `-share-7400000000000000012--_zm`, `-activity-7400000000000000000-AbCd`, and one without an ID | IDs `7400000000000000011`, `7400000000000000012`, `7400000000000000000`; last → `h:` + 40 hex chars, stable across runs and URL query/fragment variants |
| TC-P08 | `authorSlug` from `https://www.linkedin.com/posts/sample_how-we-plan-…` | `sample` |
| TC-P09 | titles: `sample_how-we-plan-a-product-launch-in-six-weeks-ugcPost-…`; the bold-Unicode slug `sample_%F0%9D%90%87%F0%9D%90%9E%F0%9D%90%A5-…-share-…` (𝐇𝐞𝐥𝐥𝐨 𝐖𝐨𝐫𝐥𝐝); a 200-char slug | `how we plan a product launch in six weeks`; `Hello World`; exactly 120 chars |
| TC-P10 | `titleIsHashtags` true: `machinelearning productivity remotework`, `keeplearningeveryday`, `data ai leadership`. False: `brilliant`, `no questions`, `the planning ritual`, `Hello World`, `128 gb speicher reicht nicht mehr`, `live httpslnkdinexample` | as listed |
| TC-P11 | post types: the 8 known labels, `Carousel`, `""` | the 8 enums; `Other` with raw `Carousel`; `Other` with raw `""` + warning |
| TC-P12 | header normalisation: `Impressions (in-network)`, `impressions in network`, `IMPRESSIONS (IN–NETWORK)` (en dash), full-width letters | all → `inNetworkPct` |
| TC-P13 | detection: all 19 EN headers; 4 required + 12 others (16/19 = 84 %); 4 required + 10 others (14/19 = 74 %); 18 headers without `impressions` | F1; F1; not detected; not detected (error lists the found headers) |
| TC-P14 | extra column `Hashtags` | kept in `raw.Hashtags`, no warning |
| TC-P15 | file name `PostPerformance_2026-07-17_2026-10-14.xlsx`; `export.xlsx` with latest post 2026-10-09 | range 2026-07-17 → 2026-10-14; rangeEnd 2026-10-09, rangeStart unset |
| TC-P16 | file guards: 20 MB + 1 byte; `.xlsm`; `.csv`; `.xlsx` that isn't a ZIP; password-protected `.xlsx`; `syn-empty.xlsx` | each rejected with its own message, nothing written to the DB |
| TC-P17 | derived fields: post with reactions 14, comments 0, reposts 0, saves 1, sends 0, impressions 212; impressions 0; ages 6 and 7 days | engagements 15, ER 0.0708 (±1e-4); ER 0; `isMature` false / true |
| TC-P18 | row where in-network + out-of-network = 90 % | imported + warning |

**Storage & merge (`src/db/`, with `fake-indexeddb`)**

| ID | Scenario | Expected |
|---|---|---|
| TC-M01 | import `syn-merge-a` twice | 2nd: "Already imported", DB byte-identical, no new ImportRecord |
| TC-M02 | import a, then b | new 4, updated 10, unchanged 15; total posts = posts(a) + 4; the 5 dropped posts still present with a's metrics |
| TC-M03 | import b, then a (older export later) | a's snapshots added, current metrics stay b's for shared posts |
| TC-M04 | two snapshots with equal `asOf` | the later-imported one becomes current |
| TC-M05 | import a, then `syn-other-author` | warning raised before writing; Cancel (or no answer) → DB unchanged; Import anyway → merged |
| TC-M06 | import that fails half-way (injected error) | DB unchanged (transaction rolled back) |
| TC-M07 | schema migration v1 → v2 on a seeded v1 DB (test migration) | data preserved, new field defaulted |
| TC-D01 | backup → delete all → restore (replace) | deep-equal to the original data |
| TC-D02 | restore merge into a DB with overlapping posts | same merge rules as imports |
| TC-D03 | restore invalid JSON, wrong `app`, `backupVersion: 99`, missing fields | rejected with a message, DB unchanged |
| TC-D04 | delete all | every table empty, settings reset to defaults |

**Analysis (`src/analysis/`)**

| ID | Scenario | Expected |
|---|---|---|
| TC-A01 | windows with E = 2026-10-14 for dates 10-14, 09-15, 09-14, 08-16, 08-15, 07-17, 07-16 | W3, W3, W2, W2, W1, W1, window k = 3 |
| TC-A02 | median of `[]`, `[5]`, `[1,3]`, `[3,1,2]`, `[266,268]` | null, 5, 2, 2, 267 |
| TC-A03 | Spearman: identical order; reverse; with ties `[1,1,2]` vs `[1,2,3]`; constant series | 1, −1, 0.8660 (±1e-4), null (undefined) |
| TC-A04 | change & status: 210 vs 267; 110 vs 100; 109 vs 100; 90 vs 100; 70 vs 100; 5 vs 0 | −21.3 % Slipping; +10 % Growing; Flat; −10 % Slipping; −30 % Down sharply; "–" no chip |
| TC-A05 | outside-network buckets for 0, 40, 40.5, 41, 60, 61, 80, 81, 100 | 0–40, 0–40, 41–60, 41–60, 41–60, 61–80, 61–80, 81–100, 81–100 |
| TC-A06 | rolling median of `[10,20,30,40,50,60,70,80]` | 10, 15, 20, 25, 30, 35, 40, 50 |
| TC-A07 | ISO weeks: 2026-10-11 (Sun) and 2026-10-12 (Mon) | different weeks; Monday starts the week |
| TC-A08 | breakdown group with 2 posts | flagged `tooFew`, excluded from insight rules |
| TC-A09 | best-post tie-break | earlier date wins, then lower `postId` |
| TC-A10 | `includeImmature` on/off on the same dataset | personal median and window metrics switch accordingly; immature posts never counted twice |

**Insights (`src/insights/`, with `tests/builders/`)**

| ID | Scenario | Expected |
|---|---|---|
| TC-I01 | each Phase 1 rule: one dataset just over its threshold, one just under, one below its minimum sample | fires / doesn't fire / doesn't fire (one test per rule and case) |
| TC-I02 | `syn-insights-en.xlsx` | exactly the rule IDs listed in its `.expected.json` |
| TC-I03 | `syn-quiet-en.xlsx` | no `warning` or `critical` insight |
| TC-I04 | ordering of a mixed set | critical → warning → positive → info, ties by `effectSize` |
| TC-I05 | wording lint over all rule templates | no "because", "caused", "due to"; every evidence string contains a sample size |
| TC-I06 | overview selection on `syn-insights-en.xlsx` and on a mixed set | `overviewIds` in its `.expected.json`; at most 2 per family, best positive included, notes only in free slots |

**Share carousel (`src/share/`)**

| ID | Scenario | Expected |
|---|---|---|
| TC-SC01 | reach +30 %, one format | all 5 slides; cover from `reach_growth`; lesson "about as many people"; momentum up +30 %, 13-week series, breakouts and outside-network stats; recap of 8 weeks |
| TC-SC02 | reach −33 %, Reposts at 0.25× | momentum down −33 % with "Fewer people saw…"; lesson "Reposts reached 75 % fewer people…", bars and typical line; cover from `engagement_shift` |
| TC-SC03 | absolute numbers off | relative bar labels, recap stats and top-post detail; momentum without the absolute line |
| TC-SC04 | cover fallbacks | "1 post brought 71 %…" at ≥ 25 %; "What 10 posts taught me…" otherwise; momentum with nothing to compare: "–" |
| TC-SC05 | sample data, titles, closing | sample badge; "What i learned from shipping…"; "My post of Oct 1, 2026"; closing text |
| TC-SC06 | PDF writer | header, `/Count`, one image per page, xref offsets point at their objects |
| TC-SC09 | small samples, formats | "Based on only 2 and 3 posts."; "Not enough posts per format yet…"; without a format insight the type ≥ 10 % away (Videos +20 %) |

### 11.4 Real-export golden tests (Local, `docs/data/tests/`)

These tests run against the owner's own export. Because their expected values describe a real profile, the tests and their values live in `docs/data/tests/` (gitignored) and never enter the public repository; the repository only has the runner (`npm run test:private`, `vitest.private.config.ts`). Expected values were computed on 16–17 Oct 2026 by an independent Python script (not the app's code) and are binding. Decimal values use a tolerance of ±1e-4 (ER) or ±0.0005 (shares, ρ).

| ID | Check |
|---|---|
| TC-R01 | detection & parse: F1, header language, post count, no errors or warnings, unique post IDs, a single author slug |
| TC-R02 | range from the file name; earliest and latest post |
| TC-R03 | total impressions |
| TC-R04 | post-type counts; `Other` 0 |
| TC-R05 | immature and mature posts |
| TC-R06 | personal median and breakout / viral thresholds for both maturity settings |
| TC-R07 | every window metric with `includeImmature = true` |
| TC-R08 | every window metric with `includeImmature = false` (default) |
| TC-R09 | best post per window |
| TC-R10 | concentration (top-1, top-5), full history, all posts |
| TC-R11 | Spearman outside-network share vs impressions, mature and all posts |
| TC-R12 | type medians, full history, mature; types with too few posts |
| TC-R13 | outside-network buckets |
| TC-R14 | hashtag openers |
| TC-R15 | posting rhythm in the current window |
| TC-R16 | weekday counts |
| TC-R17 | videos with views; longest watch time |
| TC-R18 | KPI status chips, current vs previous window |
| TC-R19 | which insights fire and which stay quiet (default settings) |
| TC-SC07 | share carousel: every slide, with and without absolute numbers |
| TC-R20 | full pipeline timing: parse + merge < 500 ms in Node |

| ID | Local merge check | Expected |
|---|---|---|
| TC-M08 | `scripts/make-derived.ts` writes `docs/data/derived/next.xlsx` from the real file: drop the 10 oldest posts, raise impressions of the 20 newest by 10 %, add 3 new posts dated after 2026-10-14, range end 2026-10-21. Import real file, then derived. | the 3 added posts are new, the 20 changed posts updated, all others unchanged; the 10 dropped posts keep their metrics; latest export date 2026-10-21 |

### 11.5 End-to-end tests (CI, Playwright on Chromium; TC-E01, TC-E02, TC-E09 and TC-S01 also on WebKit; Firefox before release)

| ID | Flow | Expected |
|---|---|---|
| TC-E01 | first run → "Try with sample data" | dashboard with sample banner; "Remove sample data" empties the DB |
| TC-E02 | import `syn-basic-en.xlsx` via file picker and via drag-and-drop | summary dialog with the counts from `.expected.json`; overview KPIs match |
| TC-E03 | import `syn-merge-a` then `syn-merge-b` | summary new 4 / updated 10 / unchanged 15; table row count correct |
| TC-E04 | import the same file twice | toast "Already imported" |
| TC-E05 | import `syn-unknown-headers.xlsx`, `syn-empty.xlsx`, a `.csv`, a renamed `.txt` | friendly error each; unknown headers lists found headers; "Copy details" copies them |
| TC-E06 | set window, post-type chip and "include growing posts"; reload | same view restored from the URL; URL contains no post data |
| TC-E07 | posts table: sort by impressions, search a title word, CSV export | order correct; filtered count correct; CSV has the visible rows and columns |
| TC-E08 | click an insight | the related filter is applied |
| TC-E09 | backup → delete all (in-page confirmation) → restore | data and view identical to before |
| TC-E10 | load app, go offline, reload | app and data fully usable |
| TC-E11 | PWA | manifest valid, service worker active, install prompt criteria met |
| TC-E12 | theme toggle light/dark/system | applied and persisted |
| TC-E13 | 360 px viewport on every screen | no horizontal page scroll |
| TC-E14 | keyboard-only: import, switch tabs, open insight, sort table | possible with visible focus |
| TC-E15 | axe-core on every screen, light and dark | no serious or critical violations |
| TC-SC08 | Share (Alpha) on `syn-insights-en.xlsx`, Chromium and WebKit | 5 slides, the falling momentum included; theme changes the slide background; the closing slide has no checkbox (always included); momentum unticked → PDF with 4 image pages |

### 11.6 Security, performance and build checks

| ID | Check | Env | Expected |
|---|---|---|---|
| TC-S01 | record every request during TC-E01–E12 | CI | every request URL has the app's own origin (fails on the first other origin) |
| TC-S02 | built `dist/index.html` | CI | contains the exact CSP `<meta>` from §10.2 |
| TC-S03 | `netlify.toml` | CI | CSP header equals the meta policy plus `frame-ancestors 'none'`; other §10.2 headers present |
| TC-S04 | import `syn-xss.xlsx` | CI | title and post type shown as literal text; no dialog, no injected element |
| TC-S05 | `git ls-files` | CI | no `*.xlsx/xls/xlsm/csv` outside `fixtures/synthetic/`, nothing under `docs/data/` |
| TC-S06 | ESLint | CI | no `dangerouslySetInnerHTML`, no `eval`, no `new Function` |
| TC-S07 | deploy preview smoke test (`scripts/check-deploy-headers.ts`, run by `deploy-preview.yml` on every successful Netlify deploy) | after Netlify is connected | response headers contain the CSP and the other `netlify.toml` headers |
| TC-N01 | import `syn-large-1000.xlsx` in the browser | CI | < 4 s in CI (budget × 2 for shared runners); < 2 s when run locally |
| TC-N02 | table with `syn-large-5000.xlsx` | CI | < 100 DOM rows rendered; scroll to the end works; sort < 100 ms |
| TC-N03 | `size-limit` | CI | initial JS < 350 KB gzipped; SheetJS and ECharts in separate lazy chunks |
| TC-N04 | Lighthouse CI on `vite preview` | CI | Performance, Accessibility, Best Practices ≥ 90 |
| TC-B01 | `tsc --noEmit`, ESLint, Prettier check, `vite build` | CI | all pass with zero errors |

### 11.7 CI pipeline
GitHub Actions `ci.yml` on every push and PR: install (Node 24) → typecheck → lint → unit tests with coverage gate → build → size-limit → e2e (Chromium) → Lighthouse CI. Netlify builds the production site from `main` and a preview per PR. `main` is protected: merge only with green CI.

---

## 12. Delivery phases & acceptance criteria

### Phase 1: MVP (target: usable by the owner and 10 beta testers)
Scope: F1 import (EN headers + DE/FR placeholders), IndexedDB storage with merge, Overview, Timeline, Breakdowns (type, outside-network, rhythm), Posts table, Insights (rules in §7 except topic rules), sample data, backup/restore/delete, light/dark theme, PWA install + offline, Netlify deployment, English UI, share carousel (Alpha).

Acceptance criteria (each maps to tests in §11):

| # | Criterion | Tests |
|---|---|---|
| 1 | Importing the owner's real export reproduces every value of the independent reference computation (§11.4), including the insights in TC-R19 | TC-R01–R20 |
| 2 | Re-importing the same file changes nothing and shows "Already imported" | TC-M01, TC-E04 |
| 3 | Importing an overlapping second export updates metrics and adds new posts without duplicates | TC-M02–M04, TC-M08, TC-E03 |
| 4 | All Phase 1 insights fire correctly on the synthetic fixtures (and not on the quiet one) | TC-I01–I06 |
| 5 | No request to any other origin during a full e2e session; CSP enforced | TC-S01–S04, TC-S07 |
| 6 | App installs as PWA and works offline | TC-E10, TC-E11 |
| 7 | Lighthouse, bundle, performance and accessibility thresholds from §10.3 met | TC-N01–N04, TC-E13–E15 |
| 8 | Real export data never committed | TC-S05 |
| 9 | README explains export steps, privacy model, local development, tests (incl. `docs/data/` for private tests) and Netlify deployment | review |

### Phase 2: Loyalty & reach
German UI (Swiss-neutral German: use "ss", not "ß"), F2 import (after real sample), topics (manual + keyword + suggestions) and topic insights, share carousel beyond the Alpha (design, more slide types), language heuristic, weekday and video breakdowns, import history management (delete single import → recompute), rename post titles locally, landing page section with privacy explainer.

### Phase 3: Pro & scale (each item needs a separate decision)
- Optional AI coach: user supplies their own API key (stored locally, never sent anywhere except the chosen AI provider on explicit action); features: topic auto-tagging, "why did this post work" explanations, draft review against the user's own winning patterns.
- Multiple profiles (coaches/ghostwriters), comparison and PDF report.
- Official LinkedIn API integration, only if partner approval is granted.
- Optional encrypted sync (opt-in).

---

## 13. Product & design review (decisions and risks)

Review notes from a product-management and software-design perspective. These decisions are already reflected above.

| # | Topic | Finding | Decision / mitigation |
|---|---|---|---|
| 1 | **Export format volatility** | LinkedIn changes export columns and labels without notice; labels differ by interface language. | Header registry with synonyms, detection threshold, graceful "unknown format" error with copyable details, fixture-driven tests. Treat parser as the product's most critical module. |
| 2 | **Metrics are cumulative** | A post published yesterday has fewer impressions only because it's young; this biases the "last 30 days" downward. | `isMature` flag, exclude posts < 7 days by default, show them as "still growing". Snapshots keep growth history. |
| 3 | **Fixed thresholds don't scale** | "1,000 impressions" is huge for one user and tiny for another. | Breakout/viral thresholds relative to the user's own median, configurable. |
| 4 | **Skewed data** | In a real export one viral post can produce most of all impressions; means lie. | Medians everywhere, viral split in charts, concentration metric. |
| 5 | **Causation claims** | Users may over-read insights. | Careful wording (lint test TC-I05), sample sizes shown, "too few posts" states. |
| 6 | **Trademark** | Using LinkedIn's name/logo in the product name risks takedown. The public repository is named `post-pulse`. | Product name stays neutral ("Post Pulse"), "for your LinkedIn analytics export" tagline, non-affiliation footer, no LinkedIn assets. **The public repository uses the neutral name `post-pulse` (18 Oct 2026).** Netlify site name SHOULD be neutral (`post-pulse`). |
| 7 | **Privacy as moat** | Competing tools require logins or uploads. | Zero-backend architecture enforced by CSP and an e2e test; say it on the welcome screen. |
| 8 | **Data loss** | Browser storage can be cleared by the user or the browser. | Prominent backup reminder after each import (dismissible), `navigator.storage.persist()` request, restore flow. |
| 9 | **Titles from URLs** | The export lacks post text; URL slugs are truncated (e.g. `How we plan our quart`) and sometimes only hashtags. | Best-effort title, "Hashtag opener" label, allow user to rename a post's title locally (Phase 2). |
| 10 | **SheetJS supply chain** | The npm `xlsx` package is stale and has a known vulnerability. | Install pinned version from SheetJS's official CDN tarball; document in README. |
| 11 | **Bundle size** | ECharts and SheetJS are large. | Lazy-load both; modular ECharts imports; budget enforced in CI (`size-limit`). |
| 12 | **Growth loop** | A private tool spreads slowly. | The share carousel (Alpha in Phase 1) carries the app URL on every slide and is the main acquisition channel. |
| 13 | **Hosting** | GitHub Pages from a private repo needs a paid plan and can't set HTTP headers. | Netlify: free for this use, real CSP headers, deploy previews per PR. |
| 14 | **Real data in the repo** | Real exports are needed for tests but contain personal data. | `docs/data/` gitignored, including the real-export tests and their expected values (§11.4); they skip when the files are missing; CI guard TC-S05. |

---

## 14. Decisions

| Decision | Status | Value |
|---|---|---|
| Hosting | **Decided** (16 Oct 2026) | Netlify via Git integration |
| Repository name | **Decided** (18 Oct 2026) | Public repository `post-pulse`; the earlier private repository `linkedin-pulse` is archived and still builds the live example |
| Repository visibility & licence | **Decided** (18 Oct 2026) | Public repository, PolyForm Noncommercial 1.0.0 (source available, no commercial use); chosen instead of AGPL-3.0 on the same day |
| Real test data location | **Decided** (16 Oct 2026) | `docs/data/`, gitignored |
| Product name & domain | Open (default "Post Pulse") | any neutral name without "LinkedIn"; change before Phase 2 launch |
| Business model | Open (default free, open core) | Free core + paid Pro (Phase 3 AI coach) |
| Default UI language | Open (default English) | German first for DACH launch |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| Impressions | How often the post was shown (LinkedIn's count) |
| Members reached | Unique members who saw the post |
| Outside-network share | % of impressions from people who are not 1st-degree connections/followers |
| Engagements | reactions + comments + reposts + saves + sends |
| Engagement rate (ER) | engagements ÷ impressions |
| Personal median | median impressions per post over the full history |
| Breakout post | impressions ≥ 3× the personal median (default) |
| Viral post | impressions ≥ 10× the personal median (default) |
| Window | a 30-day period counted back from the latest export date, including its last day |
| Mature post | a post at least 7 days old at the latest export date |
