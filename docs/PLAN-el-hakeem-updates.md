# El Hakeem updates — implementation plan

Approved for implementation on `feature/el-hakeem-arabic-branding-auth`. The owner accepted the open questions below, with one change: reads are public unless `REQUIRE_AUTH_FOR_READS=true` (see section 3).

The app today is a single-operator EGX tracker: an Android forwarder posts Thndr notifications to `POST /api/webhook/notification` with `x-api-key`, Express stores and parses them, and a React dashboard reads the same key from `VITE_API_KEY` (including on the SSE URL). UI copy is hard-coded English. The sidebar brand is "EGX Tracker". There is no user model.

Decisions below assume that shape. Where the owner should overrule one, it is listed under [Open questions](#open-questions).

---

## 1. Arabic as the default UI language

### Library

Use **`i18next` + `react-i18next`**.

Why this pair, for this codebase:

- The dashboard is React 18 + Vite 6 with no existing i18n. `useTranslation()` drops into the current function components without a compiler plugin or a second render pipeline.
- Arabic pluralization is not English-style "1 vs other". i18next already applies CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`), which the inbox and dashboard need (`failedCount`, trade counts).
- Interpolation (`{{count}}`, `{{symbol}}`) covers the sentences that are built by concatenation today (`Dashboard.jsx` failed-notification banner, `Trades.jsx` confirm dialog, inbox reparse summary).
- It does not depend on the browser's `Accept-Language`. The product requirement is Arabic by default even on an English OS, so we will **not** add `i18next-browser-languagedetector`. A few lines that read `localStorage` are clearer than configuring the detector to ignore `navigator`.

Considered and rejected:

- A hand-rolled React context plus two JSON files. Fine for a handful of labels, and it avoids a dependency, but we would reimplement plurals, interpolation, and the missing-key fallback. The string surface here is the whole dashboard (four pages, dialogs, tables, chart, empty states, confirms).
- `react-intl` / FormatJS. Strong ICU support, heavier message syntax, and more boilerplate than this app needs.
- LinguiJS. Macro extraction is a build-step we do not need for two locales maintained in-repo.

Pin current majors at install time (`i18next` 25.x, `react-i18next` 15.x, or whatever `npm install` resolves then). One namespace, `translation`. Two catalogues is enough; do not split namespaces.

### Approach

Default language is `ar`, direction `rtl`. English is `en` / `ltr`. The choice is the only persisted preference.

Persistence key: `localStorage['el-hakeem.lang']`, values `'ar'` or `'en'` only. Anything else is ignored and Arabic is used. Do not consult `navigator.language`.

Avoid a flash of the wrong direction. `frontend/index.html` ships as `lang="ar"` `dir="rtl"`, and a tiny inline script (before the module) applies the stored language to `<html>` before React paints. A `LocaleSync` effect then keeps `document.documentElement.lang`, `.dir`, and `document.title` aligned with `i18n.language` after the switcher runs.

Initialize i18next once in `frontend/src/i18n/index.js` with `fallbackLng: 'ar'`, `supportedLngs: ['ar', 'en']`, and `returnNull: false`. Wrap the tree in `I18nextProvider` from `main.jsx` (outside the router, inside `QueryClientProvider` is fine).

String extraction: every user-visible string in `frontend/src` moves to the catalogues. Keys are grouped by surface: `brand.*`, `nav.*`, `dashboard.*`, `positions.*`, `trades.*`, `inbox.*`, `login.*`, `common.*`, `enums.*`, `errors.*`. No hard-coded UI sentences left in JSX.

What stays untranslated on purpose:

- Notification title and body, parse errors stored on `RawNotification`, and rule `id` / `description` / `pattern` from `rules.js`. Those are data. The inbox already sets `dir="auto"` on them; keep that so Arabic notifications still shape correctly inside an English UI and the reverse.
- Machine values: `BUY` / `SELL` sent to the API, CSV column keys, query param names.
- The `datetime-local` value produced by `toLocalInputValue`. The HTML control requires `yyyy-MM-dd'T'HH:mm`. Only the visible label is translated.

Enums shown as badges (`BUY`, `SELL`, `PARSED`, `FAILED`, `MANUAL`, …) render through `enums.*`. The underlying value is unchanged.

API errors the client displays (`ErrorBanner` uses `error.message`) gain a stable `code` on the JSON body for errors we own (`UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `VALIDATION_FAILED`). The client maps `code` to `errors.*`. Zod `details` stay as the server wrote them (English field messages) under a translated heading. Unknown messages fall back to `error.message`, which is how stored parser sentences remain visible.

`window.confirm` copy in `Trades.jsx` and `Inbox.jsx` goes through `t()`.

### Locale formatting

`frontend/src/lib/format.js` is the only formatting module. Today it freezes `Intl.NumberFormat('en-EG')` and `date-fns-tz` patterns `dd MMM yyyy HH:mm` at module load, so month names are always English.

Change `money`, `quantity`, `price`, `percent`, `dateTime`, and `dateOnly` to take the active language (read from i18next, or pass it in so the functions stay pure and components re-render on language change via `useTranslation`).

| Concern | Decision |
| --- | --- |
| Number locale | `ar-EG-u-nu-latn` for Arabic, `en-EG` for English |
| Digits | Latin digits in both languages (`nu-latn`). Arabic-Indic digits fight tickers and the parser's ASCII normalization. |
| Currency | Keep the current "grouped number, no symbol in every cell" behavior. Where the UI says `EGP` (inbox fill line, chart tooltip, trade dialog net), use a translated `common.currency` (`ج.م` / `EGP`). Do not switch the whole app to `style: 'currency'`, which would change every stat. |
| Time zone | Stay `Africa/Cairo`. |
| Dates | `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'`, `hourCycle: 'h23'`, and the locale above, instead of `date-fns` format strings. `date-fns` Arabic month names are fine, but its digits depend on the locale build; `Intl` plus `nu-latn` is one mechanism for numbers and dates. `date-fns-tz` can go if nothing else imports it. |
| Percents | Keep the explicit `+` / `-` sign the P&L colors depend on. Format the absolute number with `Intl`, then append `%` (or the Arabic percent sign via `Intl` percent style if it stays Latin-digit). |
| `toLocalInputValue` | Unchanged ASCII format. |

Bidi isolation: symbols (`COMI`), prices, and quantities are Latin. Inside Arabic sentences (`{qty} @ {avg}` on the dashboard, the inbox fill line, confirm dialogs), wrap each Latin token in `<bdi>` or `dir="ltr"`. Without that, the `@` and the digits reorder. Numeric table cells get `dir="ltr"` as well so a minus sign stays on the left of the number.

### RTL layout

Tailwind 4 already understands CSS logical properties. Prefer those over `rtl:` duplicates so one class list serves both directions.

Sweep physical utilities that encode direction:

| Current | Replacement | Where |
| --- | --- | --- |
| `border-r` on the sidebar | `border-e` | `Layout.jsx` |
| `text-left` on table headers | `text-start` | `Positions.jsx`, `TradesTable.jsx` |
| `text-right` on numeric columns and the top-positions value block | `text-end` | `Positions.jsx`, `TradesTable.jsx`, `Dashboard.jsx`, mark-price input |
| `ml-1`, `ml-1.5` | `ms-1`, `ms-1.5` | `Positions.jsx`, `Inbox.jsx`, `TradeFormDialog.jsx` |
| `justify-end` on row actions | keep; it follows the flex axis, which flips with `dir` | action columns |

Do not add `flex-row-reverse`. With `dir="rtl"` on `<html>`, the sidebar (first flex child) moves to the right on its own. That is the behavior to verify, not to reimplement.

`uppercase` plus `tracking-wide` on `CardHeader` and table headers letter-spaces Arabic for no benefit (Arabic has no case). Drop both. English headings become the existing sentence/label text at the same size and weight. That is a small type change, not a new visual system.

Charts: Recharts does not mirror with `dir`. Wrap `PnlChart`'s chart box in `dir="ltr"` so the time axis, Y axis, and SVG number text stay stable. Tooltip strings (`Cumulative`, `That day`, the empty state) come from i18n. Axis tick formatters keep using `dateOnly` / `money`, so they follow the locale while the SVG stays LTR. This is the reliable option; flipping `YAxis orientation` by hand is easy to get wrong and does not fix tooltip or tick bidi.

Tables: column order follows `dir` (symbol column is first in DOM, so it is on the right in Arabic). Numeric columns use `text-end`. Horizontal scroll remains `overflow-x-auto`.

Language switcher: a compact `ع` / `EN` control, visible in the desktop sidebar (under the wordmark) and in the mobile header (`ms-auto` so it sits at the end). It calls `i18n.changeLanguage`, writes `localStorage`, and updates `<html>`. No full reload.

### Files to add

- `frontend/src/i18n/index.js` — init, `SUPPORTED_LANGS`, `persistLanguage`, `applyDocumentLocale`
- `frontend/src/i18n/locales/ar.json`
- `frontend/src/i18n/locales/en.json`
- `frontend/src/components/LanguageSwitcher.jsx`

### Files to change

- `frontend/package.json` — add `i18next`, `react-i18next`; drop `date-fns` and `date-fns-tz` if `format.js` no longer imports them
- `frontend/index.html` — `lang` / `dir`, inline locale script, title (branding section)
- `frontend/src/main.jsx` — provider
- `frontend/src/lib/format.js` — locale-aware formatters
- `frontend/src/index.css` — logical properties if any utility lives here; font (branding section)
- `frontend/src/components/Layout.jsx`
- `frontend/src/components/ui.jsx` — drop uppercase/tracking on `CardHeader`
- `frontend/src/components/TradesTable.jsx`
- `frontend/src/components/TradeFormDialog.jsx`
- `frontend/src/components/PnlChart.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Positions.jsx`
- `frontend/src/pages/Trades.jsx`
- `frontend/src/pages/Inbox.jsx`
- `frontend/src/components/StatCard.jsx` — no copy of its own; callers pass translated labels. No change unless a physical class sneaks in.

`StatCard` stays presentational. Do not push `t()` into it.

### Key decisions

1. **i18next, not a custom dictionary.** Plurals and interpolation are the part worth the dependency. The detector package is the part we skip, because Arabic-by-default would fight it.
2. **Latin digits in the Arabic UI.** Prices, quantities, and tickers stay visually compatible with the English UI and with CSV export. Grouping and month names still follow the locale.
3. **Logical Tailwind properties, chart isolated as LTR.** One class list, no parallel `rtl:` stylesheet. Recharts stays LTR on purpose.
4. **Data is not UI chrome.** Notification text and parser diagnostics are not catalogue strings.

### Risks

- A missed hard-coded string. Mitigation: after the sweep, search `frontend/src` for JSX text and for English literals in `placeholder`, `title`, `aria-label`, and `window.confirm`. Catalogues should be the only UI copy.
- `Intl` month names differ slightly from the current `dd MMM yyyy` (`15 Aug 2026` vs `15 Aug 2026` with a different month abbreviation, or a comma). Accept the `Intl` form; do not hand-translate month abbreviations.
- First paint vs stored English. The inline script must use the same key and the same allow-list as `i18n/index.js`.
- Arabic letter-spacing and `uppercase` if any call site is missed. Check card headers and both tables in Arabic.
- Flex sidebar side. Confirm in the browser that `dir="rtl"` puts the aside on the right without `flex-row-reverse`, and that the mobile header still scrolls.

---

## 2. Branding as El Hakeem / الحكيم

### Approach

Rename the product in the surfaces a person sees. Keep the slate-950 / sky accent palette, the sidebar layout, the cards, and the lucide icons. This is a wordmark and metadata change, not a redesign.

The localized name comes from i18n:

- `brand.name`: `الحكيم` / `El Hakeem`
- `brand.tagline`: a short line in the sidebar, replacing "Thndr notification pipeline" (`متابعة صفقات ثاندر` / `Thndr trade pipeline`)

The mark next to the name is an Arabic letter, in both languages: a rounded square using the existing sky tint (`bg-sky-500/15`, `text-sky-300`) with `ح`. It replaces the lucide `Activity` icon in the sidebar and the mobile header. The letter is the logo, so it does not swap to a Latin "H" in English. That keeps one asset and stays inside the current color tokens.

Favicon: `frontend/public/favicon.svg`, same mark (sky `ح` on `#0b1120`, the `--color-surface` already in `index.css`). Linked from `index.html`. No bitmap, no extra icon font.

Document title and meta follow the language. `index.html` defaults to Arabic (`<title>الحكيم</title>`, a description meta that the locale effect updates). `LocaleSync` sets `document.title` to `t('brand.name')` and writes the description meta. No `react-helmet`; one effect is enough for a single title.

Font: the body stack already names `Noto Naskh Arabic`, but nothing loads it, and Naskh is a text face that would clash with this sans UI. Add `@fontsource/ibm-plex-sans-arabic` (weights 400 and 600, self-hosted by the package, no Google CDN) and set:

```css
font-family: 'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif;
```

IBM Plex Sans Arabic covers Latin as well, so English and Arabic share one face. The rest of the theme (radius, borders, sky buttons) stays.

Package names, since nothing is published (`"private": true`):

- `frontend/package.json` name → `el-hakeem-frontend`
- `backend/package.json` name → `el-hakeem-backend`, description mentions El Hakeem and Thndr
- The matching `name` fields at the top of both `package-lock.json` files only. Do not regenerate the lockfiles for a rename.

README title becomes `El Hakeem`, with the first paragraph still explaining that it tracks EGX fills from Thndr notifications. Update the Windows firewall example name, the CSV download prefix in `Trades.jsx` (`el-hakeem-trades-YYYY-MM-DD.csv`), and the troubleshooting row that mentions `VITE_API_KEY` (that row changes again in section 3). Leave the MySQL database name `egx` and `DATABASE_URL` alone. Renaming the schema would be a migration with no product benefit.

Do not rename parser symbols, the `EGX` ticker suffix in `rules.js`, or route paths.

### Files to add

- `frontend/public/favicon.svg`

### Files to change

- `frontend/index.html` — title, description, favicon, `theme-color` `#0b1120`
- `frontend/src/index.css` — font family; import the font package from `main.jsx` (fontsource's CSS import belongs next to `index.css`)
- `frontend/src/main.jsx` — font CSS import
- `frontend/src/components/Layout.jsx` — wordmark, tagline, drop `Activity` if unused
- `frontend/src/i18n/locales/ar.json` and `en.json` — `brand.*`
- `frontend/src/pages/Trades.jsx` — CSV filename
- `frontend/package.json`, `backend/package.json`, both lockfile `name` fields
- `README.md` — title, intro, firewall rule label, any "EGX Trade Tracker" product-name mentions. Keep EGX and Thndr as the market and the source app.

### Key decisions

1. **Same layout and palette.** Sky on slate already reads as a trading tool. The new identity is the `ح` mark plus the translated name.
2. **The mark stays Arabic in the English UI.** One favicon, one component, no second logo.
3. **IBM Plex Sans Arabic via fontsource.** Matches a sans dashboard, works offline, and replaces an unloaded Naskh name in the stack.
4. **Do not rename the database or HTTP routes.** Branding that would force the owner to migrate data or retarget the phone is out of scope.

### Risks

- Font load shifts the sidebar a few pixels. Check both breakpoints after adding the face.
- `package-lock.json` name edits must not touch integrity hashes. Edit only the root `"name"` entries.
- README still has to tell the owner how the phone works. Branding must not bury the webhook section.

---

## 3. Authentication for recording trades

### Requirement, restated against the current routes

Today every `/api/*` route except the webhook's own router sits behind `requireApiKey` (`backend/src/app.js`). The webhook applies the same middleware itself. The dashboard bakes `VITE_API_KEY` into the bundle (`frontend/src/api/client.js`) and into `GET /api/stream?apiKey=`, because `EventSource` cannot set headers. CORS is an allow-list with `credentials: false`. `express-rate-limit` is already a dependency and already guards the webhook (120/minute).

"Nobody records trades directly unless authenticated" means an anonymous caller cannot call the mutating routes. Two callers remain valid:

1. A logged-in dashboard user (cookie).
2. Any client that still presents `x-api-key` equal to `WEBHOOK_API_KEY`, including the phone.

The phone contract does not change: `POST /api/webhook/notification` and `GET /api/webhook/ping`, header `x-api-key`, same body, same status codes. `backend/scripts/simulate.js` keeps working without a user session.

### Route policy

`REQUIRE_AUTH_FOR_READS` (boolean, default `false`) is validated in `env.js`. One middleware, `requireAccess`, is mounted on the dashboard routers. It classifies the request once: writes always call `requireUserOrApiKey`; reads call it only when the flag is true. No per-route copies.

`POST /api/parse/preview` is a **read**. It does not persist a notification or a trade; it runs the rule table over text the caller already has. Grouping it with reads keeps the parser playground usable in the default open dashboard. When the flag is true it is gated with the other reads.

| Route | `REQUIRE_AUTH_FOR_READS=false` (default) | `REQUIRE_AUTH_FOR_READS=true` |
| --- | --- | --- |
| `GET /health` | Public | Public |
| `GET /api/auth/config` | Public. Returns `{ requireAuthForReads }` so the UI adapts without a rebuild. | Public |
| `POST /api/auth/login` | Public, rate-limited | Public, rate-limited |
| `POST /api/auth/logout` | Public. Always clears the cookie. | Public |
| `GET /api/auth/me` | Session cookie only. The API key is not a user. | Session cookie only |
| `POST /api/webhook/notification`, `GET /api/webhook/ping` | `x-api-key` only, both modes. A session cookie is not a substitute. | Same |
| `GET` trades, portfolio, notifications, instruments, parse rules, and `GET /api/stream` | Public | Session **or** API key |
| `POST /api/parse/preview` | Public (a read; see above) | Session **or** API key |
| `POST` / `PATCH` / `DELETE /api/trades` | Session **or** API key | Session **or** API key |
| Reparse, reparse-failed, reparse-all, notification `DELETE` | Session **or** API key | Session **or** API key |
| `PATCH /api/instruments/:code` | Session **or** API key | Session **or** API key |

`requireApiKey` stays on the webhook only. `?apiKey=` remains a valid key source for non-browser clients.

### Session mechanism

**Signed JWT in an httpOnly cookie**, library **`jose`** (ESM, no native build; this backend is `"type": "module"`).

Cookie:

- Name: `el_hakeem_session`
- `HttpOnly; Path=/; SameSite=Lax`
- `Secure` only when `NODE_ENV=production`
- Max-Age 7 days
- No `Domain` attribute (host-only)

Claims: `sub` (user id), `email`, `tv` (token version), `exp`. Algorithm HS256, secret `JWT_SECRET` (at least 32 characters).

Why a cookie JWT, given SSE and CORS:

- `EventSource` cannot send `Authorization` or `x-api-key`. It can send cookies on a cross-origin request when constructed with `{ withCredentials: true }`, and the `cors` package will emit `Access-Control-Allow-Credentials: true` plus the specific allow-listed origin once `credentials: true`. The dashboard origin is already allow-listed (`CORS_ORIGINS`, default `http://localhost:5173`).
- Frontend (`:5173`) and API (`:4000`) are different origins and the **same site** (port is not part of schemeful site). `SameSite=Lax` is sent on those `fetch` and `EventSource` calls. `SameSite=None` would force `Secure`, which breaks the LAN `http://192.168.x.x` setup the README documents.
- The cookie removes `?apiKey=` from the dashboard's stream URL. That query value currently lands in access logs, the address bar, and `pino-http`'s URL. pino already redacts the header and not the query string.
- A Bearer token in `localStorage` would be readable by any XSS and still could not be attached to `EventSource` without putting it back on the query string. That recreates today's leak.

Why not a server session table:

- One seeded operator, no server farm. A session row plus cleanup does not buy much over a 7-day cookie.
- Logout clears the cookie. A copied token remains valid until `exp`. That is acceptable here and is called out as a risk.
- `User.tokenVersion` is the revocation hook: verification loads the user by `sub` and rejects a mismatched `tv`. No password-change UI in this pass, but the column is there so a later password change can bump it without a new migration. The lookup is once per REST call and once per SSE connection, not per event.

CSRF: state-changing dashboard calls are cross-origin JSON (`Content-Type: application/json`), which triggers a CORS preflight, and the allow-list rejects other origins. `SameSite=Lax` blocks cookies on cross-site POSTs. That combination matches how this app is deployed (same host, two ports, or one LAN IP). Do not add a CSRF token unless the dashboard and API move to different sites. If they do, the cookie must become `SameSite=None; Secure` and the owner must serve HTTPS. Document that assumption in the README.

CORS change in `createApp`: `credentials: true`. Keep the existing origin callback, including "no Origin header is allowed" so the phone and curl are unaffected. Credentialed browser requests still need an allow-listed `Origin`.

Also redact `req.headers.cookie` and `req.query.apiKey` in the existing pino redact list.

### User model and seed

Prisma model:

```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique @db.VarChar(191)
  passwordHash String   @db.VarChar(255)
  tokenVersion Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

New migration folder `backend/prisma/migrations/<timestamp>_add_user/migration.sql`, created with Prisma against this schema. It only adds `User`. `RawNotification`, `Trade`, and `Instrument` stay as they are. Existing rows are not rewritten.

Password hashing: **`bcryptjs` at cost 12**, not `argon2`.

- argon2id is the stronger KDF, and its npm package ships native bindings. The README's setup path is Windows (firewall snippet, LAN IP). Native modules are a common `npm install` failure there without Visual Studio build tools.
- `bcryptjs` is pure JavaScript, which matches a backend that otherwise has no native addons.
- Cost 12 is appropriate for one user on login, not on every request (verification is a JWT check plus a primary-key read, not a bcrypt compare).

Compare with `bcrypt.compare`. If no user matches the email, compare against a dummy hash created once at startup so the missing-user path takes similar time. Login errors are always `401` with `code: 'INVALID_CREDENTIALS'` and a generic English `error` string. Do not reveal whether the email exists.

Environment, validated in `backend/src/config/env.js` with zod, same style as `WEBHOOK_API_KEY`:

| Variable | Local default (in `.env.example` and the README) | Rule |
| --- | --- | --- |
| `JWT_SECRET` | `dev-only-change-this-secret-key-32b` | Min 32 characters. In `production`, reject this default. |
| `SEED_USER_EMAIL` | `owner@localhost` | `z.string().email()`, stored lowercased. |
| `SEED_USER_PASSWORD` | `el-hakeem-dev` | Min 8 characters. In `production`, min 12 and reject `el-hakeem-dev`. |
| `REQUIRE_AUTH_FOR_READS` | `false` | Boolean. `true` / `false` / `1` / `0`. Default false when unset. |

Development is allowed to boot with those documented defaults so `cp .env.example .env` still works after the owner sets `DATABASE_URL` and a real `WEBHOOK_API_KEY` (that key still refuses `change-me` in every environment).

Seed behavior, in `ensureSeedUser()` called from `backend/src/index.js` after the `SELECT 1` check and before `listen`:

- If `User` is empty, insert one row: email from `SEED_USER_EMAIL`, hash of `SEED_USER_PASSWORD`. Log the email, never the password.
- If any user exists, do nothing. Changing the env password later must not silently reset a password on the next restart.
- Failure to seed exits the process, same as a failed database check.

No signup route and no password-change route in this pass.

### Endpoints

Auth routes live in `backend/src/routes/auth.routes.js` and are mounted at `/api/auth` **before** the dashboard gate, and not behind `requireApiKey`.

`GET /api/auth/config` is public and returns `{ requireAuthForReads }`. The frontend reads this at runtime. Changing the env var and restarting the backend is enough; Vite does not embed the flag.

`POST /api/auth/login`

- Body zod: `{ email: z.string().trim().email().max(191), password: z.string().min(1).max(200) }`
- Rate limit: 10 requests / 15 minutes / IP, `express-rate-limit` with the same `standardHeaders: 'draft-7'` style as the webhook limiter. `trust proxy` is already `1`, so `req.ip` is correct behind one proxy.
- Success `200`: `{ email }` and `Set-Cookie`. Do not return the token in JSON.
- Failure `401`: `{ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }`
- Over limit `429`: `{ error: 'Too many login attempts', code: 'RATE_LIMITED' }`

`POST /api/auth/logout`

- Clears the cookie (`Max-Age=0`, same `Path` and `SameSite`). `204` empty body.

`GET /api/auth/me`

- Valid cookie: `200 { email }`
- Otherwise `401 { error: 'Unauthenticated', code: 'UNAUTHENTICATED' }`

`requireUserOrApiKey`:

1. If the cookie verifies and `tv` matches `User.tokenVersion`, set `req.auth = { kind: 'user', userId }` and continue.
2. Otherwise accept the existing API key sources (`x-api-key`, `Authorization: Bearer`, `?apiKey=`). `?apiKey=` stays for non-browser clients. The dashboard will stop sending it. On success, `req.auth = { kind: 'apiKey' }`.
3. Otherwise `401` with `code: 'UNAUTHENTICATED'`.

A bad cookie does not fail the request when a valid API key is also present, so scripts are not broken by a stray cookie.

Extend `HttpError` responses with an optional `code` so the client can translate them. Existing `{ error, details }` shape stays; `code` is additive.

### Frontend

The normal dashboard stops reading `VITE_API_KEY`.

`frontend/src/api/client.js`:

- Delete `API_KEY` and the `x-api-key` header.
- `credentials: 'include'` on every `fetch`, including login, logout, and `/health` (harmless).
- Stream URL is `${API_URL}/api/stream` with no query. `useLiveUpdates` uses `new EventSource(streamUrl, { withCredentials: true })`.
- `api.login`, `api.logout`, `api.me`, `api.authConfig`.

Session state is the TanStack Query `['me']`, `retry: false`. A 401 from `/api/auth/me` is an anonymous session (`null`), not a hard error. `['auth-config']` holds `{ requireAuthForReads }`. Do not add a second auth context.

Routing in `App.jsx`:

- `/login` renders `Login.jsx` with no sidebar. The language switcher and wordmark are on the page. A signed-in user is sent back to the previous path or `/`.
- Every other route is nested under `RequireAuth`, then `Layout`.
- `RequireAuth` waits for config and session. If `requireAuthForReads` is true and there is no session, it redirects to `/login`. If the flag is false, it renders the dashboard for anonymous visitors.
- Write controls (add, edit, delete trade, mark price, reparse, delete notification) render only when `useCanWrite()` is true (a session email). Otherwise they are replaced by a sign-in prompt. The parser playground stays available in open-read mode because preview is a read.
- Sign in and sign out are visible in the sidebar and the mobile header in both modes.
- `useLiveUpdates` stays inside `Layout`. `EventSource` uses `withCredentials: true` and no `apiKey` query. In open-read mode the stream connects without a cookie.
- After login, seed the `me` cache and navigate to the previous path or `/`.
- A later `UNAUTHENTICATED` response clears `me`. In required mode the guard then redirects. In open mode the write controls disappear.

`Login.jsx` uses the existing `Input`, `Button`, `ErrorBanner`, and card styles. Fields: email, password. Submit via zod on the server; the client only requires non-empty fields. Errors use `errors.INVALID_CREDENTIALS` and `errors.RATE_LIMITED`. The language switcher is on this page too. The wordmark is the same `ح` + `brand.name`.

`frontend/.env.example` loses `VITE_API_KEY`. `VITE_API_URL` stays. README quick start tells the owner to open the dashboard and sign in with `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` instead of copying the webhook key into Vite. The troubleshooting row "Invalid or missing API key" becomes a login row (wrong password, backend down, cookie blocked because the API origin is not in `CORS_ORIGINS`).

`VITE_API_KEY` may remain in an old `.env` file. The new client ignores it. Say that in the README so the owner does not think a mismatch still matters.

### Files to add

- `backend/src/routes/auth.routes.js`
- `backend/src/middleware/requireUserOrApiKey.js` (or `requireAuth.js`)
- `backend/src/services/auth.service.js` — hash, dummy hash, verify password, sign and verify JWT, `ensureSeedUser`
- `backend/src/lib/cookies.js` — serialize and clear, one place for the cookie attributes
- `backend/prisma/migrations/<timestamp>_add_user/migration.sql`
- `frontend/src/pages/Login.jsx`
- `frontend/src/components/RequireAuth.jsx`
- `frontend/src/hooks/useSession.js` if it stays thinner than inlining the query in the guard

### Files to change

- `backend/prisma/schema.prisma`
- `backend/src/config/env.js`
- `backend/.env.example`
- `backend/src/app.js` — CORS credentials, mount `/api/auth`, swap dashboard middleware, pino redact
- `backend/src/index.js` — call `ensureSeedUser`
- `backend/src/middleware/apiKey.js` — keep for the webhook; share `safeEqual` with the new middleware rather than copying it
- `backend/src/middleware/errorHandler.js` — pass through `code`
- `backend/package.json` — `jose`, `bcryptjs`
- `backend/src/routes/stream.routes.js` — comment no longer says the dashboard must put the key on the query string
- `frontend/src/api/client.js`
- `frontend/src/hooks/useLiveUpdates.js`
- `frontend/src/App.jsx`
- `frontend/src/components/Layout.jsx` — logout
- `frontend/.env.example`
- `README.md` — auth section, quick start, troubleshooting, breaking-change note

Do not change `webhook.routes.js` behavior, `simulate.js`, or `reset.js`.

### Key decisions

1. **Cookie JWT, not localStorage and not a session table.** It is the option that works with `EventSource` without putting a secret in the URL, and it does not need Redis or a session cleaner. `jose` fits the ESM backend. `tokenVersion` is the escape hatch for revocation.
2. **`SameSite=Lax`, `Secure` only in production.** Matches localhost and the documented LAN HTTP setup. Split-site HTTPS is a future change, not this one.
3. **Writes always require a session or the API key. Reads are public unless `REQUIRE_AUTH_FOR_READS=true`.** The owner asked for a browsable dashboard by default, with a switch to lock reads down. One `requireAccess` policy implements both. The webhook stays key-only in both modes. Preview is classified as a read so the playground matches the inbox.
4. **`bcryptjs` cost 12.** Portable on the Windows setup this repo documents. argon2id is better cryptographically and worse as an install here.
5. **Seed once when the table is empty.** Env defaults are for local boot, not a password reset switch. Production refuses the published default password and the published `JWT_SECRET`.
6. **The browser bundle no longer contains the webhook key.** `VITE_API_KEY` is unused. Scripts and the phone keep using `WEBHOOK_API_KEY` from the backend environment, which was always the right place for it.

### Risks

- Cookie not stored on a LAN IP if `Secure` is turned on by mistake in development. The flag must follow `NODE_ENV`, and verification must include a credentialed `fetch` from the Vite origin, not only curl.
- CORS `credentials: true` with a reflected allow-list is safe only while the callback rejects unknown origins. Do not switch the origin to `true` (reflect any). The current callback is the right one; it must now return the origin string in the success case so the header is echoed. Confirm the `cors` package behavior: `callback(null, true)` reflects the request origin, which is what credentialed requests need, and unknown origins still error.
- Stale `?apiKey=` bookmarks still authenticate the stream. That is intentional compatibility. The dashboard must not generate those URLs. Log redaction covers the query param.
- Logout does not invalidate an already-copied JWT until expiry (7 days), unless `tokenVersion` is bumped. There is no UI to bump it yet. Acceptable for a single operator; do not pretend logout is server-side revocation.
- `bcrypt.compare` on the login path is slow at cost 12. The rate limit is what stops online guessing; the cost is a backstop.
- Clock skew on `exp`. Seven days makes a few minutes of skew irrelevant.
- Migration on a database that was created with `db push` and has no `_prisma_migrations` history. The owner should use `prisma migrate dev` locally (as the README already says) or `migrate deploy` if they have been applying migrations. The plan does not switch them to `db push`.

### Migration and breaking changes for the owner

1. Pull `feature/el-hakeem-arabic-branding-auth` when the implementation lands.
2. Add `JWT_SECRET`, `SEED_USER_EMAIL`, and `SEED_USER_PASSWORD` to `backend/.env`. Local values can be the documented defaults. Production must not use those defaults.
3. From `backend/`: `npx prisma migrate dev` (name the migration `add_user` if Prisma asks). This creates `User` only. Trades, notifications, and instruments stay.
4. Restart the backend. The first boot inserts the seed user. Later boots do not reset the password.
5. Frontend: `VITE_API_KEY` is ignored. Remove it from `frontend/.env` when convenient. Keep `VITE_API_URL`. Restart Vite.
6. Leave `REQUIRE_AUTH_FOR_READS` unset or `false` to browse without login. Set it to `true` and restart the backend to require a session (or the API key) for reads. No frontend rebuild.
7. Open the dashboard. Reads work anonymously by default. Sign in with the seed email and password to add or edit trades. The phone's MacroDroid (or Tasker) action is unchanged: same URL, same `x-api-key` header, same JSON.
8. An **old** dashboard build that still sends `x-api-key` keeps working against the new API. A **new** dashboard against an **old** API does not: `/api/auth/config` will 404. Ship backend and frontend together.
9. `GET /api/stream?apiKey=` still works for a non-browser client. The new UI does not use it.

---

## Ordered implementation checklist

1. Add i18next and the two catalogues. Wire the provider, the inline script, and `LocaleSync`. Switch one page (the shell in `Layout.jsx`) to prove `dir`, persistence, and the switcher.
2. Move the remaining UI strings (pages, tables, dialog, chart, confirms, empty states). Map API `code`s to `errors.*` once those codes exist; until then show `error.message`.
3. Point `format.js` at the active locale. Isolate Latin tokens. Replace physical Tailwind utilities listed in section 1. Drop `uppercase` / `tracking-wide` on translated headings. Wrap the chart in `dir="ltr"`.
4. Branding: `ح` wordmark, favicon, fontsource face, `index.html` title and meta, package `name` fields, CSV prefix, README product name. Language-dependent title uses `brand.name`.
5. Prisma `User` model and migration. Env schema and `.env.example` for `JWT_SECRET`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`. `bcryptjs` hash and `ensureSeedUser` on boot.
6. `auth.service`, cookie helper, login rate limit, `/api/auth/login|logout|me`. CORS `credentials: true`. pino redact for `cookie` and `query.apiKey`.
7. `requireAccess` on the dashboard routers in `app.js` (writes always, reads only when `REQUIRE_AUTH_FOR_READS`). Leave `webhook.routes.js` on `requireApiKey` only. Public `GET /api/auth/config`.
8. Frontend client: `credentials: 'include'`, delete `VITE_API_KEY` usage, EventSource `withCredentials` and no query key. `Login` page, `RequireAuth` that redirects only when the config flag is true, write controls hidden behind a sign-in prompt otherwise, sign-in / sign-out always visible.
9. README: quick start login, auth description, troubleshooting, breaking-change steps, webhook section unchanged in substance.
10. Verification pass below, then fix whatever it finds. Screenshots of Arabic UI, English UI, and the login page.

---

## Testing and verification

There is no test runner in either package today. Use Node's built-in test runner for the auth unit checks (`node --test`), and the browser plus curl for the rest. Do not add Jest.

### Automated

`backend/src/services/auth.service.test.js` (or `backend/test/auth.test.js`) with `node:test`:

- Wrong password and unknown email both fail, and neither error distinguishes them.
- A signed token verifies; a tampered token does not; a `tv` that does not match the user fails.
- Cookie serializer sets `HttpOnly`, `SameSite=Lax`, and `Secure` only in production.

No database required for those if JWT helpers and `bcrypt.hash` / `compare` are pure. The seed and middleware can be covered by curl against a running API if MySQL is up during verification.

### Arabic and English UI

Fresh profile, or `localStorage` cleared:

1. Load `/`. Expect `<html lang="ar" dir="rtl">`, title `الحكيم`, sidebar on the right, nav and page copy in Arabic, `ح` mark, no English sentences in the shell.
2. Walk Dashboard, Positions, Trades (open the add-trade dialog), and Inbox (playground included). Empty states count: they are copy too.
3. Confirm Latin digits in stat cards and tables, Cairo timestamps, symbols not reordered, numeric columns aligned to the end, chart axes readable.
4. Switch to English. Expect `dir="ltr"`, sidebar on the left, title `El Hakeem`, English copy. Reload. The choice must stick. Switch back to Arabic and reload again.
5. Mobile width: header nav, language switcher, and logout still reachable; no overlap with the wordmark.
6. Screenshots to capture: Arabic dashboard (and one inner page if the dashboard is empty), English dashboard, login page in Arabic, login page in English.

### Login and authorization

Against a migrated database:

1. `POST /api/trades` with no cookie and no key → `401`.
2. `POST /api/trades` with `x-api-key` → `201` (or `400` on a bad body, not `401`).
3. `POST /api/webhook/notification` with `x-api-key` and no cookie → same behavior as today (`node scripts/simulate.js`). Without the key → `401`. A session cookie alone does not authorize the webhook.
4. `POST /api/auth/login` with the seed user → `200`, `Set-Cookie` has `HttpOnly` and no token in the JSON body.
5. With `REQUIRE_AUTH_FOR_READS=false`: anonymous `GET /api/trades`, `GET /api/portfolio/summary`, `GET /api/notifications`, `GET /api/instruments`, `GET /api/parse/rules`, `POST /api/parse/preview`, and `GET /api/stream` return `200`. The same calls with the flag `true` and no cookie or key return `401`.
6. Anonymous `POST /api/trades`, `PATCH` mark price, and `POST` reparse return `401` in **both** modes. The same writes with `x-api-key` or a session cookie succeed.
7. `GET /api/auth/config` is `200` without credentials in both modes and reports the flag. `GET /api/auth/me` with the cookie → `200`. With only the API key → `401`.
8. Wrong password → generic `INVALID_CREDENTIALS`.
9. In the browser, flag false: `/trades` loads anonymously, add/edit/delete and mark price and reparse are replaced by a sign-in prompt, sign in is visible. After login those controls work and the request sends a cookie, not `x-api-key`. Flag true: a logged-out visit redirects to `/login`.
10. EventSource request URL is `/api/stream` with no `apiKey`. The sidebar reports the stream connected.
11. `GET /health` with no credentials still returns `200`. The webhook is unchanged in both modes.

### Branding

Check the favicon request returns the SVG, the README title, and both package names. Confirm the phone section of the README still shows `x-api-key` and does not tell the owner to put that key in the frontend.

---

## Owner decisions

1. **Single seeded user, no signup and no password change.** Approved.
2. **Latin digits in the Arabic UI** (`ar-EG-u-nu-latn`). Approved.
3. **Reads are public by default.** Changed from the original draft. `REQUIRE_AUTH_FOR_READS` defaults to `false`. `true` restores the gated-read behavior. Writes always require a session or the API key. `POST /api/parse/preview` is a read.
4. **Cookie lifetime is 7 days.** Approved.
5. **`?apiKey=` remains valid** for non-browser clients. Approved. The new UI does not use it.
6. **Package names** `el-hakeem-frontend` and `el-hakeem-backend`. The MySQL database stays `egx`. Approved.
7. **Same-site deployment.** Confirmed. `SameSite=Lax` stands.
