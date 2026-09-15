# PrepList Pro

A shared study-help website: post questions, get answers, upload notes, add
videos, flag tricky questions for extra practice, and post events and
announcements. No accounts, no sign-up — pick a role (Student / Teacher /
Admin) and go. Public to anyone worldwide.

It's a single static page (`index.html`) — no build step, no server to run.
Data is stored in [Firebase](https://firebase.google.com/) Firestore on the
free "Spark" plan.

## One-time setup

### 1. Create a Firebase project
Go to <https://console.firebase.google.com/>, sign in, click **Add project**,
and finish the wizard (Google Analytics can be skipped).

### 2. Turn on Authentication (for a silent, invisible session only)
**Build → Authentication → Get started → Sign-in method → Anonymous →
Enable → Save.** This app has no visible login — this just lets Firebase
quietly give every visitor a session in the background, so the database
rules below have something real to check.

### 3. Turn on Firestore
**Build → Firestore Database → Create database** → **Start in production
mode** → pick a location → **Enable**. Then open the **Rules** tab and
replace the contents with everything in [`firestore.rules`](firestore.rules)
from this repo, and click **Publish**.

### 4. Get your web app config
**⚙️ → Project settings** → scroll to **Your apps** → click **`</>`** → give
it any nickname → **Register app** (skip the Hosting checkbox — GitHub
Pages is used instead). Copy the `firebaseConfig` block it shows you, open
`index.html` in this repo, and paste your six values in near the top of the
`<script type="text/babel">` block, replacing the placeholders. These values
are safe to publish — they're a public pointer to your project, not secret
keys. The `firestore.rules` you published are what actually govern access
(see the comment at the top of that file for what that does and doesn't
protect against, since this app has no accounts).

### 5. Turn on GitHub Pages
Repo **Settings → Pages** → **Source: Deploy from a branch** → **Branch:
main**, folder **/ (root)** → **Save**. GitHub gives you a URL within a
minute or two.

### 6. (Optional) Custom domain
If you own a domain (bought from any registrar — Namecheap, Google
Domains/Squarespace, GoDaddy, etc.), you can point it at this site instead
of the `github.io` address: add a `CNAME` file to the repo containing just
your domain, add the DNS records GitHub's Pages settings page shows you, and
GitHub Pages will serve the site there. Ask if you'd like help wiring this
up once you have a domain — buying one isn't something that can be done on
your behalf.

## How it's built

- **Precompiled, not transpiled live.** `app.jsx` is the real source; `app.js`
  is its compiled output, which is what `index.html` actually loads. This
  makes the site noticeably faster (no multi-hundred-KB Babel library to
  download, no JSX-to-JS work happening in every visitor's browser on every
  visit) at the cost of one extra step when changing the app: after editing
  `app.jsx`, recompile with
  `npx --yes @babel/cli --presets @babel/preset-react app.jsx --compact true --no-comments -o app.js`
  (a `babel.config.json` in this repo sets the classic JSX runtime it needs).
  If you're asking for changes rather than editing it yourself, this step is
  handled for you automatically.
- **No accounts.** Visitors pick a role (Student / Teacher / Admin) on
  entry; Teacher and Admin need the access password set in `index.html`
  (`ACCESS_PASSWORD`). Nothing is verified server-side — see the security
  note in `firestore.rules`.
- **No names collected anywhere** — posts show only a role ("Posted by a
  teacher"), and event volunteering is a simple headcount, not a signup
  form.
- **No build step.** React and Babel load from a CDN; JSX compiles in the
  browser.
- **Photos** are resized and stored as compressed JPEG data directly in
  Firestore documents (no paid storage plan needed) — every answer/solution
  gets its own document to stay under Firestore's 1&nbsp;MiB-per-document
  limit.
- **Moderation**: student-submitted questions/answers needing admin
  approval are tracked in a `reviewQueue` collection.
- **"My Prep List"** and grid-quiz answers are remembered per browser
  (localStorage), not tied to any account — clearing browser data resets
  them.
