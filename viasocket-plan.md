# viaSocket plan (revised): the whole catalog, in the product's own page

Status: confirmed by the owner with one change (Slack and Gmail must be on top with Connect buttons). Built; see the report in the chat for what is tested and what is UNTESTED. Skill: viasocket-integrations (2026-11-04.3), feature `app-integrations` with viaSocket's prebuilt screens (`embed.md`), SDK format (Node.js, `viasocket-apps`).
Replaces the first plan (Slack and Gmail only), which was rejected: the goal is that a person can connect ANY app.

## What people will see

- **On top:** Slack and Gmail cards with a Connect button each. After connecting Slack the person picks once which Slack person they are (changeable). **Send me a test message** sends a fixed line to that person only (Gmail: to their own account email).
- **Below:** every other app, through the screens below.

- The **Integrations** page, for every signed-in person (employee or manager), shows viaSocket's own screens inside the app: the catalog of every app (2,300+), a Connect button per app, a form for every action, and the person's own automations with their runs.
- Each person connects only their own accounts and builds only their own automations (for example "every morning, post my plan to Slack"). A manager cannot see or use an employee's connections or automations.
- Managers keep the existing "message setup" status cards (ask webhook, invite webhook, routine URLs) on the same page, above the viaSocket screens.
- Nothing else changes yet. The "Did it help?" ask, team invites and the daily routine keep using the shared webhooks.

## Table (who supplies every value, and when)

The product's code fills no action value. The person fills each action in viaSocket's own form, drawn from the action's real schema, with that form's option lists.

| app | action or trigger | key of `inputData` | who supplies it | when |
| --- | --- | --- | --- | --- |
| any app the person picks | any action or trigger they pick | every key | the person, in viaSocket's own form (lists for `PICK` keys come from viaSocket) | when they build an automation; saved by viaSocket with the automation |
| gmail | `Send_Email` `v55` | `to`, `subject`, `messageBody` | the product: the person's own account email and fixed test text | per test message |
| slack | `Send_Message` `v107` | `destination.messageto` (constant `"user"`), `markdown_content` (fixed test text) | the product | per test message |
| slack | `Send_Message` `v107` | `destination.userId` | the person, from the list of people in their Slack | once, right after Connect; stored with the connection; changeable |

Who picks the action: the person, on screen. Where it is shown and changed: the person's automation list inside the Integrations page.

## Choices I will make unless told otherwise (change any)

1. Landing screen: the person's own list ("Your automations"); the catalog is one click away.
2. Hidden: the "Custom Logic (JS)" and "HTTP/API Request" cards, to keep it simple for non-developers. Kept: apps, schedules, webhooks.
3. Colours and font follow the blue theme (Midnight Blue `#2B4257`, DM Sans).
4. The product does not store or call what people build. viaSocket runs it (a later step could run a person's automation when they mark something delivered).

## Where each secret lives

- `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID`, `VIASOCKET_EMBED_SECRET`: server settings only. Never sent to a browser.
- The browser gets only a per-person embed token from a signed-in endpoint (`GET /api/viasocket/token`), signed on the server with the secret. The person id inside it is our own user id, never the email.
- The page's security rules are widened for exactly two viaSocket addresses (the embed script and the embed frame), and the page ignores any message not from the embed's own origin.

## Tests to run on a real account before building on each call

1. Setup check (done): `listConnections()` answered with a real list.
2. The token endpoint answers a token for a signed-in test person and refuses a signed-out request.
3. The screens load in the product's box with that token and fill the box (a real browser run).
4. One test automation published as the test person reaches the page as a `published` event with a `webhookurl`, then a pause reaches it as `paused`.
5. Connect an app through the embedded Connect button with a test account (one click from the owner).
6. `npx -y viasocket-apps check <folder>`; every FAIL fixed.

Anything not run is listed as UNTESTED in the final report and is not switched on.
