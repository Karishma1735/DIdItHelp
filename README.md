# Did it help?

A daily task manager that measures productivity by the **value** of your work, not how many tasks you closed.
You plan what you will deliver and who it is for, you deliver it with a proof link, and the **receiver** tells you
whether it helped (one tap, no login). Nobody scores their own work, and task count is never shown as a score.

A mentor or manager opens a read-only link and sees what you are doing today and how your week is going in about 10 seconds.

## How it works

1. **Plan**: what you will deliver, who it is for, how to reach them (Slack `@name` or email) and the planned day. For work with no clear receiver, tick "For: my mentor" and the question goes to your mentor.
2. **Deliver**: mark it delivered with a proof link (PR, live flow, doc). No proof, no delivery.
3. **Confirm**: the server posts to your viaSocket flow, which messages the receiver: "Hi Rahul, I delivered “Zoho plug”. Did it help you?" with two one-tap answers, **Helped** and **Didn't help**. By email they are real buttons; on Slack they are two links. The receiver taps one, no login needed.

### Who sends each message

Messages go out from **the person's own connected Slack or Gmail** (Integrations page), through viaSocket. In order:
1. **The sender's own account:** the "Did it help?" ask and its 2-day reminder from the person who delivered; team invites from the manager; the morning prompt and deadline reminder to the person themself (their Slack DM using the "which one is you" choice, or their own Gmail, or the reminder contact in Settings).
2. **The shared viaSocket flows** (`VIASOCKET_ASK_WEBHOOK_URL`, `VIASOCKET_INVITE_WEBHOOK_URL`, `VIASOCKET_REMINDER_WEBHOOK_URL`) are only a **backup** for a sender who has nothing connected.
3. **A clear error** if neither works (the item or invite says what to do). Nothing is dropped silently.

A Slack @name is matched to exactly one person in the sender's own Slack. If nobody or several people match, the message is not sent and the error says so; it never falls back to a different account and never guesses. People who can't be reached by any route are counted once and not retried every 5 minutes.

### The daily rhythm: plan, deadline, report

1. **Morning (10:00 on weekdays):** everyone who hasn't planned yet today gets "What will you deliver today?" on their Slack or email (set in Settings, default their account email). Each item is planned with a **deadline time** (default 17:00). The day and the deadline can't be changed afterwards. Managers see "Hasn't planned today yet" on a person's card.
2. **Deadline:** when an item's deadline passes without delivery, the person gets **one** reminder (checked every 5 minutes, so within about 5 minutes). It is claimed in the database before it is sent, so it can never go twice; if viaSocket fails it is retried on the next check.
3. **Submit:** when someone marks an item delivered in the evening (from `REPORT_FROM_HOUR`, default 16:00), their manager is emailed from **that person's own Gmail**: the item, its proof link and the day so far (delivered, still open, late). It never includes receivers' contact details. If the person hasn't connected Gmail (or it expired), nothing is sent, the item says "Report not emailed: connect your Gmail", and their desk shows a banner.

The morning prompt and deadline reminder go from each person's own accounts (see above); the viaSocket flow at `VIASOCKET_REMINDER_WEBHOOK_URL` is only the backup for people with nothing connected. Create it like the other flows: a **Webhook** trigger, a Condition on `channel`, then Slack **Send message** or Gmail **Send email**, using `kind` to choose the wording (`morning_plan`: "What will you deliver today? {dashboardUrl}"; `deadline`: "Your deadline for {what} ({deadline}) has passed. {dashboardUrl}"). Payload: `{ kind, channel, to, receiverName, dashboardUrl, day?, what?, forWhom?, deadline?, plannedDay? }`. On Embarko, `embarko.json` runs `/tasks/tick` every 5 minutes; elsewhere call `GET /api/jobs/tick?key=<DIGEST_KEY>` on a 5-minute schedule.

### The 8-hour day and the AI day planner

Every day is **8 hours for everyone** (`WORKDAY_MINUTES`, default 480). Hours are a **coverage check**, never a score: they do not enter Impact, Reliability or Answer rate. A day with less or more than 8 hours planned only shows an amber **warning**, on the person's desk (a bar, "5h 30m planned of 8h. 2h 30m is still unplanned"), on their manager's Team card and report page, in the evening report email ("Hours today: 6h planned of 8h…") and in what the manager's AI assistant can see.

- **Tasks** have a receiver and are scored as before. They now also carry a **time needed**, a **start time** and (as the deadline) the **end of their slot**. The time and the start time are fixed once planned, like the day and the deadline (a database trigger refuses any change).
- **Blocks** are meetings, learning, support, admin and other time with no receiver. They count toward the 8 hours, show on the timeline and are **never scored**. Add and remove them on the day card (today or later).
- **Plan my day** is one card with two ways to plan, chosen with a switch (the choice is remembered in the browser): **Plan with AI** or **Add by hand**. With AI, in the morning the person types their plan in plain words ("CRM plugs for Rahul 2h, docs for Priya 1h, standup at 10:30 for 30 min, learn Rust 1.5h, no receiver"). The AI separates tasks from blocks, reads the durations, and the server lays them out on a **timeline** from 09:00 (or from now, if later): lunch 13:00–14:00 is left free, a fixed clock time like a standup is honoured, nothing overlaps what is already on the day, and anything that does not fit before midnight gets no slot instead of a wrong one. The person sees an **editable draft** (every field, the start times, the receiver, a live hours total, overlap warnings and the AI's questions) and **nothing is created until they click "Add to my plan"**. Each row is then created through the normal validated routes.
- **Finishing work** uses the same buttons everywhere: **Mark delivered and ask** (a proof link or an uploaded file is required, then the receiver is asked) and **Drop**. They sit on each item and also on each open task of the timeline, so work can be closed right where it is planned. There is no AI step for this: nothing can be marked delivered without a proof, and only the person's click does it.

How it is kept safe (`server/lib/planner.js`): the person's text goes to the AI as the *message*, never inside the instructions, and is cut at 4,000 characters; the AI has no tools; its answer must match a JSON schema and is then validated again (at most 12 tasks and 12 blocks, lengths cut, minutes 5–480 or an assumed hour when none is given, contacts must be an email or a Slack @name or are dropped with a question). A hung or failing AI gives a plain message and the manual form still works. Each request is a fresh AI thread and the person's words are never written to the logs. It uses viaSocket's built-in AI (`user.ai.send`), so there is no model key to manage.

### Alerts: a real person is woken when something breaks (M91)

When something breaks that a person has to fix, **M91** rings every phone in the "Did it help Ops" channel at full volume, through silent mode and Do Not Disturb. It repeats until someone answers, and the two buttons are **I'll handle it** (one person takes it and everyone else's phone stands down) and **Seen**. This is only for broken things that persist. It is never wired to a generic error handler, so one failed message does not wake anyone.

**Who must set this up once (the people who will be woken):**
1. Install M91 ([App Store](https://apps.apple.com/app/id6759090472) · [Google Play](https://play.google.com/store/apps/details?id=com.msg91.m91)) and sign in with your phone number.
2. Whoever owns the channel adds your phone number to it. **You must accept the invite in the app**, or your phone stays silent while the alert still counts you as reached.
3. In the app, fire **Send a test alert** from the channel once on your own phone, so you know it rings.

**What wakes you** (`server/lib/alerts.js`; each alert closes itself when the problem is gone, and a new problem alerts again):

| You are woken when | Severity | It closes when |
| --- | --- | --- |
| The 5-minute scheduler fails 3 runs in a row, or runs out of time 3 times in a row. Nobody is reminded until it works | HIGH | the next good run |
| viaSocket sends fail 5 in a row **for at least 2 different people** (morning prompts, reminders, questions to receivers, manager reports). One person's expired Gmail or bad address is not counted | HIGH | the next successful send |
| The database cannot be written 3 times in a row (disk full or read-only) | HIGH | the next scheduler run that can write |
| Proof files cannot be saved 3 times in a row (the file store is full or unreachable). People can still paste a link | MEDIUM | the next successful upload |
| The app crashed and restarted (reported on the next start, from a note left in the data folder, because the database may be what broke) | MEDIUM | after an hour of running fine |
| The app is down, its database cannot be written, or its scheduler has not run for 20 minutes (the outside watchdog below) | HIGH | the next healthy check |

HIGH only phones people if the whole channel has gone quiet for 3 minutes; MEDIUM never phones. Nothing here is `CRITICAL` (money or safety draining), so the phone keeps its meaning. Not alerted on: validation errors, one person's disconnected Slack or Gmail (their desk says so), the AI planner being down (the manual form works).

**Setup.** Set `M91_SEND_LINK` to the channel's "Send alert link" (channel → paper-plane icon → copy). It is a credential, so it goes in the environment only (the gitignored `.env`, and an Embarko environment variable), never in source and never in a log. Without it the app runs exactly as before and nobody is woken. To check a link without waking anyone, a plain `GET` of it names the channel (a link with `?title=…` on the end *raises* an alert, so the app strips that).

**Good to know.**
- A `2xx` from M91 means "accepted", not "rang". The app logs `reached N phones`, and a warning if it reached nobody (everyone in the channel must accept the invite).
- The state of each problem (how many failures in a row, whether its alert is open) is kept in the database, so a restart does not forget it. If M91 is unreachable when an alert should go out, it is retried on every scheduler tick.
- Revoking the link in the M91 app turns every alert off at once (`401`, logged once per attempt). Use a separate link for the outside watchdog if you want to be able to cut one off alone.
- `GET /healthz` stays a plain "is it alive" check. `GET /healthz/deep` is for the outside watchdog: `200 {"ok":true}`, or `503` naming `database` or `scheduler`. It never shows secrets, and it does at most one database write every 30 seconds however often it is fetched.
- The **outside watchdog** is a viaSocket flow (Schedule every 5 minutes → fetch `/healthz/deep` → on a non-200 use the M91 app's **Send Channel Alert** with the customId `app-down`, severity HIGH, buttons `I'll handle it` and `Seen` → on a 200 use **Close Channel Alert** for `app-down`). It is the only thing that can notice the whole app being down, because a dead app cannot alert about itself. If the app crash-loops before it can start, the watchdog is what wakes you.

### Proof: a link or an uploaded file

When marking something delivered, the proof is **a link** (PR, live flow, doc) **or an uploaded file**. Allowed: png, jpg, jpeg, gif, webp, pdf, txt, md, csv, zip, mp4, webm, up to 20 MB (the app checks that the file really is what its extension says; html, svg, scripts and executables are refused; for Word or Excel use a zip or a link). The file is stored once and the receiver, the manager and the AI all just see its link:

- **On Embarko** it goes to the app's file store (`STORAGE_URL` / `STORAGE_TOKEN` / `APP_NAME`, set by Embarko), which returns a public, unguessable link. A full store gives a clear message and the item stays undelivered.
- **Anywhere else** (a developer's machine, Render) it is saved under `DATA_DIR/uploads/<random 128-bit id>/` and served by the app at `/files/<id>/<name>`, with `nosniff` and a sandboxing policy; images and PDFs open in the browser, other types download.
- Anyone with a file's link can open it, so people are told not to upload secrets. Nothing is stored if the item was already delivered, dropped or not theirs.

### Manager, not a separate mentor

"For: my manager" goes to the person's **real manager** (whoever invited them): by name, to that manager's reminder contact or account email. The Friday summary goes to the same person. Settings shows the manager read-only. Only someone at the top of the team, who has no manager in the app, types a manager's name and contact in Settings (optional).

### Teams: My desk and Team

- Every user has a **My desk** tab (planning, delivering, settings). Managers also get a **Team** tab.
- **Team** shows one card per direct report: today's plan, delivered and late items, their weekly hero sentence and the three numbers, plus a team roll-up using the same formulas. People are listed alphabetically, never ranked. Open a card for that person's full week, read-only.
- A manager can only read their own direct reports. They can't change, ask about or drop anyone's items. Receivers' Slack handles and emails are never shown to managers.
- **Joining:** a manager enters the person's name and Slack @name or email. The server sends the invite link there through a viaSocket flow (`VIASOCKET_INVITE_WEBHOOK_URL`); if that isn't set up or fails, the page says so and shows the link to copy. The link works once, expires after 7 days and is stored hashed, so "Send again" replaces it with a fresh one. An invite can also make the new person a manager.
- **Employees see who their manager is:** on the join page, in their header, and in a note on their desk that lists exactly what the manager can and can't see.
- **Sample employee:** the Team tab has "Add a sample employee" to show a filled-in dashboard. It is flagged as sample data, never sends reminders, and "Remove sample data" deletes it completely.
- **Upgrading an existing database:** the schema change only adds columns and tables. The existing owner becomes a manager and all data stays as it is.
- `/api/today` and `/api/digest` accept `?user=<email or id>` for per-person flows. Without it they report the first account.

### Look and feel

A blue palette (Blue Gray #88A9C3, Midnight Blue #2B4257, Navy Blue #14202E, Royal Blue #091235, plus pale tints of Blue Gray for light surfaces), with Fraunces (headings and big numbers), DM Sans (text) and DM Mono (small labels), all bundled with the app so nothing loads from a font CDN. Light and dark mode. Signed-in pages use a sidebar: **My desk**, **Team** and **Integrations** (managers), and **Settings**. The **Integrations** page shows whether the ask and invite webhooks are set up, the routine flow URLs to copy, and the saved viaSocket project. It never shows secrets.

### Integrations (viaSocket) for every person

The **Integrations** page lets each person connect their own apps through viaSocket:

- **Slack and Gmail on top**, each with a Connect button. After connecting Slack, the person picks once which Slack person they are. **Send me a test message** sends a fixed line to that person only.
- **Every other app**: viaSocket's own screens inside the page (catalog of 2,300+ apps, Connect, action forms, the person's own automations).
- Managers also see the shared message setup (ask and invite webhooks, routine URLs).
- Each person connects only their own accounts. Their connection ids stay on the server and are never sent to a browser. The browser gets only a short-lived per-person token from `GET /api/viasocket/token`, signed with `VIASOCKET_EMBED_SECRET` (server only).
- viaSocket identifies each person by a random id stored with them (people who existed earlier keep their old one), so a rebuilt database can never give a new person someone else's connections.
- Needs `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID` and `VIASOCKET_EMBED_SECRET` as server settings. The app's security rules allow `*.viasocket.com` for the embedded screens and the connect script.

### AI assistant for managers

The **Team** page has an **Ask AI** panel (managers only; employees never see it and the server refuses them). A manager asks in plain words, such as "give me Ankit's full report" or "who needs attention this week?", and the answer is written from the real reports: today, items with status, proof links, receivers' answers and comments, the three numbers and the last 8 weeks.

- viaSocket runs the model (`gpt-6.1-terra`) and keeps the conversation; there is no model key in this app.
- The AI can only call three read-only endpoints (`list_team`, `team_summary`, `employee_report`) under `/api/ai-tools`. Each call carries a 5-minute pass for ONE manager, signed with a key derived from `JWT_SECRET` (so it can never act as a login). The manager comes from the pass, never from the AI, and only that manager's direct reports are ever returned. Receivers' contacts are never included, and nothing can be changed.
- Item names and comments are written by people, so the prompt and the data both mark them as data, never instructions.
- viaSocket's servers call these endpoints, so the app must be reachable from the internet (as on Embarko). The data a manager asks about is sent to viaSocket's AI service and the model provider when they ask. Employees' desks say so.

### Daily by default, weekly when you want it

Every page opens on **today**. A **Day | Week** switch, previous/next arrows and a "Today" button change the period; clicking a row in the history table or a bar in the chart opens that day. The address holds the choice (`?view=day|week&date=YYYY-MM-DD`; the old `?week=` still works). History is the last **14 days** (or 8 weeks). The manager's Team page, a person's read-only page, the share link and the manager AI all follow the same Day/Week choice, and the AI answers "today" unless asked about "yesterday", a date or a week.

### Scoring (for a day or a week, Monday to Sunday) — all in `server/lib/scoring.js`

- **Impact** = sum of answers for items delivered in the period (that day or week): **helped = 1 point**, didn't help = 0. (Answers recorded before the change keep their old value: a lot = 2, a little = 1. Old links in old emails still work.)
- **Reliability** = items planned for the period and delivered by the end of that period ÷ items planned for the period (for a day: planned that day and delivered by the end of that day). Dropped items count as not delivered. Late deliveries count as delivered (and toward the impact of the day they were delivered), but not toward the reliability of the period they were planned for.
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
| `WORKDAY_MINUTES` | Optional. Length of the working day in minutes (default `480`, which is 8 hours) |
| `VIASOCKET_AI_TIMEOUT_MS` | Optional. How long the day planner waits for the AI (default `45000`) |
| `M91_SEND_LINK` | Optional but recommended. The M91 channel's send link: wakes a real person when something breaks. A credential: environment only |
| `SCHEDULER_STALE_MINUTES` | Optional. How many minutes without a scheduler run before `/healthz/deep` reports the scheduler as stopped (default `20`; it runs every 5) |

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
     "helpedUrl": "https://your-app.onrender.com/a/<token>?v=helped",
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

     Helped: {{helpedUrl}}
     Didn't help: {{noneUrl}}

     Thanks, {{ownerName}}
     ```
   - **`channel` is `email`** → add **Gmail → Send email**. *To* = `to`, *Subject* = `Did “{{what}}” help you?` and the same body as above.

   Insert the fields with the viaSocket variable picker rather than typing the braces; the exact syntax is whatever the editor inserts. To label reminders, add a Condition on `isReminder` before the send step and use a message that starts with "Reminder:" on the true branch.
4. **Respond 2xx.** The webhook trigger answers 2xx as soon as the flow accepts the payload. The app treats any 2xx as "sent", and anything else as a failure it shows on the item.
5. Publish the flow.

The same flow is used for the one reminder after 2 days with no answer (`"isReminder": true`).

### 1b. Team invite flow (optional)

1. New flow, trigger **Webhook**. Copy its URL into `VIASOCKET_INVITE_WEBHOOK_URL`.
2. The server sends `{ "kind": "invite", "channel": "slack" | "email", "to": "@rahul", "receiverName": "Rahul Verma", "managerName": "Meera", "joinUrl": "https://.../join/<token>", "expiresAt": "...", "isManager": false }`.
3. Add a Condition on `channel`, then **Slack → Send message** (to `to`) or **Gmail → Send email** (to `to`) with a message such as: "Hi {receiverName}, {managerName} invited you to Did it help? Create your account here: {joinUrl} (the link works once and expires in 7 days)." Insert the fields with the variable picker.

### 2. 10:00 weekdays — "What will you deliver today?"

1. New flow, trigger **Schedule** (cron), `0 10 * * 1-5`, set to your timezone.
2. Add **API / Webhook → GET**: `https://<APP_URL>/api/today?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** to yourself with the text `{{morningMessage}}` from the previous step (or: "What will you deliver today? <dashboard link>", using `dashboardUrl`).

### 3. 18:30 weekdays — what's still open

1. Trigger **Schedule**, `30 18 * * 1-5`.
2. Add the same GET step on `/api/today?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** to yourself with `{{eveningMessage}}`. It lists the items not yet delivered and the delivered items not yet asked. (The raw lists are also there as `notDelivered` and `notYetAsked`.)

### 4. Friday 17:00 — weekly summary to your manager

1. Trigger **Schedule**, `0 17 * * 5`.
2. Add a GET step on `https://<APP_URL>/api/digest?key=<DIGEST_KEY>`.
3. Add **Slack → Send message** (to the manager, or use `mentor.contact`, which is the field name in the payload) or **Gmail → Send email** with `{{summaryText}}`. It holds the hero sentence, Impact, Reliability, Answer rate and the items still waiting for an answer.

### 5. Optional backup — daily reminder check

If your host sleeps, add a flow on a daily schedule that calls `GET https://<APP_URL>/api/jobs/reminders?key=<DIGEST_KEY>`. It is safe to run any number of times: each item gets at most one reminder.

## API summary

| Route | Auth | What it does |
| --- | --- | --- |
| `POST /api/auth/register`, `/login` | rate-limited | Owner account (first account only) and sign-in |
| `GET /api/overview?view=day\|week&date=YYYY-MM-DD` | owner | Dashboard data for a day (default) or a week |
| `POST /api/items` | owner | Plan an item (optionally with `estimateMinutes` and `startTime`) |
| `POST /api/blocks`, `DELETE /api/blocks/:id` | owner | Add or remove meeting, learning or support time on a day (never scored) |
| `POST /api/planner/draft` | owner, rate-limited | The AI day planner: draft a day from text. It creates nothing |
| `POST /api/items/:id/deliver-file?name=` | owner | Deliver with an uploaded file as proof (raw file as the body) |
| `POST /api/items/:id/deliver` `/ask` `/drop` `/message` | owner | Deliver with proof, ask again, drop, get the copyable message |
| `GET/POST /api/answer/:token` | token, rate-limited | Answer page data and answers |
| `GET/POST/DELETE /api/share` | owner | Manager link status, create, revoke |
| `GET /api/manager/:token` | token | Read-only data for a share link |
| `GET /api/team`, `/api/team/:userId/overview` | manager | Team dashboard and one report's read-only desk |
| `GET/POST/DELETE /api/team/invites` | manager | Invite links for new team members |
| `GET /api/viasocket/token`, `/status`, `/slack/people`; `POST /api/viasocket/connected`, `/slack/me`, `/test/:app` | signed in | The person's own viaSocket connections (Slack and Gmail) |
| `POST /api/ai/ask`, `GET /api/ai/history` | manager | The manager's AI assistant |
| `GET /api/ai-tools/list_team`, `/team_summary`, `/employee_report` | per-manager pass | Read-only tools the AI calls |
| `GET /tasks/tick`, `/api/jobs/tick` | scheduler secret / `?key=` | Morning prompt and deadline reminders |
| `GET /api/integrations` | manager | Read-only viaSocket wiring status (no secrets) |
| `GET /api/auth/invite/:token` | rate-limited | Who invited you (join page) |
| `GET /api/today`, `/api/digest`, `/api/jobs/reminders` | `?key=DIGEST_KEY` | For viaSocket schedules |

## Project layout

```
client/   React + Vite + Tailwind (JavaScript)
server/   Express + SQLite (node:sqlite); dependencies live in the root package.json
  lib/store.js     database schema and queries
  lib/scoring.js   all scoring logic
  lib/hours.js     the 8-hour day: hours picture, timeline, slot layout (never part of a score)
  lib/planner.js   the AI day planner: draft a day from text, with validation
  lib/viasocket.js the only code that calls viaSocket
  jobs/reminders.js reminder logic (run daily by the host's scheduler)
```

## Notes

- The original brief asked for MongoDB; the data layer was switched to SQLite so the app runs anywhere with no database service. The schema in `server/lib/store.js` mirrors the User, Item, Answer, AnswerToken and ShareLink models.
- Node prints an "ExperimentalWarning: SQLite" line at startup. That is expected.
- Passwords are hashed with `bcryptjs` (a pure-JavaScript bcrypt, so deploys need no native build).
- v1 has no automated tests by request.
