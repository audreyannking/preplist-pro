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
- **Built to handle many visitors.** The site itself is static files on
  GitHub Pages (served from a CDN), so page loads scale easily. The database
  work is kept light: each tab only reads its own collection the first time
  it's opened, big files (PDFs, scanned notes) sit in a separate `files`
  collection and are fetched only when someone opens them, and Firestore's
  local cache means returning visitors re-download only what changed.
  `firestore.rules` allows reading without signing in (everything is public
  study material), so a whole school on one network can't be blocked by
  Firebase's limit on new anonymous sign-ins per IP. The real ceiling is
  the free Firestore plan's 50,000 document reads/day — upgrade to the
  pay-as-you-go Blaze plan if the site gets big.
- **Past Papers tab (links, not copies).** Past papers belong to the exam
  boards — Cambridge says it can't permit them to be republished on any
  website, and Pearson only allows private centre use — so this tab links to
  the official sources instead: Cambridge's per-subject past-paper pages,
  Pearson's past-paper finder, College Board's SAT practice and AP Central,
  plus Save My Exams as a clearly-labelled third-party link (its terms ban
  copying and scraping, so nothing of theirs is copied or embedded). Every
  link has "Open" (new tab). Cambridge and Khan Academy pages also have
  "Split view": two pages shown side by side inside this site (it only shows
  their own pages and PDFs from their servers; nothing is copied). Pearson,
  College Board and the IB refuse to be shown inside other sites, so those
  links get "Left half" / "Right half" popup windows instead, which depend
  on the browser allowing sized windows.
- **Quiz tab.** Original multiple-choice practice questions (written for
  this site, not taken from any paper) with instant feedback and
  explanations, topic/subject/exam-type filters, an optional timer (SAT pace
  = ~71 s/question for Reading & Writing, ~95 s for Math), a results review,
  "retry the ones I missed", and a recent-scores list. "Split screen" keeps
  any note or uploaded paper open beside the question. Teachers/Admins can
  add or delete questions (Firestore `quizQuestions`) — only questions they
  wrote themselves.
- **Grade tracker (Tracker tab).** For SABIS students and anyone else: log
  quiz / monthly / term marks with your own weights, see a running average
  per subject, and see what you need on the next assessment to hit a target.
  It's an estimate stored on-device, not an official grade or SABIS's own
  point system.
- **Grade-tracker presets.** Pick a weight preset to fill in typical
  assessment names and weights, or save your school's own. The built-in
  "SABIS-style" preset is just a starting point — its weights are not
  official SABIS numbers.
- **Flashcards and study streak.** Flashcards lets you make your own decks
  (device-only) with a simple box system — right answers show less often,
  misses come back sooner. A study streak on the Tracker tab counts days you
  finish a quiz, a flashcard round or a focus block.
- **Tracker tab.** Exam countdown (your own dates), a focus/break study timer
  (the browser tab title shows the time left), and Digital SAT pacing
  reference. All stored on-device.
- **Cambridge paper picker (Past Papers tab).** Pick a level, subject and series,
  then open each question paper or mark scheme as its own option in the split
  view, or paper + mark scheme side by side. The list lives in
  `cambridge-papers.json`, built from the links on Cambridge's public
  past-paper pages (links only — the PDFs stay on Cambridge's servers).
  Cambridge's public pages only list the latest series plus specimens, and
  the list needs rebuilding when Cambridge publishes a new series.
- **Global search.** The search icon in the header opens one search box
  that looks across Notes, Videos, Past Papers, and the Checklist at once
  and jumps straight to whatever you pick.
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
- **Past Papers source chips.** Cambridge, Edexcel, SAT, AP, IB and Save My
  Exams each get their own view. The site doesn't host papers (the exam
  boards don't allow that) — it links to the official sources. The SAT has no
  "past papers"; College Board publishes practice tests and a question bank.
- **Flashcards from a photo.** Upload or take a photo of notes and the text
  is read on the device with Tesseract.js (loaded from a CDN), then lines
  like "Term: definition", question/answer pairs and "X is Y" sentences are
  suggested as cards for you to check. It's pattern matching, not AI.
- **Always the newest version.** `index.html` fetches `version.txt` fresh on
  every visit and loads `app.js?v=<that value>`, so browsers can't get stuck on
  a cached old copy. When you deploy, put a new value in `version.txt` (the
  last line of the deploy steps) — it is also shown at the bottom of the site.
