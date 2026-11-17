# Inbox — read-only Telegram web reader

Next.js (App Router) + GramJS. Multi-account: each account has its own `api_id`/`api_hash` and Telegram session, switchable from the left rail and editable at any time.

## Run locally
    npm install
    cp .env.example .env.local   # set APP_PASSWORD and APP_SECRET
    npm run dev                  # accounts kept encrypted in .data/store.json (set DATABASE_URL to use Postgres + the archive)

## Deploy to Vercel
1. Push this folder to a Git repo and import it in Vercel.
2. Add a **Postgres** database (Neon via Vercel Marketplace works); it provides `DATABASE_URL`. It stores your accounts (encrypted) and the message archive; tables are created automatically.
3. Set env vars: `APP_PASSWORD` (one-time setup key, needed only to create the first admin) and `APP_SECRET` (long random string, e.g. `openssl rand -hex 32`), and `CRON_SECRET` (any long random string). Do not change `APP_SECRET` later or stored sessions become unreadable.
4. Deploy and open the site. First visit asks you to create the admin account (username, password, and the `APP_PASSWORD` setup key). Then add a Telegram account and sign in with your phone number + code.

## How it works on serverless
- Vercel functions can't keep a Telegram connection open, so every request connects with your saved session, does one job, and disconnects. Expect ~1s latency per action.
- No live push: the open chat refreshes every 8s and the chat list every 15s while the tab is visible.
- API hashes and sessions are AES-256-GCM encrypted before they hit Postgres. A Telegram session = full account access, so keep `APP_PASSWORD` strong.
- The app never marks messages as read.
- Only small previews of photos/videos are fetched; originals are never downloaded.

## Message archive (deleted-message safety net)
- **Automatic:** after you sign in, the app copies every chat into Postgres in the background (newest 3,000 messages per chat), with a progress bar and a Pause button at the bottom of the chat list. Each sign-in only tops up chats that changed. Unfinished chats resume where they stopped, and the daily cron (`vercel.json`, 03:00 UTC) keeps backfilling and refreshing your 40 most recent chats even when nobody is signed in.
- **Deleted messages stay in the chat** as a dashed "Deleted message" line. Click **Show** to read it (and **Hide** to collapse it again). Edited messages keep their earlier versions under "Edited".
- The floppy-disk button in a chat header saves that chat's **entire** history (no 3,000 limit), after a confirmation.
- Telegram never gives deleted messages back, so only messages saved *before* they were deleted can be shown. A deletion is noticed when the app re-reads that part of the chat (opening it, the next sign-in's refresh, or the daily job).
- Photo/video previews are cached too; original files are not stored. The archive is keyed by the Telegram user id, so removing and re-adding an account reconnects to the same archive. Messages are stored as plain text in your database (the provider encrypts the disk), so use a private database.

## Sharing with family (multi-user)
- Everyone gets their own username and password. Open the account menu (top of the chat list) → **People** (admin only) → add a person, then send them the link, username and password.
- Each person sees only the Telegram accounts they added themselves. This is enforced on the server for every account route, not just hidden in the UI, so even the admin can't open someone else's chats from inside the app.
- Passwords are stored as scrypt hashes, must be 8+ characters, and 5 wrong tries lock that username for 15 minutes. Changing or resetting a password signs out that user's other browsers.
- Removing a person deletes their Telegram accounts **and their archived messages** from the database.
- Honest limit: whoever controls the deployment (your Vercel env + database) technically holds `APP_SECRET`, so they could read stored sessions outside the app. Tell family that, and have them use their own `api_id`/`api_hash` from my.telegram.org.
- Upgrading an existing install: tables migrate automatically; accounts saved before multi-user existed are assigned to the first admin you create.

## PR previews
Every pull request into `main` gets its own Vercel preview with its own Neon database branch (`preview/pr-<n>`), via `.github/workflows/preview.yml`. A comment on the PR links to `tg-reader-pr-<n>.vercel.app` (always the newest push). Closing the PR deletes the branch. Previews never run the daily cron.

One-time setup:
1. **Neon:** create a branch `development` (Branches → New branch). Previews copy it, so keep it free of real Telegram sessions. Set the GitHub variable `NEON_PREVIEW_PARENT_BRANCH` if you name it differently.
2. **GitHub** (repo → Settings → Secrets and variables → Actions):
   - Secrets: `NEON_API_KEY` (Neon → account menu → Account settings → API keys → Create), `VERCEL_TOKEN` (vercel.com/account/tokens).
   - Variables: `NEON_PROJECT_ID` (Neon → project → Settings → General), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (run `npx vercel link` here, then read `.vercel/project.json`).
3. **Vercel env vars, "Preview" scope:** `APP_SECRET`, `APP_PASSWORD`, `CRON_SECRET`. Leave `DATABASE_URL` unset for Preview: the workflow injects the branch's URL. Use a different `APP_SECRET` than production.
4. If previews ask for a Vercel login, turn off Deployment Protection for previews (Project → Settings → Deployment Protection), or keep it on and accept the extra login.

## Settings, language, archived chats
- The sliders button in the left bar opens **Settings**: language (English / Bahasa Indonesia), change password, and (admins only) **People**. The language is also switchable on the sign-in page.
- Telegram's own **Archived chats** folder shows up as the **Archived** filter above the chat list (like the Telegram app, archived chats are not mixed into All).
- Actions report back with short toasts (click one to dismiss it).

## Pinned messages
- Hover a message and press the pin to keep it. The pushpin in a chat header lists that chat's pins; the pushpin in the left bar lists every pinned message of the current Telegram account (with "Open chat").
- **Pin a conversation** with the to-top button in a chat header: pinned conversations stay at the top of the chat list (marked with a pushpin). Clicking a pinned message in the list jumps to it in the chat (a **Back to the latest messages** button brings you back).
- Pins live only in this app's Postgres (`pins` table). They never pin, read or change anything on Telegram. A pinned message keeps its text even if it is deleted on Telegram later (it is flagged "Deleted on Telegram, kept here").
