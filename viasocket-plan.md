# viaSocket plan: users connect their own apps

Status: proposed, waiting for a yes. Skill: viasocket-integrations (2026-11-04.3), feature `app-integrations`, SDK format (Node.js, `viasocket-apps`).

## What people will see

- A **Connections** page for every signed-in person (employee or manager), with a **Connect Slack** and a **Connect Gmail** button, each showing the app's icon.
- Each person connects only their own accounts. A manager can never see or use an employee's connection.
- After connecting Slack, the person picks once which Slack person is them (changeable on the same card).
- A **Send me a test message** button on each connected app sends a fixed line to the person themself.
- Nothing else changes yet. The "Did it help?" ask, the team invite and the daily routine keep using the shared webhooks until it is decided which messages should go from a person's own account.

## Table (who supplies every value, and when)

| app | action (key, version) | key of `inputData` | who supplies it | when |
| --- | --- | --- | --- | --- |
| gmail | `Send_Email` `v55` | `to` | the product: the signed-in person's own account email | per run |
| gmail | `Send_Email` `v55` | `subject`, `messageBody` | the product: fixed test text | per run |
| gmail | `Send_Email` `v55` | `from`, `cc`, `bcc`, `fromName`, `replyTo`, `attachments`, `labelIds` | left out on purpose (Gmail's own defaults for the connected account) | never sent |
| slack | `Send_Message` `v107` | `destination.messageto` | the product: constant `"user"` (a direct message to one person) | constant |
| slack | `Send_Message` `v107` | `destination.userId` | the person, from the list of people in their Slack ("Which one is you?") | once, right after Connect; stored with the connection; changeable on the card |
| slack | `Send_Message` `v107` | `markdown_content` | the product: fixed test text | per run |
| slack | `Send_Message` `v107` | `destination.channel_id`, `destination.thread_*`, `destination.tagged_users`, `buttons`, `schedule_*`, `post_at`, `bot_details`, `preview` | left out on purpose | never sent |

Who picks the action: the product's code (the **Send me a test message** button). It is shown, and the Slack choice changed, on that person's Connections card.

## Where each secret lives

- `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID`, `VIASOCKET_EMBED_SECRET`: server settings only (`.env` locally, the host's settings online). Never sent to a browser.
- The browser gets only a short-lived per-person embed token from a signed-in endpoint, for the Connect popup.
- Each person's `auth_id` and enabled-app `script_id` are stored on the server per person and app. Before any run the server checks the signed-in person owns the id it is about to use.

## Tests to run on a real account before building on each call

1. Setup check (done): `listConnections()` for the test user answered with a real list.
2. Connect Slack and Gmail through the product's own button with a test account (one click from the owner).
3. Slack: list people (`listOptions` for `destination.userId`), then one `Send_Message` to the test account itself.
4. Gmail: one `Send_Email` to the test account itself.
5. `npx -y viasocket-apps check <folder>` over the integration code; every FAIL fixed.

Anything not run is listed as UNTESTED in the final report and is not switched on.
