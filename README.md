# PrepList Pro

A shared study website: notes, videos, and past exam papers. Past papers are
organized by subject, exam type (IGCSE / AS Level / A Level), zone, and
variant, matching how Cambridge papers are labeled. No accounts, no sign-up —
pick a role (Student / Teacher / Admin) and go. Public to anyone worldwide.

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
  teacher").
- **Math notation.** Question/note text fields have a small toolbar
  (π, √, fractions, integrals, etc.) that inserts real LaTeX, rendered via
  KaTeX wherever that text is shown.
- **Photos** (note scans) are resized and stored as compressed JPEG data
  directly in Firestore documents — no paid storage plan needed.
- **Past-paper PDFs** are stored the same way, capped at ~700KB per file to
  stay under Firestore's 1&nbsp;MiB-per-document limit (see `MAX_PDF_BYTES`
  in `app.jsx`). Heavily scanned, image-heavy papers may not fit — ask if
  you want to switch to Firebase Storage for larger files (needs the paid
  "Blaze" plan, which needs a card on file, though actual cost should stay
  $0 at this scale).
- **Past Papers subjects.** The Past Papers tab has its own fixed subject
  list (`PAPER_SUBJECTS` in `app.jsx`): Math, Physics, Chemistry, Biology,
  English, History, Computer Science, Economics, Business, French, Arabic,
  Mandarin Chinese — separate from the subject list used by Notes/Videos.
  Each paper is also tagged with a Zone (1–3), a Variant (1–3), and a
  free-text Syllabus code (e.g. "0610" for Biology) — syllabus codes vary
  per subject and curriculum, so instead of a fixed list, whoever uploads a
  paper types the code straight off the paper's cover page, and the browse
  filter is built from whatever codes have actually been uploaded so far.
- **Continue where you left off, and a Saved tab.** Notes, Videos, and Past
  Papers each remember the last item you opened on this device (stored in
  `localStorage`, since there are no accounts) and show a "Continue where
  you left off" shortcut back to it. For past papers this jumps straight
  back to the same PDF — it can't resume mid-document, since PDFs open in
  the browser's own viewer rather than an embedded one the app can track.
  Every note, video, and past paper also has a bookmark button, and the
  **Saved** tab lists everything you've bookmarked (grouped by type)
  alongside the most recent item from each of the other three tabs —
  tapping any entry jumps straight back to it.
- **No AI PDF-to-quiz conversion (yet).** That would need a real AI model
  reading the PDF, which needs an API key kept secret on a small backend —
  ask if you want that built.
