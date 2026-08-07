# Gestion - منصة مراسلة جماعية

Gestion is a group messaging platform built with **React + Vite + Firebase + Tailwind CSS**.

## Features
- Email/password authentication
- Sign up with full name, username, password, cover & profile images
- Group chats list with create/delete
- Chat room with user avatars, message bubbles, media (images, videos, audio), and live voice recording
- User profile with cover image and message button
- Push notifications via Web Push (auto-generated VAPID keys, no Firebase VAPID setup needed)
- Deployable to Vercel + Cloudflare

## Project structure
```
gestion/
├── web/          # React web app (Vercel)
├── android/      # Android WebView wrapper (APK)
└── README.md
```

## Quick start

1. Copy `web/.env.example` to `web/.env` and fill in your Firebase config.
2. Run:
   ```bash
   cd web
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173`

## Deploy to Vercel
1. Push the `web/` folder to a GitHub repo or import into Vercel.
2. Add the environment variables from `.env.example` in the Vercel dashboard.
3. Build command is already set to `npm run build`.
4. For SPA routing, `vercel.json` is included.

## Firebase setup
- Enable **Authentication** with Email/Password.
- Create **Cloud Firestore** database.
- For push notifications, the VAPID keys are auto-generated (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- Set `FIREBASE_ADMIN_KEY` to the base64-encoded content of your Firebase Admin SDK service account JSON (used by `/api/notify.js` for auth verification).
- For testing, `firestore.rules` is open to all. Do not use in production.

## Cloudflare R2 file storage
Media files are uploaded to **Cloudflare R2** via a Vercel serverless function.

1. Create an R2 bucket in the Cloudflare dashboard.
2. Create an R2 API token with `Edit` permission for that bucket.
3. In Vercel, set the server-only variables:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_URL` (your custom/public domain or `https://pub-...r2.dev`)
4. The Android APK needs the deployed API URL. Set `VITE_API_BASE=https://yourdomain.vercel.app` before building the APK.

## Android APK
Note: The APK is a WebView wrapper. Web Push (service worker/push events) does **not** work inside a WebView. Push notifications in the APK require native Firebase Cloud Messaging integration.

A manual build script is provided at `android/build.sh`.
```bash
cd android
./build.sh
```
The APK will be at `android/build/gestion-debug.apk`.

To embed your config into the APK:
1. Set values in `web/.env`.
2. Run `cd web && npm run build`.
3. Run `cd android && ./build.sh` again.
