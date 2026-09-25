# El Hakeem

الحكيم is a real-time trade tracking dashboard for [Thndr](https://thndr.app) on the Egyptian Exchange (EGX). Thndr has no public API. An Android
notification forwarder posts every Thndr push notification to a webhook; the backend stores the raw text,
parses the Arabic into a structured trade, and the dashboard shows trades, FIFO positions and P&L.

```
Android phone  ──POST /api/webhook/notification──▶  Express + Prisma  ──▶  MySQL
   (forwarder app, x-api-key)                            │
                                                         ├── Arabic parser (rule table)
                                                         └── REST + SSE  ──▶  React dashboard
```

The webhook and the parser are deliberately separate. Every notification is stored **verbatim** before any
parsing is attempted, so a rule that does not match yet costs nothing: the text stays in the inbox and you
re-run the parser after adding a rule.

## Stack

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| Backend  | Node.js, Express 4, Prisma ORM, zod, helmet, pino                  |
| Database | MySQL                                                             |
| Frontend | React 18, Vite 6, Tailwind CSS 4, TanStack Query, Recharts         |
| Security | Dashboard session cookie, shared API key (`x-api-key`) for the phone and scripts, CORS allowlist, login rate limit |

## Quick start

Requires Node.js 20+ and a running MySQL server.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # set DATABASE_URL and WEBHOOK_API_KEY; the seed login defaults are fine locally
npx prisma migrate dev        # creates the tables, including User
npm run dev                   # http://localhost:4000 — seeds the user on first boot

# 2. Frontend (second terminal)
cd frontend
npm install
cp .env.example .env          # VITE_API_URL only; the dashboard does not use an API key
npm run dev                   # http://localhost:5173
```

The dashboard opens in Arabic. Switch to English with the control in the sidebar; the choice is stored in the browser. By default you can browse trades without signing in. Adding, editing, or deleting trades, reparsing, and setting a mark price require a sign-in. The local account is `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` from `backend/.env` (`owner@localhost` / `el-hakeem-dev` unless you changed them). The password is applied only when the `User` table is empty, so editing it later does not reset an existing account.

Set `REQUIRE_AUTH_FOR_READS=true` and restart the backend to require that same sign-in (or the API key) before any read, including the live stream. The frontend picks the flag up from `GET /api/auth/config` without a rebuild.

Generate an API key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Send sample notifications through the whole pipeline without touching the phone:

```bash
cd backend
node scripts/simulate.js                                   # built-in Arabic samples
node scripts/simulate.js "تم تنفيذ أمر شراء 100 سهم من COMI بسعر 85.5"
node scripts/reset.js                                      # clear the sample data again
```

## Connecting the phone

The phone needs to reach your machine. On the same Wi-Fi, use your LAN IP; otherwise use a tunnel.

**1. Allow port 4000 through Windows Firewall** (PowerShell as Administrator, once):

```powershell
netsh advfirewall firewall add rule name="El Hakeem" dir=in action=allow protocol=TCP localport=4000
```

**2. Install a notification forwarder** such as MacroDroid, Tasker, or "Notification Forwarder".

MacroDroid setup:

- **Trigger**: Notification → Notification Received, application = Thndr
- **Action**: HTTP Request
  - Method `POST`, Content type `application/json`
  - URL `http://<your-LAN-IP>:4000/api/webhook/notification`
  - Header `x-api-key: <your WEBHOOK_API_KEY>`
  - Body:

```json
{
  "appPackage": "[not_app_package]",
  "title": "[not_title]",
  "text": "[not_text]",
  "postedAt": "[timestamp]",
  "deviceId": "phone"
}
```

Field names are flexible. `text`, `body`, `message` and `content` are all accepted for the notification
text, and `postedAt`, `timestamp` or `time` for the timestamp (epoch seconds, epoch milliseconds or ISO).

**3. Verify the phone can reach the backend** by opening this in the phone's browser:

```
http://<your-LAN-IP>:4000/api/webhook/ping?apiKey=<your WEBHOOK_API_KEY>
```

**Off your Wi-Fi?** Expose the backend with a tunnel and use the public URL in the forwarder instead:

```bash
cloudflared tunnel --url http://localhost:4000
```

## Tuning the parser

The parser lives in `backend/src/services/parser/`:

- `normalize.js` strips bidi control characters, tatweel and diacritics, converts Arabic-Indic digits
  (`٠١٢٣`) and the Arabic decimal separator (`٫`) to ASCII, and folds letter variants so `أمر` and `امر`
  match one pattern.
- `rules.js` is an ordered rule table. The first rule that matches and yields a side, quantity and price
  wins, and its id is stored on the notification so you can always see which rule produced a trade.
- `index.js` runs the table, computes fees and net amount, and classifies non-trade notifications as
  `IGNORED` instead of `FAILED`.

Workflow when a real notification does not parse:

1. Open **Inbox** in the dashboard and read the actual text under the `FAILED` tab.
2. Paste it into the **Parser playground** to see what the current rules extract.
3. Add or adjust a rule in `rules.js` (the backend hot-reloads).
4. Click **Reparse failed**.

Note for rule authors: JavaScript `\b` is ASCII-only and never matches between Arabic letters, so do not
use it in Arabic patterns. Write keywords in their folded spelling (`كميه`, `امر`, `شركه`).

## Data model

| Model             | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `RawNotification` | Verbatim notification plus payload, dedupe hash, parse status, matched rule and error |
| `Trade`           | Structured fill: side, symbol, quantity, price, fees, net amount, executed at         |
| `Instrument`      | Symbol metadata and the manually set mark price used for unrealized P&L               |

Money is stored as `DECIMAL`, computed with `decimal.js`, and sent to the browser as strings. No floats.

## How P&L is computed

Lots are matched **FIFO** per symbol. A buy carries its commission into the cost basis and a sale nets its
commission out of the proceeds, so realized P&L is already fee-adjusted.

There is no public EGX price feed here, so unrealized P&L uses the **mark price**: click any mark price on
the Positions page to set the current market price. Until you set one, the last traded price is used.

## Signing in

Writes always need either the httpOnly session cookie (from `POST /api/auth/login`) or the existing
`x-api-key`. The phone webhook accepts only the API key, in both read modes, so a browser session cannot
ingest notifications and the forwarder does not change.

Reads (`GET` trades, portfolio, notifications, instruments, parse rules, the SSE stream, and
`POST /api/parse/preview`) are public when `REQUIRE_AUTH_FOR_READS` is false. Preview is treated as a read
because it does not save anything. Set the flag to true to put those routes behind the same session-or-key
check as writes.

The session cookie lasts 7 days, is `HttpOnly` and `SameSite=Lax`, and is `Secure` only when
`NODE_ENV=production`. That fits a dashboard and API on the same host (localhost, one LAN address, or one
HTTPS site). Login is limited to 10 attempts per 15 minutes per IP.

Production refuses the documented `JWT_SECRET` and `SEED_USER_PASSWORD`. Generate a secret with the same
`node -e` command used for the API key, and pick a seed password of at least 12 characters.

## API

`/health` and `GET /api/auth/config` are public. Dashboard routes accept a session cookie or `x-api-key`
(header, `Authorization: Bearer`, or `?apiKey=` for non-browser clients). The dashboard itself sends the
cookie and does not put the key in the bundle or on the stream URL. Whether reads require that credential
depends on `REQUIRE_AUTH_FOR_READS`, described above.

| Method | Route                                  | Purpose                                      |
| ------ | -------------------------------------- | -------------------------------------------- |
| GET    | `/api/auth/config`                     | `{ requireAuthForReads }` for the dashboard  |
| POST   | `/api/auth/login`                      | Email and password; sets the session cookie  |
| POST   | `/api/auth/logout`                     | Clears the session cookie                    |
| GET    | `/api/auth/me`                         | The signed-in email, or 401                 |
| POST   | `/api/webhook/notification`            | Ingest a forwarded notification              |
| GET    | `/api/webhook/ping`                    | Check reachability and key from the phone    |
| GET    | `/api/trades`                          | Filter, search and paginate trades           |
| POST   | `/api/trades`                          | Add a trade manually (backfill)              |
| PATCH  | `/api/trades/:id`                      | Correct a parsed trade                       |
| DELETE | `/api/trades/:id`                      | Remove a trade                               |
| GET    | `/api/portfolio/positions`             | FIFO positions with P&L                      |
| GET    | `/api/portfolio/summary`               | KPIs and the daily realized P&L series       |
| GET    | `/api/notifications`                   | The inbox, filtered by status                |
| POST   | `/api/notifications/:id/reparse`       | Re-run the rules over one notification       |
| POST   | `/api/notifications/reparse-failed`    | Re-run over everything unparsed              |
| POST   | `/api/parse/preview`                   | Parse text without saving (playground)       |
| GET    | `/api/parse/rules`                     | List the active rules                        |
| PATCH  | `/api/instruments/:code`               | Set a mark price                             |
| GET    | `/api/stream`                          | Server-sent events for live dashboard updates |

## Troubleshooting

| Symptom                                | Cause and fix                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Dashboard cannot load, or sign-in does nothing | Backend down, wrong `VITE_API_URL`, or this origin missing from `CORS_ORIGINS`. An old `VITE_API_KEY` in the frontend env is ignored. |
| Writes say sign-in is required | Expected until you sign in. Reads stay open unless `REQUIRE_AUTH_FOR_READS=true`. |
| Backend exits on start                 | MySQL unreachable or `.env` incomplete; the log names the missing variable.       |
| Phone gets no response                 | Firewall rule missing, wrong LAN IP, or phone on mobile data instead of Wi-Fi.    |
| Notification arrives but no trade      | Open Inbox → `FAILED`, use the playground, add a rule, reparse.                  |
| Same trade appears twice               | Only if the forwarder sends different text; identical retries are deduped.       |
| Trades appear at the wrong time        | The forwarder sent no usable timestamp, so receipt time was used.                |
