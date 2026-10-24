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
- **Past Papers: board, exam type, subject, and syllabus code.** Each paper
  is tagged with an Exam board (Cambridge, Edexcel, or College Board), an Exam
  type (IGCSE / AS Level / A Level for Cambridge and Edexcel; SAT / AP for
  College Board), a Subject, and a Syllabus code picked from a dropdown that
  narrows to the real official codes for that board + level + subject
  (`SYLLABUS_CODES` in `app.jsx`, compiled from Cambridge's subject pages and
  Pearson's 2025/26 information manuals, including Edexcel's regional "R"
  papers used in the UAE and Oman and the Edexcel IAL unit codes). Subject
  and Syllabus are separate dropdowns, and Session (e.g. May/June) and Year
  are separate too. Zone and Variant apply to Cambridge papers only. SAT and
  AP have no syllabus-code system, so they use Section (SAT) / course name
  (AP) instead and the code field doesn't appear. Gaps are real: Edexcel has
  no International A Level in Computer Science or Chinese, so those
  combinations list no code.
- **Question papers + mark schemes.** Each Past Papers upload can include a
  Question Paper PDF, a Mark Scheme PDF, or both. Under the hood each PDF is
  its own Firestore document (`kind: "qp"` or `"ms"`, see `groupPapers()` in
  `app.jsx`) so a pair never has to fit Firestore's 1&nbsp;MiB document
  limit together — the app groups matching ones back into a single card
  with "Question Paper" / "Mark Scheme" buttons for display.
- **In-site PDF viewer with split screen.** Question papers and mark schemes
  open inside the site (not a new tab). "Side by side" shows both at once
  (stacked top/bottom on a phone); the header buttons show or hide either
  one, and each pane has New tab / Download. Press Escape to close. Files
  are turned into temporary blob URLs so the browser's built-in PDF viewer
  can display them (iPhone Safari may show only the first page in a frame —
  use New tab there).
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
- **Resources tab (links, not copies).** Past papers belong to the exam
  boards — Cambridge says it can't permit them to be republished on any
  website, and Pearson only allows private centre use — so this tab links to
  the official sources instead: Cambridge's per-subject past-paper pages,
  Pearson's past-paper finder, College Board's SAT practice and AP Central,
  plus Save My Exams as a clearly-labelled third-party link (its terms ban
  copying and scraping, so nothing of theirs is copied or embedded). Every
  link has "Open" (new tab) and "Half screen" (a popup window sized to the
  right half of the screen, so the site can sit on the left). Third-party
  sites block being embedded in a frame, which is why half screen is a
  window rather than an in-page pane.
- **Quiz tab.** Original multiple-choice practice questions (written for
  this site, not taken from any paper) with instant feedback and
  explanations, topic/subject/exam-type filters, an optional timer (SAT pace
  = ~71 s/question for Reading & Writing, ~95 s for Math), a results review,
  "retry the ones I missed", and a recent-scores list. "Split screen" keeps
  any note or uploaded paper open beside the question. Teachers/Admins can
  add or delete questions (Firestore `quizQuestions`) — only questions they
  wrote themselves.
- **Grade tracker (Tools tab).** For SABIS students and anyone else: log
  quiz / monthly / term marks with your own weights, see a running average
  per subject, and see what you need on the next assessment to hit a target.
  It's an estimate stored on-device, not an official grade or SABIS's own
  point system.
- **IB board.** Past Papers also has an IB board (exam type "IB Diploma") so
  IB material can be organised the same way. IB past papers are sold by the
  IB, so none are included and uploads should only be things you have
  permission to share.
- **Grade-tracker presets.** Pick a weight preset to fill in typical
  assessment names and weights, or save your school's own. The built-in
  "SABIS-style" preset is just a starting point — its weights are not
  official SABIS numbers.
- **Tools tab.** Exam countdown (your own dates), a focus/break study timer
  (the browser tab title shows the time left), and Digital SAT pacing
  reference. All stored on-device.
- **Revision checklist.** The Checklist tab lets Teachers and Admins lay out
  a list of topics per subject; anyone can tick items off as studied. The
  topic list itself is shared (Firestore, `checklistItems` collection) but
  which boxes are checked is personal per device (`localStorage`), same as
  the rest of this no-accounts app.
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
