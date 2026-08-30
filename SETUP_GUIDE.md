# Robux Savings Quest — Beginner Setup Guide

This walks you through everything from zero to a live public website, assuming no prior experience with Firebase or GitHub.

**Files in this project:**
- `index.html` — page structure
- `style.css` — all visual styling
- `app.js` — logic (Firebase, real-time updates, admin panel)
- `firestore.rules` — security rules that protect your data

---

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project**.
3. Name it something like `robux-savings-tracker` → **Continue**.
4. You can disable Google Analytics (not needed) → **Create project** → wait, then **Continue**.

## 2. Enable Firestore

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (we'll set our own rules below) → **Next**.
4. Pick a location close to you (e.g. `asia-southeast1`) → **Enable**.

## 3. Enable Firebase Authentication

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in providers**, click **Email/Password**, toggle it **Enabled**, then **Save**.

## 4. Create the Admin account

1. Still in **Authentication**, go to the **Users** tab.
2. Click **Add user**.
3. Enter an email and a strong password (this is what *you*, the Admin, will log in with — nobody else will see this screen).
4. Click **Add user**.
5. Click on the new user row and copy the **User UID** shown — you'll need it in step 7. It looks like `Xy8fQwErTz...`.

> This account is the *only* thing that can add, edit, or delete contributions. There is no admin password stored anywhere in the code — authentication is handled entirely by Firebase.

## 5. Get your Firebase config

1. Click the **gear icon ⚙️** next to "Project Overview" → **Project settings**.
2. Scroll to **Your apps** → click the **</>** (web) icon to register a new web app.
3. Give it a nickname like `robux-tracker-web` → **Register app**.
4. Firebase shows a code block with a `firebaseConfig` object containing `apiKey`, `authDomain`, `projectId`, etc. Copy this whole object.

## 6. Add the config to app.js

1. Open `app.js` in any text editor.
2. Find this section near the top:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID",
   };
   ```
3. Replace it with the real object you copied in step 5. Save the file.

> Note: it's normal and safe for the `apiKey` to be visible in client-side code — Firebase API keys are not secret. What actually protects your data is the Firestore **security rules**, configured next.

## 7. Configure Firestore Security Rules

1. Open `firestore.rules` in your text editor.
2. Find this line:
   ```
   && request.auth.uid == "ADMIN_UID_PLACEHOLDER";
   ```
3. Replace `ADMIN_UID_PLACEHOLDER` with the User UID you copied in step 4, so it looks like:
   ```
   && request.auth.uid == "Xy8fQwErTz...";
   ```
4. In the Firebase console, go to **Firestore Database → Rules** tab.
5. Delete the existing default rules and paste in the entire contents of your edited `firestore.rules`.
6. Click **Publish**.

This means:
- ✅ Anyone can *read* the savings data (powers the public dashboard).
- 🔒 Only a request authenticated as your Admin UID can *write* (add/edit/delete) — enforced by Firebase's servers, not just by hiding a button.

## 8. Test the website locally

1. You can't just double-click `index.html` (Firestore's SDK needs a real server context for some browsers). The simplest option:
   - Install the free **Live Server** extension in VS Code, right-click `index.html` → **Open with Live Server**, or
   - Run `python3 -m http.server 8000` inside the project folder and visit `http://localhost:8000`.
2. You should see the dashboard with all 4 players at ₱0.
3. Press **Ctrl+Shift+A** (or **Cmd+Shift+A** on Mac) to open the hidden Admin login.
4. Sign in with the Admin email/password from step 4.
5. Add a test contribution and confirm the card updates instantly.

## 9. Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in (create a free account if needed).
2. Click the **+** icon top-right → **New repository**.
3. Name it `robux-savings-tracker` → set it to **Public** → **Create repository**.

## 10. Upload the files

**Easiest way (no command line):**
1. On your new repo's page, click **uploading an existing file** (or **Add file → Upload files**).
2. Drag in `index.html`, `style.css`, `app.js`, and `firestore.rules`.
3. Scroll down and click **Commit changes**.

## 11. Enable GitHub Pages

1. In your repository, click **Settings** (top tab).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose `main` and folder `/ (root)` → **Save**.
5. Wait 1–2 minutes for GitHub to build the site.

## 12. Get the final public website URL

1. Refresh the **Pages** settings screen — it will show a green banner with your live URL, typically:
   ```
   https://YOUR-GITHUB-USERNAME.github.io/robux-savings-tracker/
   ```
2. Visit that link — you should see the live public dashboard, no login required.

## 13. Access the secret Admin panel

- On the live site, press **Ctrl+Shift+A** (Windows/Linux) or **Cmd+Shift+A** (Mac) anywhere on the page.
- This opens the Admin sign-in form. There is no visible button for it anywhere on the public dashboard.
- On a phone, you'd need a Bluetooth keyboard to trigger this — if you want a touch-friendly secret trigger too, a simple option is to add a small invisible tap zone; ask if you'd like that added.

## 14. Add the first contribution

1. Press the shortcut, sign in with your Admin email/password.
2. In the Admin panel, choose a player, enter an amount, optionally add a note, click **Add Contribution**.
3. Watch the public dashboard card update in real time, with a milestone toast if a threshold (25/50/75/100%) is crossed.

## 15. Update the website later

- To change any file: edit it locally, then go to your GitHub repo → click the file → the pencil (✏️) **Edit** icon → paste in the new content → **Commit changes**.
- GitHub Pages automatically redeploys within a minute or two — no extra steps needed.
- To change the ₱345 per-person goal, edit the `GOAL_PER_PERSON` constant near the top of `app.js` and re-upload.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Dashboard stays at ₱0 / blank | `firebaseConfig` in `app.js` still has placeholder values |
| "Sign-in failed" in Admin login | Wrong email/password, or Email/Password sign-in not enabled in step 3 |
| Can sign in but "Could not add contribution" | The UID in `firestore.rules` doesn't match your Admin account's real UID, or rules weren't published |
| Works locally but not on GitHub Pages | Make sure all 4 files were uploaded to the repo root (not inside a subfolder), and Pages is enabled on the `main` branch |

---

**Reminder:** this site only tracks money saved toward a future Robux purchase — it does not buy, sell, or transfer Robux itself.
