# EGX Trade Tracker

A real-time trade tracking dashboard for [Thndr](https://thndr.app), which has no public API. An Android
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
| Security | Shared API key (`x-api-key`), CORS allowlist, per-minute rate limit |

## Quick start

Requires Node.js 20+ and a running MySQL server.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL and WEBHOOK_API_KEY
npx prisma migrate dev        # creates the tables
npm run dev                   # http://localhost:4000

# 2. Frontend (second terminal)
cd frontend
npm install
cp .env.example .env          # VITE_API_KEY must equal the backend's WEBHOOK_API_KEY
npm run dev                   # http://localhost:5173
```

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
netsh advfirewall firewall add rule name="EGX Trade Tracker" dir=in action=allow protocol=TCP localport=4000
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

## API

All routes require `x-api-key` (the `/api/stream` route accepts `?apiKey=` because EventSource cannot send
headers). `/health` is open.

| Method | Route                                  | Purpose                                      |
| ------ | -------------------------------------- | -------------------------------------------- |
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
| Dashboard shows "Invalid or missing API key" | `VITE_API_KEY` does not match `WEBHOOK_API_KEY`. Restart Vite after editing `.env`. |
| Backend exits on start                 | MySQL unreachable or `.env` incomplete; the log names the missing variable.       |
| Phone gets no response                 | Firewall rule missing, wrong LAN IP, or phone on mobile data instead of Wi-Fi.    |
| Notification arrives but no trade      | Open Inbox → `FAILED`, use the playground, add a rule, reparse.                  |
| Same trade appears twice               | Only if the forwarder sends different text; identical retries are deduped.       |
| Trades appear at the wrong time        | The forwarder sent no usable timestamp, so receipt time was used.                |
