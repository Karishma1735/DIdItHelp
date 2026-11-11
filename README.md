# Did it help?

A daily task manager that measures productivity by the **value** of your work, not how many tasks you closed.
You plan what you will deliver and who it is for, you deliver it with a proof link, and the **receiver** tells you
whether it helped (one tap, no login). Nobody scores their own work, and task count is never shown as a score.

A mentor or manager opens a read-only link and sees what you are doing today and how your week is going in about 10 seconds.

## How it works

1. **Plan**: what you will deliver, who it is for, how to reach them (Slack `@name` or email) and the planned day. For work with no clear receiver, tick "For: my mentor" and the question goes to your mentor.
2. **Deliver**: mark it delivered with a proof link (PR, live flow, doc). No proof, no delivery.
3. **Confirm**: the server posts to your viaSocket flow, which messages the receiver: "Hi Rahul, I delivered “Zoho plug”. Did it help you?" with three one-tap links. The receiver taps one.

### Teams: My desk and Team

- Every user has a **My desk** tab (planning, delivering, settings). Managers also get a **Team** tab.
- **Team** shows one card per direct report: today's plan, delivered and late items, their weekly hero sentence and the three numbers, plus a team roll-up using the same formulas. People are listed alphabetically, never ranked. Open a card for that person's full week, read-only.
- A manager can only read their own direct reports. They can't change, ask about or drop anyone's items. Receivers' Slack handles and emails are never shown to managers.
- **Joining:** a manager creates an invite link (works once, expires after 7 days, stored hashed). The person opens it and picks their own password. An invite can also make the new person a manager.
- **Upgrading an existing database:** the schema change only adds columns and tables. The existing owner becomes a manager and all data stays as it is.
- `/api/today` and `/api/digest` accept `?user=<email or id>` for per-person flows. Without it they report the first account.

### Scoring (per week, Monday to Sunday) — all in `server/lib/scoring.js`

- **Impact** = sum of answers for items delivered that week: helped a lot = 2, a little = 1, didn't help = 0.
- **Reliability** = items planned for that week and delivered by the end of that week ÷ items planned for that week. Dropped items count as not delivered. Late deliveries count as delivered, but not toward the reliability of the week they were planned for.
- **Answer rate** = answered ÷ asked.

### Rules that keep the numbers honest

- Answer and share tokens are random (256 bits) and only their SHA-256 hash is stored in the database.
- The owner can't answer their own items: an answer sent with the owner's login token gets a 403.
- The planned day can't be edited (there is no edit route, and a database trigger refuses any change). Only undelivered items can be dropped, and nothing can be deleted, so a delivered item and its answer stay on the record (a database trigger also refuses deletes).
- Every item keeps `createdAt`, `deliveredAt`, `askedAt`, `askedVia`, `reminderSentAt`, `answeredAt`.
- `askedAt` and `askedVia` are saved only when viaSocket returns 2xx. If it fails, the item shows the error, and "Ask again" or "Copy message" still work.

## Run locally

Requires Node 22.5+ (the database is Node's built-in SQLite, so there is nothing else to install or run).

```bash
cp .env.example .env        # then fill it in
npm install
npm install --prefix client
npm run dev:server          # API on http://localhost:5000
npm run dev:client          # app on http://localhost:5173 (proxies /api to :5000)
```

The first account you register becomes the workspace's first manager. Everyone else joins with an invite link (see Teams).
For local use, `APP_URL=http://localhost:5173` makes the links in messages open the Vite dev server.

### Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_PATH` | Optional. SQLite file location (default `server/data/did-it-help.db`). On a host, point it at a persistent disk |
| `JWT_SECRET` | Signs login tokens |
| `APP_URL` | Public URL, no trailing slash. Every link sent through viaSocket is built from it |
| `VIASOCKET_ASK_WEBHOOK_URL` | Webhook URL of the ask flow. Used server-side only |
| `DIGEST_KEY` | Secret for `/api/today`, `/api/digest` and `/api/jobs/reminders` (`?key=...`) |
| `APP_TIMEZONE` | Optional. Decides what "today" and the Monday–Sunday week mean (default `UTC`) |

## Deploy on Embarko (one service)

This is how the app is currently hosted. Embarko builds it from the repo folder and serves it at `https://<app-name>.embarko.app`.

- `package.json` at the top has the server dependencies, a `build` script (builds the React client) and `npm start`.
- The SQLite file lives under `DATA_DIR`, which Embarko keeps across redeploys. **There are no backups.**
- No timer library: `embarko.json` schedules a daily call to `GET /tasks/reminders` (09:00 Asia/Kolkata), which checks `Authorization: Bearer $CRON_SECRET` and sends the reminders.
- `APP_URL` defaults to `https://$APP_NAME.embarko.app`. The login-signing secret is created once and kept in `DATA_DIR`, so the app boots with no env vars at all.
- Set these in the app's **App setup** page: `DIGEST_KEY`, `VIASOCKET_ASK_WEBHOOK_URL`, and optionally `APP_TIMEZONE` (default `UTC`).

To deploy from a terminal (see https://embarko.ai/docs/quickstart.md):

```bash
tar -czf /tmp/app.tar.gz --exclude=node_modules --exclude=.git --exclude='.env*' --exclude=dist --exclude='*.db' --exclude='*.db-*' --exclude=server/data .
curl -sS -X POST 'https://ship.embarko.ai/apps' --oauth2-bearer "$DEPLOY_TOKEN" -H 'X-App-Name: did-it-help' -H 'X-Agent-Name: you' -F 'source=@/tmp/app.tar.gz'
```

Keep `appId` in `embarko.json` so redeploys always reach the same app.

## Alternative: deploy on Render (one service)

Express serves the built React app, so everything runs as one web service. The data lives in one SQLite file, so the service **needs a persistent disk**; without one, every redeploy would wipe your plans and answers.

1. Push this repo to GitHub.
2. On Render choose **New → Blueprint** and pick the repo. It reads `render.yaml`, which creates a web service with a 1 GB disk mounted at `/var/data` (disks need a paid plan, such as Starter). Or create a **Web Service** by hand with:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Health check path: `/healthz`
   - A disk mounted at `/var/data`, and the env var `DATABASE_PATH=/var/data/did-it-help.db`
3. Set the environment variables: `APP_URL` (your `https://<name>.onrender.com` URL, which you only know after the first deploy, so set it and redeploy), `VIASOCKET_ASK_WEBHOOK_URL` (see below), and `JWT_SECRET` and `DIGEST_KEY` (the blueprint generates them).
4. Open the URL, create the owner account, then **Settings → Create link** for the manager link.

Railway works the same way: same build and start commands and variables, with a volume mounted at `/data` and `DATABASE_PATH=/data/did-it-help.db`.

Run a single instance only (SQLite is a single-writer file). Back up by copying the `.db` file.

**Sleeping hosts:** if your plan sleeps when idle, the built-in 09:00 reminder cron pauses too. The server runs a reminder check 30 seconds after every boot, and you can add the optional backup flow below so reminders go out reliably.

## viaSocket flows

Create these in viaSocket (https://viasocket.com). Flow 1 is required; the others are your daily routine.

### 1. "Did it help?" ask flow (required)

1. Create a new flow and choose **Webhook** as the trigger. Copy the webhook URL into `VIASOCKET_ASK_WEBHOOK_URL` on the server.
2. Run the trigger once with a sample payload so viaSocket learns the fields. The server sends:

   ```json
   {
     "channel": "slack",
     "to": "@rahul",
     "receiverName": "Rahul",
     "ownerName": "Ankit",
     "what": "Zoho plug",
     "proofUrl": "https://github.com/acme/repo/pull/12",
     "answerUrl": "https://your-app.onrender.com/a/<token>",
     "lotUrl": "https://your-app.onrender.com/a/<token>?v=lot",
     "littleUrl": "https://your-app.onrender.com/a/<token>?v=little",
     "noneUrl": "https://your-app.onrender.com/a/<token>?v=none",
     "isReminder": false
   }
   ```

   `channel` is `"email"` when `to` is an email address, otherwise `"slack"`.
3. Add a **Condition / Router** step on `channel`:
   - **`channel` is `slack`** → add **Slack → Send message**. Set *Channel/User* to `to` (the Slack `@name`, sent as a DM) and *Message* to:

     ```
     Hi {{receiverName}}, I delivered “{{what}}”. Did it help you?
     Proof: {{proofUrl}}

     Helped a lot: {{lotUrl}}
     Helped a little: {{littleUrl}}
     Didn't help: {{noneUrl}}

     Thanks, {{ownerName}}
     ```
   - **`channel` is `email`** → add **Gmail → Send email**. *To* = `to`, *Subject* = `Did “{{what}}” help you?` and the same body as above.

   Insert the fields with the viaSocket variable picker rather than typing the braces; the exact syntax is whatever the editor inserts. To label reminders, add a Condition on `isReminder` before the send step and use a message that starts with "Reminder:" on the true branch.
4. **Respond 2xx.** The webhook trigger answers 2xx as soon as the flow accepts the payload. The app treats any 2xx as "sent", and anything else as a failure it shows on the item.
5. Publish the flow.

The same flow is used for the one reminder after 2 days with no answer (`"isReminder": true`).

### 2. 10:00 weekdays — "What will you deliver today?"

1. New flow, trigger **Schedule** (cron), `0 10 * * 1-5`, set to your timezone.
2. Add **API / Webhook → GET**: `https://<APP_URL>/api/today?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** to yourself with the text `{{morningMessage}}` from the previous step (or: "What will you deliver today? <dashboard link>", using `dashboardUrl`).

### 3. 18:30 weekdays — what's still open

1. Trigger **Schedule**, `30 18 * * 1-5`.
2. Add the same GET step on `/api/today?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** to yourself with `{{eveningMessage}}`. It lists the items not yet delivered and the delivered items not yet asked. (The raw lists are also there as `notDelivered` and `notYetAsked`.)

### 4. Friday 17:00 — weekly summary to your mentor

1. Trigger **Schedule**, `0 17 * * 5`.
2. Add a GET step on `https://<APP_URL>/api/digest?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** (to the mentor, or use `mentor.contact`) or **Gmail → Send email** with `{{summaryText}}`. It holds the hero sentence, Impact, Reliability, Answer rate and the items still waiting for an answer.

### 5. Optional backup — daily reminder check

If your host sleeps, add a flow on a daily schedule that calls `GET https://<APP_URL>/api/jobs/reminders?key=<DIGEST_KEY>`. It is safe to run any number of times: each item gets at most one reminder.

## API summary

| Route | Auth | What it does |
| --- | --- | --- |
| `POST /api/auth/register`, `/login` | rate-limited | Owner account (first account only) and sign-in |
| `GET /api/overview?week=YYYY-MM-DD` | owner | Dashboard data |
| `POST /api/items` | owner | Plan an item |
| `POST /api/items/:id/deliver` `/ask` `/drop` `/message` | owner | Deliver with proof, ask again, drop, get the copyable message |
| `GET/POST /api/answer/:token` | token, rate-limited | Answer page data and answers |
| `GET/POST/DELETE /api/share` | owner | Manager link status, create, revoke |
| `GET /api/manager/:token` | token | Read-only data for a share link |
| `GET /api/team`, `/api/team/:userId/overview` | manager | Team dashboard and one report's read-only desk |
| `GET/POST/DELETE /api/team/invites` | manager | Invite links for new team members |
| `GET /api/auth/invite/:token` | rate-limited | Who invited you (join page) |
| `GET /api/today`, `/api/digest`, `/api/jobs/reminders` | `?key=DIGEST_KEY` | For viaSocket schedules |

## Project layout

```
client/   React + Vite + Tailwind (JavaScript)
server/   Express + SQLite (node:sqlite); dependencies live in the root package.json
  lib/store.js     database schema and queries
  lib/scoring.js   all scoring logic
  lib/viasocket.js the only code that calls viaSocket
  jobs/reminders.js reminder logic (run daily by the host's scheduler)
```

## Notes

- The original brief asked for MongoDB; the data layer was switched to SQLite so the app runs anywhere with no database service. The schema in `server/lib/store.js` mirrors the User, Item, Answer, AnswerToken and ShareLink models.
- Node prints an "ExperimentalWarning: SQLite" line at startup. That is expected.
- Passwords are hashed with `bcryptjs` (a pure-JavaScript bcrypt, so deploys need no native build).
- v1 has no automated tests by request.
