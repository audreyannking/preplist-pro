# PrepList Pro

A shared study-help website: students post questions, teachers and admins
answer them, upload notes, add videos, flag tricky questions for extra
practice, and post events/announcements. Everything is public to anyone who
makes an account — worldwide, not tied to one school.

It's a single static page (`index.html`) — no build step, no server to run.
Data (accounts, questions, notes, photos, everything) is stored in
[Firebase](https://firebase.google.com/) on the free "Spark" plan.

## One-time setup (takes about 10 minutes)

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/> and sign in with any Google account.
2. Click **Add project**, give it a name (e.g. `preplist-pro`), and finish the wizard (you can turn off Google Analytics — not needed).

### 2. Turn on Authentication

1. In the left sidebar, click **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password** (the first option in the list) and save.

### 3. Turn on Firestore (the database)

1. In the left sidebar, click **Build → Firestore Database → Create database**.
2. Choose **Start in production mode**, pick any location close to your users, and click **Enable**.
3. Once it's created, go to the **Rules** tab and replace the contents with everything in [`firestore.rules`](firestore.rules) from this repo, then click **Publish**.

### 4. Get your web app config

1. Click the gear icon (⚙️) next to **Project Overview** → **Project settings**.
2. Scroll to **Your apps**, click the **</>** (web) icon, give the app any nickname, and click **Register app**. Skip the "Firebase Hosting" checkbox — GitHub Pages is used instead.
3. You'll see a code block starting with `const firebaseConfig = { ... }`. Copy those six values.
4. Open `index.html` in this repo, find the `firebaseConfig` object near the top of the big `<script type="text/babel">` block, and paste your six values in, replacing the `YOUR_...` placeholders. Commit and push.

These values are safe to publish — they're a public pointer to your project, not secret keys. The `firestore.rules` you published in step 3 are what actually protect the data.

### 5. Turn on GitHub Pages

1. On GitHub, go to this repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. GitHub gives you a URL like `https://audreyannking.github.io/preplist-pro/` within a minute or two — that's the live site.

That's it — from then on, any push to `main` updates the live site automatically, and every visitor's data (accounts, questions, photos, everything) is saved permanently in Firestore.

## Notes on how it's built

- **No build step.** React and Babel are loaded from a CDN and JSX is compiled in the browser. Simple to deploy, but slightly slower to first paint than a compiled bundle — fine for this app's size and audience.
- **Accounts** use Firebase Authentication under the hood; usernames are mapped to a fake `@preplistpro.local` email internally (never actually emailed anywhere).
- **Photos** are resized and stored as compressed JPEG data directly in Firestore documents (no Firebase Storage, which needs a paid plan) — kept under Firestore's 1&nbsp;MiB-per-document limit by giving every answer/solution its own document.
- **Moderation** (student-submitted questions/answers needing admin approval) is tracked in a `reviewQueue` collection so the admin's Review tab doesn't have to scan the whole database.
- **Security**: see the comment at the top of `firestore.rules` — role permissions (only admins approve, etc.) are enforced in the app's UI, not the database, so treat this as a community tool rather than something handling sensitive data. The `ACCESS_PASSWORD` gate for teacher/admin signup (in `index.html`) is a light deterrent, not real security — anyone can read it in the page's source.
- **No AI import feature.** An earlier version could import quiz questions from a photo using Claude; that needed a server to keep an API key secret, which this static-site setup doesn't have. Ask if you'd like that added back via a small serverless function.
