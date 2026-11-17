# Inbox — read-only Telegram web reader

Next.js (App Router) + GramJS. Multi-account: each account has its own `api_id`/`api_hash` and Telegram session, switchable from the left rail and editable at any time.

## Run locally
    npm install
    cp .env.example .env.local   # set APP_PASSWORD and APP_SECRET
    npm run dev                  # accounts kept encrypted in .data/store.json (set DATABASE_URL to use Postgres + the archive)

## Deploy to Vercel
1. Push this folder to a Git repo and import it in Vercel.
2. Add a **Postgres** database (Neon via Vercel Marketplace works); it provides `DATABASE_URL`. It stores your accounts (encrypted) and the message archive; tables are created automatically.
3. Set env vars: `APP_PASSWORD` (what you type to open the app) and `APP_SECRET` (long random string, e.g. `openssl rand -hex 32`), and `CRON_SECRET` (any long random string). Do not change `APP_SECRET` later or stored sessions become unreadable.
4. Deploy, open the site, unlock, add an account, sign in with your phone number + code.

## How it works on serverless
- Vercel functions can't keep a Telegram connection open, so every request connects with your saved session, does one job, and disconnects. Expect ~1s latency per action.
- No live push: the open chat refreshes every 8s and the chat list every 15s while the tab is visible.
- API hashes and sessions are AES-256-GCM encrypted before they hit Postgres. A Telegram session = full account access, so keep `APP_PASSWORD` strong.
- The app never marks messages as read.
- Only small previews of photos/videos are fetched; originals are never downloaded.

## Message archive (deleted-message safety net)
- Every message the app sees is copied to Postgres. If Telegram later stops returning a message that was archived, it is marked **deleted** (kept, with its text) and shown with a red dashed border when you turn on **Deleted** in the chat header. Edited messages keep their earlier versions.
- Telegram never gives deleted messages back, so only messages saved *before* deletion can be shown. Use the archive button in a chat header to save its full history now, and let the daily cron (`vercel.json`, 03:00 UTC; hourly is allowed on Pro) sweep your 40 most recent chats.
- Deletions are only noticed when the app re-reads the same chat range (opening the chat, the cron, or a history save). Photo/video previews are cached too; original files are not stored.
- The archive is keyed by the Telegram user id, so removing and re-adding an account reconnects to the same archive. Messages are stored as plain text in your database (the provider encrypts the disk), so use a private database.
