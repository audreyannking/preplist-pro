const { useState, useEffect, useCallback, useMemo, useContext, createContext, useRef } = React;

/* ---------------------------------------------------------------------- */
/* Firebase setup                                                         */
/* These are public client config values, not secrets — Firebase's real   */
/* protection is the security rules deployed alongside this site.         */
/* ---------------------------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyBgIB9MNG-bW2OvtcAmoa2odagXzjQjMkk",
  authDomain: "preplist-pro-6c98d.firebaseapp.com",
  projectId: "preplist-pro-6c98d",
  storageBucket: "preplist-pro-6c98d.firebasestorage.app",
  messagingSenderId: "498768019855",
  appId: "1:498768019855:web:553e96725098d77497cbfa"
};

const FIREBASE_READY = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf("YOUR_") !== 0);
let auth = null, db = null;
if (FIREBASE_READY) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  // Keep a local copy so returning visitors re-download (and are billed for) only what changed.
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

// Silently sign every visitor in "anonymously" — no fields, no prompt,
// nothing shown on screen. This exists purely so Firestore's rules can
// require request.auth != null instead of being wide open to anyone on
// the internet, while the app itself still has no login of any kind.
function useAnonymousSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!FIREBASE_READY) { setReady(true); return; }
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) { setReady(true); }
      else { auth.signInAnonymously().catch((e) => { console.error("[preplist] anonymous sign-in failed", e); setReady(true); }); }
    });
    return unsub;
  }, []);
  return ready;
}

// Global toast for write failures — every db write surfaces a real,
// visible error instead of silently doing nothing (the previous bug).
const ToastContext = createContext(() => {});
function useToast() { return useContext(ToastContext); }
function friendlyDbError(e) {
  if (e && e.code === "permission-denied") return "The database refused that — the site's Firebase setup may need a step finished (ask whoever set it up).";
  if (e && e.code === "resource-exhausted") return "The site is very busy right now (its free daily limit was reached) — please try again later.";
  if (e && e.code === "unavailable") return "Couldn't reach the database — check your connection and try again.";
  return "Something went wrong saving that — try again.";
}
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.kind === "error";
  return (
    <div className="pp-pop" style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 22, zIndex: 80,
      maxWidth: 420, background: isError ? "#F6DEDE" : "#DCEFD9", color: isError ? "#6E2A2A" : "#254D22",
      border: `1.5px solid ${isError ? "#8A3434" : "#33662F"}`, borderRadius: 10, padding: "12px 14px",
      display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.45, boxShadow: "0 6px 20px rgba(0,0,0,0.18)"
    }}>
      <span style={{ flex: 1 }}>{toast.text}</span>
      <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, flexShrink: 0 }}><X size={14} /></button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Icons — small hand-drawn set (24x24, stroke-based)                     */
/* ---------------------------------------------------------------------- */

const ICON_PATHS = {
  sun: <><circle cx="12" cy="12" r="4"/><line x1="12" y1="1.5" x2="12" y2="4.2"/><line x1="12" y1="19.8" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4.2" y2="12"/><line x1="19.8" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="4.6" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="19.4" y2="4.6"/></>,
  moon: <path d="M20.5 14.8A8.5 8.5 0 1 1 9.7 4a7 7 0 0 0 10.8 10.8Z"/>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  x: <><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/><line x1="18.5" y1="5.5" x2="5.5" y2="18.5"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><line x1="20" y1="20" x2="15.3" y2="15.3"/></>,
  check: <polyline points="4.5,13 9.5,18 19.5,6.5"/>,
  star: <polygon points="12,2.8 14.7,9.1 21.6,9.6 16.3,14 18.1,20.7 12,17 5.9,20.7 7.7,14 2.4,9.6 9.3,9.1"/>,
  upload: <><line x1="12" y1="4" x2="12" y2="15.5"/><polyline points="7,9.2 12,4 17,9.2"/><path d="M4.5 16v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></>,
  flag: <><line x1="5" y1="3" x2="5" y2="21"/><path d="M5 4.2h12l-2.7 4L17 12.2H5Z"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.6 3.6-7 8-7s8 2.4 8 7"/></>,
  logout: <><path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5"/><polyline points="14,8 19,12 14,16"/><line x1="19" y1="12" x2="8.5" y2="12"/></>,
  messagesquare: <><rect x="3" y="4.2" width="18" height="12" rx="2.2"/><path d="M8.5 16.2l-2.3 3.4v-3.4"/></>,
  image: <><rect x="3" y="4.2" width="18" height="15.6" rx="2"/><circle cx="8.7" cy="9.6" r="1.7"/><path d="M4 18l5.2-5 4 3.8 3-2.8L20 18"/></>,
  bookopen: <><path d="M12 6.5c-2-1.6-5.2-2.1-8.3-1.1v13c3.1-1 6.3-.5 8.3 1.1 2-1.6 5.2-2.1 8.3-1.1v-13c-3.1-1-6.3-.5-8.3 1.1Z"/><line x1="12" y1="6.5" x2="12" y2="19.5"/></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16.5 10l4.5-3v10l-4.5-3Z"/></>,
  loader2: <><circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/></>,
  filetext: <><path d="M6 2.3h8.5L19.5 7v14.7H6Z"/><line x1="9" y1="13.2" x2="15" y2="13.2"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9.4" x2="11.5" y2="9.4"/></>,
  pencil: <><path d="M4 20l0.8-4.2L15.4 5.2l3.4 3.4L8.2 19Z"/><line x1="14" y1="6.6" x2="17.4" y2="10"/></>,
  sparkles: <><path d="M12 3.2l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3-4.3-1.5 4.3-1.5Z"/><path d="M19 14.5l0.8 2.1 2.1 0.8-2.1 0.8-0.8 2.1-0.8-2.1-2.1-0.8 2.1-0.8Z"/></>,
  graduationcap: <><path d="M2 9.2 12 5l10 4.2-10 4.2Z"/><path d="M6.3 11.2v5c0 1.7 2.9 3 5.7 3s5.7-1.3 5.7-3v-5"/><path d="M20.5 10v5.4"/></>,
  listchecks: <><polyline points="3,6 4.4,7.4 6.8,5"/><line x1="9.8" y1="6" x2="20.5" y2="6"/><polyline points="3,12 4.4,13.4 6.8,11"/><line x1="9.8" y1="12" x2="20.5" y2="12"/><polyline points="3,18 4.4,19.4 6.8,17"/><line x1="9.8" y1="18" x2="20.5" y2="18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12.3 15.8,14.3"/></>,
  briefcase: <><rect x="3" y="7.2" width="18" height="12.6" rx="2"/><path d="M8.2 7.2V5.4a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2v1.8"/></>,
  shieldcheck: <><path d="M12 2.3l7.7 2.8v5.8c0 5-3.3 8.4-7.7 10.8-4.4-2.4-7.7-5.8-7.7-10.8V5.1Z"/><polyline points="8.7,12 10.8,14.1 15.3,9.6"/></>,
  layoutgrid: <><rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.6"/></>,
  chevronright: <polyline points="9,5 16,12 9,19"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></>,
  users: <><circle cx="8.8" cy="8.3" r="3.1"/><path d="M3 19.8c0-3.4 2.6-5.3 5.8-5.3s5.8 1.9 5.8 5.3"/><circle cx="17" cy="9.2" r="2.5"/><path d="M14.6 14.4c2.5 0.4 4.1 2 4.4 5.1"/></>,
  megaphone: <><path d="M3 10.2v4.2h2.9l8.6 3.8V6.4Z"/><path d="M17.5 9a3.1 3.1 0 0 1 0 6.2"/></>,
  camera: <><path d="M4 8h3l1.4-1.9h7.2L17 8h3a1 1 0 0 1 1 1v10.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.3" r="3.4"/></>,
  bookmark: <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z"/>,
  helpcircle: <><circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 4"/><line x1="12" y1="17.2" x2="12" y2="17.3"/></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>
};

function Icon({ name, size = 16, style, className, fill = "none", stroke = "currentColor", strokeWidth = 1.9, ...rest }) {
  const body = ICON_PATHS[name];
  if (!body) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={style} className={className} {...rest}>
      {body}
    </svg>
  );
}
const makeIcon = (name) => (props) => <Icon name={name} {...props} />;
const Sun = makeIcon("sun"), Moon = makeIcon("moon"), Plus = makeIcon("plus"), X = makeIcon("x"),
  Search = makeIcon("search"), Check = makeIcon("check"), Star = makeIcon("star"), Upload = makeIcon("upload"),
  Flag = makeIcon("flag"), User = makeIcon("user"), LogOut = makeIcon("logout"), MessageSquare = makeIcon("messagesquare"),
  ImageIcon = makeIcon("image"), BookOpen = makeIcon("bookopen"), VideoIcon = makeIcon("video"), Loader2 = makeIcon("loader2"),
  FileText = makeIcon("filetext"), Pencil = makeIcon("pencil"), Sparkles = makeIcon("sparkles"),
  GraduationCap = makeIcon("graduationcap"), ListChecks = makeIcon("listchecks"), Clock = makeIcon("clock"),
  Briefcase = makeIcon("briefcase"), ShieldCheck = makeIcon("shieldcheck"), LayoutGrid = makeIcon("layoutgrid"),
  ChevronRight = makeIcon("chevronright"), Calendar = makeIcon("calendar"), Users = makeIcon("users"),
  Megaphone = makeIcon("megaphone"), Camera = makeIcon("camera"), Bookmark = makeIcon("bookmark"),
  HelpCircle = makeIcon("helpcircle"), LinkIcon = makeIcon("link");

/* ---------------------------------------------------------------------- */
/* Constants                                                              */
/* ---------------------------------------------------------------------- */

const SUBJECTS = [
  "Math", "Science", "Statistics", "Mechanics", "Physics", "Chemistry", "Biology",
  "English", "History", "Computer Science", "Economics", "Business", "French", "Arabic", "Other"
];
const GRADES = ["6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"];

// Past Papers has its own subject list and exam-type set (Cambridge-style),
// separate from the general SUBJECTS used by Notes/Videos.
const PAPER_SUBJECTS = [
  "Math", "Physics", "Chemistry", "Biology", "English", "History",
  "Computer Science", "Economics", "Business", "French", "Arabic", "Mandarin Chinese"
];
const EXAM_TYPES = ["IGCSE", "AS Level", "A Level", "SAT", "AP", "IB Diploma"];
const IB_SUBJECTS = [
  "Mathematics: Analysis and Approaches", "Mathematics: Applications and Interpretation", "Physics", "Chemistry", "Biology",
  "English A: Language and Literature", "English A: Literature", "History", "Economics", "Business Management",
  "Computer Science", "Psychology", "Geography", "French B", "Arabic A", "Arabic B", "Chinese B", "Theory of Knowledge"
];
const SAT_SECTIONS = ["Reading and Writing", "Math"];
const AP_COURSES = [
  "2-D Art and Design", "3-D Art and Design", "African American Studies", "Art History", "Biology",
  "Business with Personal Finance", "Calculus AB", "Calculus BC", "Chemistry", "Chinese Language and Culture",
  "Comparative Government and Politics", "Computer Science A", "Computer Science Principles", "Cybersecurity",
  "Drawing", "English Language and Composition", "English Literature and Composition", "Environmental Science",
  "European History", "French Language and Culture", "German Language and Culture", "Human Geography",
  "Italian Language and Culture", "Japanese Language and Culture", "Latin", "Macroeconomics", "Microeconomics",
  "Music Theory", "Physics 1", "Physics 2", "Physics C: Electricity and Magnetism", "Physics C: Mechanics",
  "Precalculus", "Psychology", "Research", "Seminar", "Spanish Language and Culture", "Spanish Literature and Culture",
  "Statistics", "United States Government and Politics", "United States History", "World History: Modern"
];
function subjectsFor(board, examType) {
  if (examType === "IB Diploma" || (!examType && board === "IB")) return IB_SUBJECTS;
  if (examType === "SAT") return SAT_SECTIONS;
  if (examType === "AP") return AP_COURSES;
  if (examType) return PAPER_SUBJECTS;
  if (board === "College Board") return Array.from(new Set([...SAT_SECTIONS, ...AP_COURSES]));
  if (board) return PAPER_SUBJECTS;
  return Array.from(new Set([...PAPER_SUBJECTS, ...SAT_SECTIONS, ...AP_COURSES, ...IB_SUBJECTS]));
}

const ACCESS_PASSWORD = "3147"; // gate for Teacher/Admin role — client-side only, not real security

/* ---------------------------------------------------------------------- */
/* Firestore + local-storage helpers                                      */
/* ---------------------------------------------------------------------- */

function useCollection(path, opts, enabled = true) {
  const [docs, setDocs] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    if (!db || !path) { setDocs([]); setReady(true); return; }
    setReady(false);
    let query = db.collection(path);
    if (opts && opts.orderBy) query = query.orderBy(opts.orderBy, opts.dir || "desc");
    const unsub = query.onSnapshot(
      (snap) => { setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setReady(true); },
      (err) => { console.error("[preplist]", path, err); setReady(true); }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, opts && opts.orderBy, opts && opts.dir]);
  return [docs, ready];
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function useLocalState(key, fallback) {
  const [value, setValue] = useState(() => readLocal(key, fallback));
  const update = useCallback((updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        if (next === null || next === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch { /* best-effort */ }
      return next;
    });
  }, [key]);
  return [value, update];
}

// Big files (PDFs, scanned notes) live in their own "files" documents and are
// fetched only when someone opens them, so listing a collection stays light.
const fileCache = new Map();
async function saveFile(dataUrl) {
  const ref = await db.collection("files").add({ data: dataUrl, createdAt: Date.now() });
  fileCache.set(ref.id, dataUrl);
  return ref.id;
}
function useFileData(inline, fileId, enabled = true) {
  const [data, setData] = useState(inline || (fileId && fileCache.get(fileId)) || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (inline) { setData(inline); return; }
    if (!fileId || !enabled) return;
    if (fileCache.has(fileId)) { setData(fileCache.get(fileId)); return; }
    let live = true;
    db.collection("files").doc(fileId).get().then((d) => {
      const v = d.exists ? d.data().data : null;
      if (v) fileCache.set(fileId, v);
      if (live) { setData(v); setFailed(!v); }
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [inline, fileId, enabled]);
  return [data, failed];
}

function resizeImageToDataUrl(file, maxW = 900, quality = 0.68) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------------------------------------------- */
/* Utilities                                                              */
/* ---------------------------------------------------------------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
const SUBJECT_PALETTE = [
  { bg: "#FDE7D6", fg: "#8A4A16" }, { bg: "#D9E8F5", fg: "#2A5578" }, { bg: "#DCEFD9", fg: "#33662F" },
  { bg: "#EBDFF6", fg: "#5B3A82" }, { bg: "#F6DEDE", fg: "#8A3434" }, { bg: "#F5EBC2", fg: "#7A611A" },
  { bg: "#D8F0E9", fg: "#286654" }, { bg: "#E7E1D6", fg: "#5B5340" }
];
function subjectColor(subject) {
  if (!subject) return SUBJECT_PALETTE[7];
  return SUBJECT_PALETTE[hashStr(subject.trim().toLowerCase()) % SUBJECT_PALETTE.length];
}
function cardTilt(id) { const h = hashStr(id); return (h % 26) / 10 - 1.3; }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/, /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/, /(?:youtube\.com\/shorts\/)([\w-]{11})/
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}
function isStaffRole(role) { return role === "admin" || role === "teacher"; }
function hasElevatedAccess(user) { return isStaffRole(user?.role); }
function canLeadDepartment(user) { return user?.role === "admin"; }
function roleLabel(role) { return role === "teacher" ? "Teacher" : role === "admin" ? "Admin" : "Student"; }

/* ---------------------------------------------------------------------- */
/* Global styles                                                          */
/* ---------------------------------------------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&display=swap');
      .pp-root {
        --bg-light: #FFFFFF; --surface-light: #FFF6EE; --accent-light: #C3D2F7;
        --text-light: #1F1F1F; --muted-light: #7A7368; --border-light: #EAD9C4;
        --bg-dark: #1A1A1A; --surface-dark: #262320; --accent-dark: #92A9F2;
        --text-dark: #F5F5F5; --muted-dark: #A99E90; --border-dark: #3A342C;
      }
      .pp-root[data-theme='light'] {
        --bg: var(--bg-light); --surface: var(--surface-light); --accent: var(--accent-light);
        --text: var(--text-light); --muted: var(--muted-light); --border: var(--border-light);
        --accent-ink: #253E8F;
      }
      .pp-root[data-theme='dark'] {
        --bg: var(--bg-dark); --surface: var(--surface-dark); --accent: var(--accent-dark);
        --text: var(--text-dark); --muted: var(--muted-dark); --border: var(--border-dark);
        --accent-ink: #121B3D;
      }
      .pp-root {
        background: var(--bg); color: var(--text); font-family: 'Karla', sans-serif;
        min-height: 100%; transition: background 0.25s ease, color 0.25s ease;
      }
      .pp-serif { font-family: 'Fraunces', serif; }
      .pp-root *:focus-visible { outline: 2.5px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
      .pp-card { background: var(--surface); border: 1px solid var(--border); position: relative; }
      .pp-index-card { border-radius: 3px; box-shadow: 1px 2px 0 var(--border); }
      .pp-index-card::before {
        content: ''; position: absolute; top: 0; left: 22px; width: 1px; height: 100%;
        background: color-mix(in srgb, var(--accent) 35%, transparent);
      }
      .pp-tape {
        position: absolute; top: -10px; left: 50%; transform: translateX(-50%) rotate(-2deg);
        width: 64px; height: 20px; background: color-mix(in srgb, var(--accent) 55%, transparent);
        opacity: 0.8; border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
      }
      .pp-btn { font-family: 'Karla', sans-serif; font-weight: 600; border-radius: 8px;
        transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease; cursor: pointer; }
      .pp-btn:active { transform: translateY(1px); }
      .pp-btn:disabled { cursor: default; opacity: 0.6; }
      .pp-btn-primary { background: var(--accent); color: var(--accent-ink); border: 1px solid color-mix(in srgb, var(--accent) 70%, black 10%); }
      .pp-btn-primary:hover { filter: brightness(1.04); }
      .pp-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
      .pp-btn-ghost:hover { background: var(--surface); }
      .pp-input, .pp-select { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; font-family: 'Karla', sans-serif; }
      .pp-input::placeholder { color: var(--muted); }
      .pp-tab { font-family: 'Karla', sans-serif; font-weight: 600; color: var(--muted); border-bottom: 2.5px solid transparent; cursor: pointer; white-space: nowrap; }
      .pp-tab.active { color: var(--text); border-bottom-color: var(--accent); }
      .pp-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
      .pp-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
      .pp-file-slot { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--bg); }
      .pp-search-row:hover { background: var(--bg); }
      .pp-file-input { display: block; font-family: 'Karla', sans-serif; font-size: 12px; color: var(--muted); max-width: 190px; }
      .pp-file-input::file-selector-button {
        font-family: 'Karla', sans-serif; font-weight: 600; font-size: 12.5px;
        padding: 6px 11px; border-radius: 7px; border: 1px solid var(--border);
        background: transparent; color: var(--text); cursor: pointer; margin-right: 8px;
        transition: background 0.15s ease;
      }
      .pp-file-input::file-selector-button:hover { background: var(--surface); }
      .pp-role-card { border: 1.5px solid var(--border); border-radius: 10px; padding: 14px; cursor: pointer; text-align: left; background: var(--bg); color: var(--text); font: inherit; appearance: none; -webkit-appearance: none; transition: border-color 0.12s ease, background 0.12s ease; }
      .pp-role-card:hover { border-color: var(--accent); }
      .pp-chip { border: 1.5px solid var(--border); border-radius: 999px; padding: 6px 13px; font-size: 13px; cursor: pointer; background: var(--bg); color: var(--text); font-family: 'Karla', sans-serif; font-weight: 600; }
      .pp-chip.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 30%, var(--bg)); }
      @keyframes pp-stamp-in { 0% { transform: scale(2.2) rotate(-16deg); opacity: 0; } 60% { transform: scale(0.92) rotate(-8deg); opacity: 1; } 100% { transform: scale(1) rotate(-8deg); opacity: 1; } }
      .pp-stamp { animation: pp-stamp-in 0.42s cubic-bezier(.2,1.4,.4,1); }
      @keyframes pp-pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .pp-pop { animation: pp-pop 0.25s ease-out; }
      @keyframes pp-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .pp-stamp, .pp-pop, .pp-btn { animation: none !important; transition: none !important; } }

      .pp-twoup { display: flex; gap: 10px; }
      .pp-split { display: flex; gap: 10px; }
      .katex { font-size: 1.05em; }

      @media (max-width: 480px) {
        .pp-twoup { flex-direction: column; gap: 14px; }
        .pp-split { flex-direction: column; }
        .pp-tab { font-size: 13px; padding: 9px 1px !important; }
        header nav.pp-scrollbar { gap: 14px !important; }
        .pp-modal-card { padding: 16px !important; }
        .pp-header-title { font-size: 16px !important; }
        .pp-header-row { padding: 12px 14px !important; gap: 8px !important; }
        .pp-role-pill span { display: none; }
      }
    `}</style>
  );
}

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                  */
/* ---------------------------------------------------------------------- */

function Tag({ text }) {
  const c = subjectColor(text);
  return <span className="pp-serif" style={{ background: c.bg, color: c.fg, padding: "2px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.2, whiteSpace: "nowrap" }}>{text}</span>;
}
function GradeTag({ text }) {
  if (!text) return null;
  return <span style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>;
}
function StatusBadge({ status }) {
  if (!status || status === "approved") return null;
  if (status === "pending") return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#8A611A", background: "#F5EBC2", padding: "2px 8px", borderRadius: 999 }}><Clock size={11} /> Pending review</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#8A3434", background: "#F6DEDE", padding: "2px 8px", borderRadius: 999 }}><X size={11} /> Changes requested</span>;
}
const ROLE_ICON = { student: GraduationCap, teacher: Briefcase, admin: ShieldCheck };
function RoleBadge({ role, size = 28 }) {
  const RIcon = ROLE_ICON[role] || User;
  const c = subjectColor(role || "x");
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <RIcon size={size * 0.56} />
    </div>
  );
}
function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px", color: "var(--muted)" }}>
      <Icon size={30} style={{ margin: "0 auto 12px", opacity: 0.6 }} />
      <div className="pp-serif" style={{ fontSize: 18, color: "var(--text)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 14.5, maxWidth: 340, margin: "0 auto" }}>{body}</div>
    </div>
  );
}
function Loading({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, justifyContent: "center", color: "var(--muted)" }}>
      <Loader2 size={18} style={{ animation: "pp-spin 0.9s linear infinite" }} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}
function SubjectSelect({ value, onChange, includeAll, label }) {
  return (
    <select className="pp-select" aria-label={label || "Subject"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All subjects</option> : <option value="" disabled>Subject…</option>}
      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
function GradeSelect({ value, onChange, includeAll, label }) {
  return (
    <select className="pp-select" aria-label={label || "Grade"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All grades</option> : <option value="" disabled>Grade…</option>}
      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );
}
function ExamTypeSelect({ value, onChange, includeAll, label }) {
  const options = EXAM_TYPES;
  return (
    <select className="pp-select" aria-label={label || "Exam type"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All exam types</option> : <option value="" disabled>Exam type…</option>}
      {options.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
function PaperSubjectSelect({ value, onChange, includeAll, label, board, examType }) {
  const options = subjectsFor(board, examType);
  return (
    <select className="pp-select" aria-label={label || "Subject"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All subjects</option> : <option value="" disabled>{examType === "SAT" ? "Section…" : "Subject…"}</option>}
      {options.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
function FilterBar({ query, setQuery, subject, setSubject, grade, setGrade, placeholder, extra }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ position: "relative", flex: 2, minWidth: 180 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px 9px 34px", fontSize: 14 }} placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ width: 168 }}><SubjectSelect value={subject} onChange={setSubject} includeAll /></div>
      <div style={{ width: 150 }}><GradeSelect value={grade} onChange={setGrade} includeAll /></div>
      {extra}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Role gate — no accounts: pick a role, Teacher/Admin need a password    */
/* ---------------------------------------------------------------------- */

const ROLE_INFO = {
  student: { label: "Student", icon: GraduationCap, desc: "Browse notes, videos, and past papers." },
  teacher: { label: "Teacher", icon: Briefcase, desc: "Upload notes for your subjects, browse videos and past papers." },
  admin: { label: "Admin", icon: ShieldCheck, desc: "Full access — manage notes, videos, and past papers." }
};

function SetupNeededScreen() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="pp-card pp-index-card" style={{ width: "100%", maxWidth: 480, padding: "30px 26px", borderRadius: 10 }}>
        <div className="pp-tape" />
        <div className="pp-serif" style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>One setup step left</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)" }}>
          This site needs a free Firebase project to store questions and notes. Open{" "}
          <code>index.html</code>, find the <code>firebaseConfig</code> object near the top of the
          script, and paste in your own project's values — see <code>README.md</code> for the exact steps.
        </p>
      </div>
    </div>
  );
}

function RoleGate({ onSelectRole, theme, setTheme }) {
  const [pendingRole, setPendingRole] = useState(null);
  const [passInput, setPassInput] = useState("");
  const [error, setError] = useState("");

  function pick(role) {
    if (role === "student") { onSelectRole(role); return; }
    setPendingRole(role);
    setPassInput("");
    setError("");
  }
  function submitPassword() {
    if (passInput === ACCESS_PASSWORD) onSelectRole(pendingRole);
    else setError("That's not the right access password.");
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" }}>
      <button className="pp-btn pp-btn-ghost" style={{ position: "absolute", top: 20, right: 20, padding: 8, borderRadius: 999 }} onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <div className="pp-card pp-index-card" style={{ width: "100%", maxWidth: 420, padding: "34px 28px", borderRadius: 10 }}>
        <div className="pp-tape" />
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="pp-serif" style={{ fontSize: 26, fontWeight: 700 }}>PrepList Pro</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>Notes, videos and past papers, all in one place.</div>
        </div>

        {!pendingRole ? (
          <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>I am a…</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(ROLE_INFO).map(([key, info]) => (
                <button key={key} className="pp-role-card" onClick={() => pick(key)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <info.icon size={20} style={{ color: "var(--accent-ink)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)" }}>{info.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{info.desc}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--muted)" }} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="pp-btn pp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5, marginBottom: 16 }} onClick={() => setPendingRole(null)}>← Back</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {React.createElement(ROLE_INFO[pendingRole].icon, { size: 17, style: { color: "var(--accent-ink)" } })}
              <span style={{ fontWeight: 700, fontSize: 15 }}>{ROLE_INFO[pendingRole].label} access</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Enter the access password to continue as {ROLE_INFO[pendingRole].label.toLowerCase()}.
            </div>
            <Field label="Access password">
              <input type="password" autoFocus className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPassword()} placeholder="••••" />
            </Field>
            {error && <div style={{ fontSize: 12.5, color: "#8A3434", marginBottom: 10 }}>{error}</div>}
            <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0" }} onClick={submitPassword}>Continue</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared modal pieces                                                    */
/* ---------------------------------------------------------------------- */

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }} onClick={onClose}>
      <div className="pp-card pp-pop pp-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 620 : 480, maxHeight: "92dvh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="pp-serif" style={{ fontSize: 19, fontWeight: 700 }}>{title}</div>
          <button className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999 }} onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</label>}
      {children}
    </div>
  );
}
function TwoUp({ children }) {
  return <div className="pp-twoup">{React.Children.map(children, (c) => <div style={{ flex: 1 }}>{c}</div>)}</div>;
}

/* ---------------------------------------------------------------------- */
/* "Continue where you left off" — remembers the last note/video/paper     */
/* opened on this device (no accounts, so it's stored in localStorage).   */
/* ---------------------------------------------------------------------- */

function ContinueBanner({ title, subtitle, onClick }) {
  return (
    <button className="pp-card" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 10, marginBottom: 14, cursor: "pointer", border: "1px solid var(--accent)" }}>
      <Bookmark size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.3 }}>Continue where you left off</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{subtitle}</div>}
      </div>
      <ChevronRight size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Math notation — type $...$ (or use the toolbar) for fractions,         */
/* integrals, square roots, etc. Rendered live via KaTeX.                 */
/* ---------------------------------------------------------------------- */

function MathText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith("$") && part.endsWith("$") && window.katex) {
          try {
            const html = window.katex.renderToString(part.slice(1, -1), { throwOnError: false, displayMode: false });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

const MATH_SYMBOLS = [
  { label: "π", before: "\\pi", after: "" },
  { label: "√", before: "\\sqrt{", after: "}" },
  { label: "a⁄b", before: "\\frac{", after: "}{}" },
  { label: "∫", before: "\\int", after: "" },
  { label: "±", before: "\\pm", after: "" },
  { label: "∞", before: "\\infty", after: "" },
  { label: "θ", before: "\\theta", after: "" }
];

function MathToolbar({ textareaRef, value, setValue }) {
  function insert(before, after) {
    const el = textareaRef.current;
    const start = el ? (el.selectionStart ?? value.length) : value.length;
    const end = el ? (el.selectionEnd ?? value.length) : value.length;
    const snippet = "$" + before + after + "$";
    const newValue = value.slice(0, start) + snippet + value.slice(end);
    setValue(newValue);
    const cursorPos = after ? start + 1 + before.length : start + snippet.length;
    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(cursorPos, cursorPos); }
    });
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
      {MATH_SYMBOLS.map((s) => (
        <button key={s.label} type="button" className="pp-btn pp-btn-ghost" style={{ padding: "3px 9px", fontSize: 13.5, minWidth: 30 }} title="Insert math — fills in as you type" onClick={() => insert(s.before, s.after)}>{s.label}</button>
      ))}
    </div>
  );
}

function PhotoPicker({ value, onChange, required }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {value ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={value} alt="" style={{ maxHeight: 140, borderRadius: 8, border: "1px solid var(--border)" }} />
          <button type="button" className="pp-btn pp-btn-ghost" style={{ position: "absolute", top: 6, right: 6, padding: 4, borderRadius: 999, background: "var(--bg)" }} onClick={() => onChange(null)} aria-label="Remove photo"><X size={13} /></button>
        </div>
      ) : busy ? (
        <div className="pp-btn pp-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", fontSize: 13.5 }}>
          <Loader2 size={15} style={{ animation: "pp-spin 0.9s linear infinite" }} /> Processing…
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="pp-file-slot">
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Upload size={12} /> From files{required ? "" : " (optional)"}</div>
            <input type="file" accept="image/*" onChange={handleFile} className="pp-file-input" />
          </div>
          <div className="pp-file-slot">
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Camera size={12} /> Take a photo</div>
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="pp-file-input" />
          </div>
        </div>
      )}
      {failed && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>That image couldn't be read — try a different photo.</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Ask question / answer forms                                            */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Notes                                                                   */
/* ---------------------------------------------------------------------- */

function NotesView({ notes, user, onAddNote, lastNoteId, setLastNoteId, savedNoteIds, onToggleSavedNote }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const canUpload = hasElevatedAccess(user);

  const filtered = useMemo(() => {
    let list = notes;
    if (subject) list = list.filter((n) => n.subject === subject);
    if (grade) list = list.filter((n) => n.grade === grade);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((n) => n.title.toLowerCase().includes(s) || n.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, query, subject, grade]);

  const lastNote = notes.find((n) => n.id === lastNoteId);

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search notes…"
        extra={canUpload && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Upload note</button>} />
      {lastNote && (
        <ContinueBanner title={lastNote.title} subtitle={lastNote.subject}
          onClick={() => document.getElementById(`note-${lastNote.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes yet" body={canUpload ? "Upload the first set of notes for students to study from." : "Only admins and teachers can upload notes — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {filtered.map((n) => {
            const isSaved = savedNoteIds.includes(n.id);
            return (
              <div key={n.id} id={`note-${n.id}`} className="pp-card" onClick={() => setLastNoteId(n.id)}
                style={{ borderRadius: 10, padding: 14, cursor: "pointer", transform: `rotate(${cardTilt(n.id) * 0.6}deg)`, outline: n.id === lastNoteId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}><Tag text={n.subject} /><GradeTag text={n.grade} /></div>
                  <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSavedNote(n.id); }} aria-label={isSaved ? "Remove bookmark" : "Add bookmark"}>
                    <Bookmark size={14} fill={isSaved ? "var(--accent)" : "none"} style={{ color: "var(--accent)" }} />
                  </button>
                </div>
                <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8 }}>{n.title}</div>
                {n.type === "image" ? <NoteImage note={n} style={{ width: "100%", marginTop: 8, borderRadius: 6, border: "1px solid var(--border)" }} /> : <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}><MathText text={n.content} /></p>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{roleLabel(n.authorRole)} · {timeAgo(n.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}
      {showForm && <AddNoteModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAddNote(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddNoteModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [type, setType] = useState("text");
  const [text, setText] = useState("");
  const textRef = useRef(null);
  const [image, setImage] = useState(null);
  const canSubmit = title.trim() && subject && grade && (type === "text" ? text.trim() : image);

  return (
    <Modal title="Upload notes" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics cheat sheet" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <Field label="Format">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 14px", fontSize: 13, background: type === "text" ? "var(--surface)" : "transparent", borderColor: type === "text" ? "var(--accent)" : "var(--border)" }} onClick={() => setType("text")}><FileText size={13} style={{ marginRight: 5, display: "inline" }} /> Text</button>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 14px", fontSize: 13, background: type === "image" ? "var(--surface)" : "transparent", borderColor: type === "image" ? "var(--accent)" : "var(--border)" }} onClick={() => setType("image")}><ImageIcon size={13} style={{ marginRight: 5, display: "inline" }} /> Image / scan</button>
        </div>
      </Field>
      {type === "text" ? <Field label="Notes"><MathToolbar textareaRef={textRef} value={text} setValue={setText} /><textarea ref={textRef} className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or write the notes…" /></Field>
        : <Field label="Image or scanned document"><PhotoPicker value={image} onChange={setImage} required /></Field>}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={() => onSubmit({ title: title.trim(), subject, grade, type, content: type === "text" ? text.trim() : image })}>
        Publish note
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Videos                                                                  */
/* ---------------------------------------------------------------------- */

function VideosView({ videos, user, onAddVideo, lastVideoId, setLastVideoId, savedVideoIds, onToggleSavedVideo }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const isAdmin = canLeadDepartment(user);

  const filtered = useMemo(() => {
    let list = videos;
    if (subject) list = list.filter((v) => v.subject === subject);
    if (grade) list = list.filter((v) => v.grade === grade);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((v) => v.title.toLowerCase().includes(s) || v.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [videos, query, subject, grade]);

  const lastVideo = videos.find((v) => v.id === lastVideoId);

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search videos…"
        extra={isAdmin && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add video</button>} />
      {lastVideo && (
        <ContinueBanner title={lastVideo.title} subtitle={lastVideo.subject}
          onClick={() => document.getElementById(`video-${lastVideo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={VideoIcon} title="No videos yet" body={isAdmin ? "Paste a YouTube link to add the first video." : "Only admins can add videos — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((v) => {
            const isSaved = savedVideoIds.includes(v.id);
            return (
              <div key={v.id} id={`video-${v.id}`} className="pp-card" onClick={() => setLastVideoId(v.id)}
                style={{ borderRadius: 10, overflow: "hidden", outline: v.id === lastVideoId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
                <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
                  <iframe title={v.title} src={`https://www.youtube.com/embed/${v.youtubeId}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}><Tag text={v.subject} /><GradeTag text={v.grade} /></div>
                    <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSavedVideo(v.id); }} aria-label={isSaved ? "Remove bookmark" : "Add bookmark"}>
                      <Bookmark size={14} fill={isSaved ? "var(--accent)" : "none"} style={{ color: "var(--accent)" }} />
                    </button>
                  </div>
                  <div className="pp-serif" style={{ fontSize: 14.5, fontWeight: 600, marginTop: 8 }}>{v.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Added by {roleLabel(v.addedByRole)} · {timeAgo(v.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showForm && <AddVideoModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAddVideo(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddVideoModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [url, setUrl] = useState("");
  const videoId = extractYouTubeId(url);
  const canSubmit = title.trim() && subject && grade && videoId;

  return (
    <Modal title="Add a video" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Integration by parts, explained" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <Field label="YouTube link">
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        {url && !videoId && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>Couldn't read a video ID from that link.</div>}
      </Field>
      {videoId && (
        <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden", marginBottom: 14, background: "#000" }}>
          <iframe title="preview" src={`https://www.youtube.com/embed/${videoId}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allowFullScreen />
        </div>
      )}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={() => onSubmit({ title: title.trim(), subject, grade, youtubeId: videoId })}>Add video</button>
    </Modal>
  );
}

function NoteImage({ note, style }) {
  const boxRef = useRef(null);
  const [visible, setVisible] = useState(!!note.content);
  useEffect(() => {
    if (visible) return;
    const el = boxRef.current;
    if (!el || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  const [src, failed] = useFileData(note.content, note.fileId, visible);
  return (
    <div ref={boxRef} style={{ minHeight: src ? 0 : 90 }}>
      {src ? <img src={src} alt="" style={style} /> : <div style={{ fontSize: 12.5, color: "var(--muted)", paddingTop: 8 }}>{failed ? "Couldn't load this image." : "Loading image…"}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Checklist — teachers/admins lay out topics per subject, everyone can   */
/* tick them off as studied (personal, stored on-device).                 */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Saved — everything bookmarked, plus what you were last reading/       */
/* watching/opening in each tab.                                         */
/* ---------------------------------------------------------------------- */

function BookmarkRow({ tags, title, onOpen, onRemove }) {
  return (
    <div className="pp-card" onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>{tags}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
      </div>
      <button className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Remove bookmark"><X size={13} /></button>
    </div>
  );
}

function BookmarkSection({ label, icon: SectionIcon, items, children }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <SectionIcon size={13} /> {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function SavedView({ notes, videos, lastNoteId, lastVideoId, savedNoteIds, savedVideoIds, onToggleSavedNote, onToggleSavedVideo, onJump }) {
  const lastNote = notes.find((n) => n.id === lastNoteId);
  const lastVideo = videos.find((v) => v.id === lastVideoId);
  const recents = [
    lastNote && { tab: "notes", elId: `note-${lastNote.id}`, title: lastNote.title, subtitle: lastNote.subject },
    lastVideo && { tab: "videos", elId: `video-${lastVideo.id}`, title: lastVideo.title, subtitle: lastVideo.subject }
  ].filter(Boolean);

  const savedNotes = notes.filter((n) => savedNoteIds.includes(n.id));
  const savedVideos = videos.filter((v) => savedVideoIds.includes(v.id));
  const hasSaved = savedNotes.length || savedVideos.length;

  return (
    <div>
      <div className="pp-serif" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 10 }}>Continue where you left off</div>
      {recents.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Nothing opened yet — browse Notes or Videos to get started.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {recents.map((r) => <ContinueBanner key={r.tab} title={r.title} subtitle={r.subtitle} onClick={() => onJump(r.tab, r.elId)} />)}
        </div>
      )}

      <div className="pp-serif" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 10 }}>Bookmarked</div>
      {!hasSaved ? (
        <EmptyState icon={Bookmark} title="Nothing bookmarked yet" body="Tap the bookmark icon on any note or video to save it here." />
      ) : (
        <>
          <BookmarkSection label="Notes" icon={BookOpen} items={savedNotes}>
            {savedNotes.map((n) => (
              <BookmarkRow key={n.id} title={n.title} tags={<><Tag text={n.subject} /><GradeTag text={n.grade} /></>}
                onOpen={() => onJump("notes", `note-${n.id}`)} onRemove={() => onToggleSavedNote(n.id)} />
            ))}
          </BookmarkSection>
          <BookmarkSection label="Videos" icon={VideoIcon} items={savedVideos}>
            {savedVideos.map((v) => (
              <BookmarkRow key={v.id} title={v.title} tags={<><Tag text={v.subject} /><GradeTag text={v.grade} /></>}
                onOpen={() => onJump("videos", `video-${v.id}`)} onRemove={() => onToggleSavedVideo(v.id)} />
            ))}
          </BookmarkSection>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Past Papers — links to the official places past papers and practice   */
/* material live. Nothing is copied or embedded; "Half screen" just opens */
/* the link in a window covering the right half of the screen.            */
/* ---------------------------------------------------------------------- */

const CAMBRIDGE_BASE = "https://www.cambridgeinternational.org/programmes-and-qualifications";
const cambridgeLink = (label, slug) => ({ embed: true, label: label + " — papers & mark schemes", url: `${CAMBRIDGE_BASE}/${slug}/past-papers/` });
const RESOURCE_GROUPS = [
  {
    title: "Cambridge IGCSE", source: "cambridge", official: true, note: "Official Cambridge pages with question papers and mark schemes, one per subject.",
    links: [
      cambridgeLink("Mathematics (0580)", "cambridge-igcse-mathematics-0580"),
      cambridgeLink("Physics (0625)", "cambridge-igcse-physics-0625"),
      cambridgeLink("Chemistry (0620)", "cambridge-igcse-chemistry-0620"),
      cambridgeLink("Biology (0610)", "cambridge-igcse-biology-0610"),
      cambridgeLink("English - First Language (0500)", "cambridge-igcse-english-first-language-0500"),
      cambridgeLink("History (0470)", "cambridge-igcse-history-0470"),
      cambridgeLink("Computer Science (0478)", "cambridge-igcse-computer-science-0478"),
      cambridgeLink("Economics (0455)", "cambridge-igcse-economics-0455"),
      cambridgeLink("Business Studies (0450)", "cambridge-igcse-business-studies-0450"),
      cambridgeLink("French - Foreign Language (0520)", "cambridge-igcse-french-foreign-language-0520"),
      cambridgeLink("Arabic - Foreign Language (0544)", "cambridge-igcse-arabic-foreign-language-0544"),
      cambridgeLink("Chinese (Mandarin) - Foreign Language (0547)", "cambridge-igcse-chinese-mandarin-foreign-language-0547")
    ]
  },
  {
    title: "Cambridge AS & A Level", source: "cambridge", official: true, note: "Official Cambridge pages with question papers and mark schemes, one per subject.",
    links: [
      cambridgeLink("Mathematics (9709)", "cambridge-international-as-and-a-level-mathematics-9709"),
      cambridgeLink("Physics (9702)", "cambridge-international-as-and-a-level-physics-9702"),
      cambridgeLink("Chemistry (9701)", "cambridge-international-as-and-a-level-chemistry-9701"),
      cambridgeLink("Biology (9700)", "cambridge-international-as-and-a-level-biology-9700"),
      cambridgeLink("English Language (9093)", "cambridge-international-as-and-a-level-english-language-9093"),
      cambridgeLink("History (9489)", "cambridge-international-as-and-a-level-history-9489"),
      cambridgeLink("Computer Science (9618)", "cambridge-international-as-and-a-level-computer-science-9618"),
      cambridgeLink("Economics (9708)", "cambridge-international-as-and-a-level-economics-9708"),
      cambridgeLink("Business (9609)", "cambridge-international-as-and-a-level-business-9609"),
      cambridgeLink("French Language & Literature (9898)", "cambridge-international-as-and-a-level-french-language-literature-9898"),
      cambridgeLink("Arabic (9680)", "cambridge-international-as-and-a-level-arabic-9680"),
      cambridgeLink("Chinese Language & Literature (9868)", "cambridge-international-as-and-a-level-chinese-language-and-literature-9868")
    ]
  },
  {
    title: "Edexcel (Pearson)", source: "edexcel", official: true, note: "Pearson's official finder for past papers and mark schemes — choose International GCSE or International Advanced Level, then your subject.",
    links: [{ label: "Pearson past papers", url: "https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html" }]
  },
  {
    title: "IB Diploma", source: "ib", official: true,
    note: "IB past papers are sold by the IB itself rather than published free, so they can't be shared here. Ask your school's IB coordinator how to get them; this is the IB's official programme page.",
    links: [{ label: "IB Diploma Programme (official)", url: "https://www.ibo.org/programmes/diploma-programme/" }]
  },
  {
    title: "SAT (College Board)", source: "sat", official: true, note: "The SAT doesn't publish past papers the way Cambridge and Pearson do. College Board instead releases free official full-length practice tests, plus a question bank you can filter by topic and difficulty — that's the real thing to practise with.",
    links: [
      { label: "Official SAT practice tests", url: "https://satsuite.collegeboard.org/practice/practice-tests" },
      { label: "Official SAT question bank (filter by topic)", url: "https://satsuite.collegeboard.org/practice/student-question-bank" },
      { label: "Bluebook (the SAT testing app)", url: "https://bluebook.collegeboard.org/" },
      { embed: true, label: "Khan Academy - Official Digital SAT Prep", url: "https://www.khanacademy.org/test-prep/sat" }
    ]
  },
  {
    title: "AP (College Board)", source: "ap", official: true, note: "Each AP course page on AP Central has its official past exam questions and scoring guidelines.",
    links: [
      { label: "AP Central - all courses & past exam questions", url: "https://apcentral.collegeboard.org/courses" }
    ]
  },
  {
    title: "Save My Exams (third-party)", source: "sme", official: false,
    note: "Revision notes and past papers by topic. Some content needs a free or paid account. We only link to it — nothing from the site is copied or embedded here.",
    links: [
      { label: "Save My Exams - IGCSE", url: "https://www.savemyexams.com/igcse/" },
      { label: "Save My Exams - AS Level", url: "https://www.savemyexams.com/as/" },
      { label: "Save My Exams - A Level", url: "https://www.savemyexams.com/a-level/" },
      { label: "Save My Exams - AP", url: "https://www.savemyexams.com/ap/" }
    ]
  }
];

function openHalfScreen(url, side) {
  const sw = window.screen.availWidth || 1200;
  const sh = window.screen.availHeight || 800;
  const x0 = window.screen.availLeft || 0;
  const y0 = window.screen.availTop || 0;
  const w = Math.floor(sw / 2);
  const left = side === "left" ? x0 : x0 + w;
  const features = `popup=yes,width=${w},height=${sh},left=${left},top=${y0},screenX=${left},screenY=${y0},resizable=yes,scrollbars=yes`;
  // A fixed name per side means opening a second link on the same side replaces the first.
  const win = window.open(url, side === "left" ? "pp-half-left" : "pp-half-right", features);
  if (win) { try { win.opener = null; win.focus(); } catch { /* optional */ } }
  return !!win;
}

function EmbedPane({ item, items, onPick, label }) {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <select className="pp-select" aria-label={label} style={{ padding: "5px 8px", fontSize: 12.5, width: "100%" }} value={item ? item.url : ""} onChange={(e) => onPick(e.target.value)}>
            {!item && <option value="">Choose a page…</option>}
            {items.map((i) => <option key={i.url} value={i.url}>{i.group}: {i.label}</option>)}
          </select>
        </div>
        {item && <a className="pp-btn pp-btn-ghost" href={item.url} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>New tab</a>}
      </div>
      {item ? <iframe key={item.url} title={item.label} src={item.url} style={{ flex: 1, width: "100%", minHeight: 0, border: 0, background: "#fff" }} />
        : <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>Pick a page to show on this side.</div>}
    </div>
  );
}

function EmbedSplitViewer({ items, startUrl, startRight, onClose }) {
  const [left, setLeft] = useState(startUrl);
  const [right, setRight] = useState(startRight || null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const find = (u) => items.find((i) => i.url === u) || null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700 }}>Split view</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Two documents side by side. Use the picker on each side to switch, for example from a question paper to its mark scheme. If a side stays blank, use New tab.</div>
        </div>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={() => { setLeft(right); setRight(left); }}>Swap sides</button>
        <button className="pp-btn pp-btn-ghost" style={{ padding: 7, borderRadius: 999 }} onClick={onClose} aria-label="Close split view"><X size={16} /></button>
      </div>
      <div className="pp-split" style={{ flex: 1, minHeight: 0, padding: 10 }}>
        <EmbedPane item={find(left)} items={items} onPick={setLeft} label="Left page" />
        <EmbedPane item={find(right)} items={items} onPick={setRight} label="Right page" />
      </div>
    </div>
  );
}

function CambridgePapers({ onOpen }) {
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState("IGCSE");
  const [slug, setSlug] = useState("");
  const [seriesName, setSeriesName] = useState("");
  useEffect(() => {
    fetch("cambridge-papers.json").then((r) => r.json()).then(setIndex).catch(() => setFailed(true));
  }, []);
  if (failed) return null;
  if (!index) return <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18 }}>Loading the Cambridge paper list…</div>;
  const subjects = index.subjects.filter((s) => s.level === level);
  const subj = subjects.find((s) => s.slug === slug);
  const seriesList = subj ? Object.keys(subj.series) : [];
  const series = subj && subj.series[seriesName];
  const url = (p) => index.base + p;
  const docsFor = () => {
    const out = [];
    Object.entries(subj.series).forEach(([sn, papers]) => Object.entries(papers).forEach(([pn, d]) => {
      if (d.qp) out.push({ url: url(d.qp), label: `${sn} · Paper ${pn} · Question paper`, group: subj.name });
      if (d.ms) out.push({ url: url(d.ms), label: `${sn} · Paper ${pn} · Mark scheme`, group: subj.name });
    }));
    return out;
  };
  const open = (left, right) => onOpen(docsFor(), url(left), right ? url(right) : null);
  const sel = { padding: "8px 10px", fontSize: 14, width: "100%" };
  const btn = { padding: "4px 10px", fontSize: 12 };
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 22 }}>
      <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Cambridge papers and mark schemes — pick and open</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Each question paper and each mark scheme is its own option: "Open" shows it in the split view (pick the other document on the second side), "New tab" opens it on its own. These are links to Cambridge's own files (nothing is copied). Cambridge's public pages only list the latest series and specimen papers — older years need a school login with Cambridge.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ width: 150 }}>
          <select className="pp-select" aria-label="Level" style={sel} value={level} onChange={(e) => { setLevel(e.target.value); setSlug(""); setSeriesName(""); }}>
            <option value="IGCSE">IGCSE</option><option value="AS & A Level">AS &amp; A Level</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <select className="pp-select" aria-label="Cambridge subject" style={sel} value={slug} onChange={(e) => { const s2 = subjects.find((x) => x.slug === e.target.value); setSlug(e.target.value); setSeriesName(s2 ? Object.keys(s2.series)[0] || "" : ""); }}>
            <option value="">Choose a subject…</option>
            {subjects.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        {subj && (
          <div style={{ width: 170 }}>
            <select className="pp-select" aria-label="Exam series" style={sel} value={seriesName} onChange={(e) => setSeriesName(e.target.value)}>
              {seriesList.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      {subj && seriesList.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Cambridge hasn't published any papers for this subject on its public page.</div>}
      {series && Object.keys(series).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((pn) => {
        const d = series[pn];
        return (
          <div key={pn} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
            <b style={{ fontSize: 13.5, width: 70 }}>Paper {pn}</b>
            {d.qp && <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>Question paper</span>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => open(d.qp, null)}>Open</button>
              <a className="pp-btn pp-btn-ghost" style={{ ...btn, textDecoration: "none" }} href={url(d.qp)} target="_blank" rel="noopener noreferrer">New tab</a></span>}
            {d.ms && <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>Mark scheme</span>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => open(d.ms, null)}>Open</button>
              <a className="pp-btn pp-btn-ghost" style={{ ...btn, textDecoration: "none" }} href={url(d.ms)} target="_blank" rel="noopener noreferrer">New tab</a></span>}
            {d.qp && d.ms && <button className="pp-btn pp-btn-primary" style={btn} onClick={() => open(d.qp, d.ms)}>Paper + mark scheme side by side</button>}
          </div>
        );
      })}
    </div>
  );
}

const PAPER_SOURCES = [
  { id: "cambridge", label: "Cambridge" },
  { id: "edexcel", label: "Edexcel" },
  { id: "sat", label: "SAT" },
  { id: "ap", label: "AP" },
  { id: "ib", label: "IB" },
  { id: "sme", label: "Save My Exams" }
];

function PastPapersView() {
  const notify = useToast();
  const [source, setSource] = useLocalState("preplist:paperSource", "cambridge");
  const [split, setSplit] = useState(null);
  const embedItems = RESOURCE_GROUPS.flatMap((g) => g.links.filter((l) => l.embed).map((l) => ({ ...l, group: g.title })));
  const half = (url, side) => { if (!openHalfScreen(url, side)) notify({ kind: "error", text: "Your browser blocked the pop-up. Allow pop-ups for this site, then try again." }); };
  return (
    <div>
      <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 13, lineHeight: 1.55 }}>
        <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>Past papers — pick your exam board</div>
        Past papers belong to the exam boards, and Cambridge doesn't allow them to be republished on other websites — so this page links to the official sources instead of copying them.
        Each Cambridge and Pearson page below lists the <b>question papers and the mark schemes</b> together. <b>Open</b> uses a new tab. <b>Split view</b> (Cambridge and Khan Academy) shows two pages side by side right here inside PrepList Pro — it works in any browser. Pearson, College Board and the IB don't allow their pages to be shown inside other websites, so those only get <b>Left half</b> / <b>Right half</b>, which try to open a window on that half of your screen (your browser may open a full tab instead).
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="tablist" aria-label="Past paper source">
        {PAPER_SOURCES.map((p) => (
          <button key={p.id} role="tab" aria-selected={source === p.id} className={`pp-btn ${source === p.id ? "pp-btn-primary" : "pp-btn-ghost"}`} style={{ padding: "7px 16px", fontSize: 13.5 }} onClick={() => setSource(p.id)}>{p.label}</button>
        ))}
      </div>
      {source === "cambridge" && <CambridgePapers onOpen={(items, left, right) => setSplit({ items, left, right })} />}
      {RESOURCE_GROUPS.filter((g) => g.source === source).map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700 }}>{g.title}</div>
            <GradeTag text={g.official ? "Official" : "Third-party"} />
          </div>
          {g.note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>{g.note}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 8 }}>
            {g.links.map((l) => (
              <div key={l.url} className="pp-card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{l.label}</div>
                <a className="pp-btn pp-btn-ghost" href={l.url} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Open</a>
                {l.embed ? (
                  <button className="pp-btn pp-btn-primary" onClick={() => setSplit({ items: embedItems, left: l.url, right: null })} style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0 }} title="Show this beside another page, inside this site">Split view</button>
                ) : (
                  <>
                    <button className="pp-btn pp-btn-ghost" onClick={() => half(l.url, "left")} style={{ padding: "5px 8px", fontSize: 12, flexShrink: 0 }} title="This site can't be shown inside other pages, so this tries a window on the left half of your screen">Left half</button>
                    <button className="pp-btn pp-btn-ghost" onClick={() => half(l.url, "right")} style={{ padding: "5px 8px", fontSize: 12, flexShrink: 0 }} title="This site can't be shown inside other pages, so this tries a window on the right half of your screen">Right half</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {split && <EmbedSplitViewer items={split.items} startUrl={split.left} startRight={split.right} onClose={() => setSplit(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Quiz — original practice questions (written for this site, not taken   */
/* from past papers). Teachers/Admins can add more.                       */
/* ---------------------------------------------------------------------- */

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Digital SAT pacing: Reading & Writing 64 min / 54 questions, Math 70 min / 44 questions.
function secondsPerQuestion(examType, subject) {
  if (examType === "SAT") return subject === "Math" ? 95 : 71;
  return 60;
}
function fmtClock(total) {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AddQuestionModal({ onClose, onSubmit }) {
  const [examType, setExamType] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [explanation, setExplanation] = useState("");
  const qRef = useRef(null);
  const canSubmit = examType && subject && question.trim() && options.every((o) => o.trim());
  const setOpt = (i, v) => setOptions((prev) => prev.map((o, k) => (k === i ? v : o)));
  return (
    <Modal title="Add a quiz question" onClose={onClose} wide>
      <TwoUp>
        <Field label="Exam type"><ExamTypeSelect value={examType} onChange={(t) => { setExamType(t); setSubject(""); }} /></Field>
        <Field label={examType === "SAT" ? "Section" : "Subject"}><PaperSubjectSelect value={subject} onChange={setSubject} examType={examType} /></Field>
      </TwoUp>
      <Field label="Topic (optional)"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Cells, Algebra, Grammar" /></Field>
      <Field label="Question">
        <MathToolbar textareaRef={qRef} value={question} setValue={setQuestion} />
        <textarea ref={qRef} className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Write your own question — use $...$ for maths" />
      </Field>
      <Field label="Answer options (tick the correct one)">
        {options.map((o, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <input type="radio" name="correct" checked={answer === i} onChange={() => setAnswer(i)} aria-label={`Option ${i + 1} is correct`} style={{ accentColor: "var(--accent)" }} />
            <input className="pp-input" style={{ flex: 1, padding: "8px 10px", fontSize: 14 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} />
          </div>
        ))}
      </Field>
      <Field label="Explanation (shown after answering)"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 56, resize: "vertical", fontFamily: "inherit" }} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></Field>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Only add questions you wrote yourself — please don't copy questions from exam papers or books.</div>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={() => onSubmit({ examType, subject, topic: topic.trim(), question: question.trim(), options: options.map((o) => o.trim()), answer, explanation: explanation.trim() })}>
        Add question
      </button>
    </Modal>
  );
}

function QuizReference({ options, refIndex, setRefIndex }) {
  const opt = options[Number(refIndex)];
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "calc(100dvh - 190px)", minHeight: 380 }}>
      <select className="pp-select" aria-label="Reference material" style={{ padding: "8px 10px", fontSize: 13.5, width: "100%", marginBottom: 8 }} value={refIndex} onChange={(e) => setRefIndex(e.target.value)}>
        <option value="">Choose a note to read alongside…</option>
        {options.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
      </select>
      {!opt ? (
        <div className="pp-card" style={{ borderRadius: 10, padding: 16, fontSize: 13, color: "var(--muted)" }}>Pick something above and it stays on this side while you answer questions on the other.</div>
      ) : (
        <div className="pp-card" style={{ borderRadius: 10, padding: 14, overflowY: "auto", flex: 1 }}>
          <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 8 }}>{opt.note.title}</div>
          {opt.note.type === "image" ? <NoteImage note={opt.note} style={{ width: "100%", borderRadius: 6 }} /> : <p style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}><MathText text={opt.note.content} /></p>}
        </div>
      )}
    </div>
  );
}

function QuizView({ questions, user, notes, onNeedRefs, onAddQuestion, onDeleteQuestion }) {
  const [phase, setPhase] = useState("setup");
  const [examType, setExamType] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(false);
  const [history, setHistory] = useLocalState("preplist:quizHistory", []);
  const [showAdd, setShowAdd] = useState(false);
  const [run, setRun] = useState(null);
  const [split, setSplit] = useState(false);
  const [refIndex, setRefIndex] = useState("");
  const canManage = hasElevatedAccess(user);

  const scoped = useMemo(() => questions.filter((q) => !examType || q.examType === examType), [questions, examType]);
  const subjectOptions = useMemo(() => Array.from(new Set(scoped.map((q) => q.subject))).sort(), [scoped]);
  const topicOptions = useMemo(() => Array.from(new Set(scoped.filter((q) => !subject || q.subject === subject).map((q) => q.topic).filter(Boolean))).sort(), [scoped, subject]);
  const pool = useMemo(() => scoped.filter((q) => (!subject || q.subject === subject) && (!topic || q.topic === topic)), [scoped, subject, topic]);

  const refOptions = useMemo(() => {
    const out = [];
    notes.filter((n) => !subject || n.subject === subject).forEach((n) => out.push({ kind: "note", label: `Note: ${n.title}`, note: n }));
    return out;
  }, [notes, subject]);

  function begin(items, secs) {
    setRun({ items, idx: 0, picked: null, answers: [], secondsLeft: secs });
    setPhase("run");
  }
  function start() {
    const items = shuffled(pool).slice(0, Math.min(Number(count) || 10, pool.length));
    if (items.length === 0) return;
    begin(items, timed ? items.length * secondsPerQuestion(examType, subject) : null);
  }
  function finish(finalRun) {
    const correct = finalRun.answers.filter((a) => a.correct).length;
    setHistory((h) => [{ at: Date.now(), examType: examType || "Mixed", subject: subject || "All subjects", total: finalRun.items.length, correct, timed: finalRun.secondsLeft != null }, ...(h || [])].slice(0, 10));
    setRun(finalRun);
    setPhase("done");
    markStudiedToday();
  }
  function choose(i) {
    if (!run || run.picked !== null) return;
    const q = run.items[run.idx];
    setRun({ ...run, picked: i, answers: [...run.answers, { id: q.id, picked: i, correct: i === q.answer }] });
  }
  function next() {
    if (run.idx + 1 >= run.items.length) finish(run);
    else setRun({ ...run, idx: run.idx + 1, picked: null });
  }

  useEffect(() => {
    if (phase !== "run" || run?.secondsLeft == null) return;
    const t = setInterval(() => {
      setRun((r) => {
        if (!r || r.secondsLeft == null) return r;
        return { ...r, secondsLeft: r.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, run?.secondsLeft == null]);
  useEffect(() => {
    if (phase === "run" && run && run.secondsLeft != null && run.secondsLeft <= 0) finish(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.secondsLeft, phase]);

  const sel = { padding: "9px 10px", fontSize: 14, width: "100%" };

  if (phase === "run" && run) {
    const q = run.items[run.idx];
    const answered = run.picked !== null;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Question {run.idx + 1} of {run.items.length}</div>
          {run.secondsLeft != null && <GradeTag text={`⏱ ${fmtClock(run.secondsLeft)}`} />}
          <div style={{ flex: 1 }} />
          <button className={`pp-btn ${split ? "pp-btn-primary" : "pp-btn-ghost"}`} style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => { if (!split && onNeedRefs) onNeedRefs(); setSplit(!split); }}><LayoutGrid size={13} style={{ marginRight: 5, display: "inline" }} />Split screen</button>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => { setRun(null); setPhase("setup"); }}>Quit</button>
        </div>
        <div className="pp-split" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pp-card" style={{ borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}><GradeTag text={q.examType} /><Tag text={q.subject} />{q.topic && <GradeTag text={q.topic} />}</div>
              <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}><MathText text={q.question} /></div>
              {q.options.map((o, i) => {
                const isRight = answered && i === q.answer;
                const isWrong = answered && i === run.picked && i !== q.answer;
                return (
                  <button key={i} className="pp-btn pp-btn-ghost" disabled={answered} onClick={() => choose(i)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 8, fontSize: 14, opacity: 1,
                      borderColor: isRight ? "#2E7D4F" : isWrong ? "#B3402F" : "var(--border)", background: isRight ? "rgba(46,125,79,0.14)" : isWrong ? "rgba(179,64,47,0.14)" : "transparent" }}>
                    <b style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}</b><MathText text={o} />{isRight ? "  ✓" : isWrong ? "  ✗" : ""}
                  </button>
                );
              })}
              {answered && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: run.picked === q.answer ? "#2E7D4F" : "#B3402F" }}>{run.picked === q.answer ? "Correct" : "Not quite"}</div>
                  {q.explanation && <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}><MathText text={q.explanation} /></div>}
                  <button className="pp-btn pp-btn-primary" style={{ marginTop: 12, padding: "9px 18px" }} onClick={next}>{run.idx + 1 >= run.items.length ? "See results" : "Next question"}</button>
                </div>
              )}
            </div>
          </div>
          {split && <QuizReference options={refOptions} refIndex={refIndex} setRefIndex={setRefIndex} />}
        </div>
      </div>
    );
  }

  if (phase === "done" && run) {
    const correct = run.answers.filter((a) => a.correct).length;
    const total = run.items.length;
    const missed = run.items.filter((q) => !run.answers.find((a) => a.id === q.id && a.correct));
    return (
      <div>
        <div className="pp-card" style={{ borderRadius: 10, padding: 18, textAlign: "center", marginBottom: 16 }}>
          <div className="pp-serif" style={{ fontSize: 30, fontWeight: 700 }}>{correct} / {total}</div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>{Math.round((correct / total) * 100)}% correct</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            {missed.length > 0 && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 16px" }} onClick={() => begin(shuffled(missed), null)}>Retry the {missed.length} I missed</button>}
            <button className="pp-btn pp-btn-ghost" style={{ padding: "9px 16px" }} onClick={() => { setRun(null); setPhase("setup"); }}>New quiz</button>
          </div>
        </div>
        {missed.length > 0 && <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>Review</div>}
        {missed.map((q) => {
          const a = run.answers.find((x) => x.id === q.id);
          return (
            <div key={q.id} className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}><MathText text={q.question} /></div>
              <div style={{ fontSize: 13, color: "#B3402F" }}>Your answer: {a ? <MathText text={q.options[a.picked]} /> : "No answer (ran out of time)"}</div>
              <div style={{ fontSize: 13, color: "#2E7D4F" }}>Correct answer: <MathText text={q.options[q.answer]} /></div>
              {q.explanation && <div style={{ fontSize: 12.5, marginTop: 4 }}><MathText text={q.explanation} /></div>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.55 }}>
        <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>Practice quiz</div>
        Original practice questions written for this site (they are not copied from past papers — real past papers are on the Past Papers tab). Get instant feedback with an explanation after each question, then retry the ones you missed.
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: 150 }}><ExamTypeSelect value={examType} onChange={(t) => { setExamType(t); setSubject(""); setTopic(""); }} includeAll /></div>
        <div style={{ width: 200 }}>
          <select className="pp-select" aria-label="Subject" style={sel} value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); }}>
            <option value="">All subjects</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ width: 170 }}>
          <select className="pp-select" aria-label="Topic" style={sel} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {topicOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ width: 120 }}>
          <select className="pp-select" aria-label="Number of questions" style={sel} value={count} onChange={(e) => setCount(e.target.value)}>
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} questions</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, paddingBottom: 9 }}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          Timed{examType === "SAT" ? " (SAT pace)" : ""}
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <button className="pp-btn pp-btn-primary" style={{ padding: "10px 20px", opacity: pool.length ? 1 : 0.5 }} disabled={!pool.length} onClick={start}>Start quiz</button>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{pool.length} question{pool.length === 1 ? "" : "s"} available</span>
        {canManage && <button className="pp-btn pp-btn-ghost" style={{ padding: "9px 14px", fontSize: 13, marginLeft: "auto" }} onClick={() => setShowAdd(true)}><Plus size={14} style={{ marginRight: 5, display: "inline" }} />Add question</button>}
      </div>
      {history.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="pp-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Your recent results</div>
          {history.map((h) => (
            <div key={h.at} style={{ fontSize: 13, display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ flex: 1 }}>{h.examType} · {h.subject}{h.timed ? " · timed" : ""}</span>
              <b>{h.correct}/{h.total}</b>
              <span style={{ color: "var(--muted)", width: 70, textAlign: "right" }}>{timeAgo(h.at)}</span>
            </div>
          ))}
        </div>
      )}
      {canManage && pool.length > 0 && (
        <div>
          <div className="pp-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Manage questions</div>
          {pool.slice(0, 40).map((q) => (
            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.subject}: {q.question}</span>
              <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999 }} onClick={() => onDeleteQuestion(q.id)} aria-label="Delete question"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {showAdd && <AddQuestionModal onClose={() => setShowAdd(false)} onSubmit={async (payload) => { const ok = await onAddQuestion(payload); if (ok) setShowAdd(false); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Flashcards — your own decks, stored on this device. Cards you get      */
/* right move up a box and show less often.                               */
/* ---------------------------------------------------------------------- */

let tesseractPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      sc.onload = () => resolve(window.Tesseract);
      sc.onerror = () => { tesseractPromise = null; reject(new Error("load")); };
      document.head.appendChild(sc);
    });
  }
  return tesseractPromise;
}

// Turns text read from a photo into flashcard suggestions. This is simple
// pattern matching (term: definition, question lines, "X is Y"), not AI, so
// the suggestions are shown for checking before anything is added.
function cardsFromText(text) {
  const clean = (l) => l.replace(/\s+/g, " ").replace(/^[\u2022\u00b7*\-–—]+\s*/, "").replace(/^\(?\d{1,2}[.)]\s+/, "").trim();
  const raw = text.split(/\r?\n/).map(clean).filter((l) => l.length > 2);
  const items = [];
  for (const line of raw) {
    const prev = items[items.length - 1];
    if (prev && /^[a-z]/.test(line) && !/[.?!:]$/.test(prev)) items[items.length - 1] = `${prev} ${line}`;
    else items.push(line);
  }
  const cards = []; const skipped = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let m = it.match(/^(.{2,60}?)\s*(?::|\s[-–—=]\s)\s*(.{3,})$/);
    if (m) { cards.push({ front: m[1].trim(), back: m[2].trim() }); continue; }
    if (/\?$/.test(it) && items[i + 1]) { cards.push({ front: it, back: items[i + 1] }); i++; continue; }
    m = it.match(/^(.{3,60}?)\s+(is defined as|refers to|means|is|are)\s+(.{3,})$/i);
    if (m) {
      const verb = m[2].toLowerCase();
      m[1] = m[1].replace(/^(A|An|The)\s/, (w) => w.toLowerCase());
      const front = verb === "means" ? `What does ${m[1]} mean?` : verb === "refers to" ? `What does ${m[1]} refer to?` : verb === "is defined as" ? `How is ${m[1]} defined?` : `What ${verb} ${m[1]}?`;
      cards.push({ front, back: m[3].replace(/[.]$/, "") });
      continue;
    }
    skipped.push(it);
  }
  return { cards, skipped };
}

function FlashcardsView() {
  const [decks, setDecks] = useLocalState("preplist:flashcards", []);
  const [deckId, setDeckId] = useState("");
  const [newDeck, setNewDeck] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [studying, setStudying] = useState(false);
  const [card, setCard] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const deck = decks.find((d) => d.id === deckId);
  const [ocrMsg, setOcrMsg] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [proposals, setProposals] = useState(null);
  const [rawText, setRawText] = useState("");

  async function readPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setProposals(null); setRawText(""); setOcrBusy(true); setOcrMsg("Loading the text reader (first time takes a few seconds)…");
    try {
      const T = await loadTesseract();
      const img = await resizeImageToDataUrl(file, 1800, 0.92);
      const res = await T.recognize(img, "eng", { logger: (m) => { if (m.status === "recognizing text") setOcrMsg(`Reading the photo… ${Math.round((m.progress || 0) * 100)}%`); } });
      const text = res.data.text || "";
      setRawText(text);
      const { cards, skipped } = cardsFromText(text);
      setProposals({ cards: cards.map((c) => ({ ...c, on: true })), skipped });
      setOcrMsg("");
    } catch {
      setOcrMsg("Couldn't read that photo. Check your connection and try a clearer, well-lit picture.");
    }
    setOcrBusy(false);
  }
  function addProposals() {
    const picked = proposals.cards.filter((c) => c.on && c.front.trim() && c.back.trim()).map((c) => ({ id: uid(), front: c.front.trim(), back: c.back.trim(), box: 0 }));
    if (!picked.length) return;
    updateDeck((d) => ({ ...d, cards: [...d.cards, ...picked] }));
    setProposals(null); setRawText("");
  }

  function addDeck() {
    if (!newDeck.trim()) return;
    const d = { id: uid(), name: newDeck.trim(), cards: [] };
    setDecks((prev) => [...(prev || []), d]); setDeckId(d.id); setNewDeck("");
  }
  function updateDeck(fn) { setDecks((prev) => prev.map((d) => (d.id === deckId ? fn(d) : d))); }
  function addCard() {
    if (!front.trim() || !back.trim()) return;
    updateDeck((d) => ({ ...d, cards: [...d.cards, { id: uid(), front: front.trim(), back: back.trim(), box: 0 }] }));
    setFront(""); setBack("");
  }
  function pickCard(list) {
    if (!list.length) return null;
    const weights = list.map((c) => 1 / (1 + c.box * 2));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
    return list[0];
  }
  function startStudy() { setDone(0); setStudying(true); setFlipped(false); setCard(pickCard(deck.cards)); }
  function grade(known) {
    const id = card.id;
    const cards = deck.cards.map((c) => (c.id === id ? { ...c, box: known ? Math.min(c.box + 1, 4) : 0 } : c));
    updateDeck((d) => ({ ...d, cards }));
    markStudiedToday();
    setDone((n) => n + 1); setFlipped(false);
    const others = cards.length > 1 ? cards.filter((c) => c.id !== id) : cards;
    setCard(pickCard(others));
  }

  if (studying && deck && card) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{deck.name} · {done} reviewed</div>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => setStudying(false)}>Finish</button>
        </div>
        <div className="pp-card" onClick={() => setFlipped(true)} style={{ borderRadius: 12, padding: 28, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", cursor: flipped ? "default" : "pointer" }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>{flipped ? "Answer" : "Question — tap to reveal"}</div>
          <div className="pp-serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.45 }}><MathText text={flipped ? card.back : card.front} /></div>
        </div>
        {flipped && (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
            <button className="pp-btn pp-btn-ghost" style={{ padding: "10px 22px" }} onClick={() => grade(false)}>Again</button>
            <button className="pp-btn pp-btn-primary" style={{ padding: "10px 22px" }} onClick={() => grade(true)}>Got it</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.55 }}>
        <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 4 }}>Flashcards</div>
        Make your own decks (write them in your own words). Cards you get right show up less; cards you miss come back sooner. Use $...$ for maths. Everything is saved on this device only.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select className="pp-select" aria-label="Deck" style={{ padding: "8px 10px", fontSize: 14, minWidth: 170 }} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          <option value="">Choose a deck…</option>
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cards.length})</option>)}
        </select>
        <input className="pp-input" style={{ flex: 1, minWidth: 140, padding: "8px 10px", fontSize: 14 }} placeholder="New deck name, e.g. Biology – cells" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDeck(); }} />
        <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: newDeck.trim() ? 1 : 0.5 }} disabled={!newDeck.trim()} onClick={addDeck}>Create deck</button>
      </div>
      {deck && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button className="pp-btn pp-btn-primary" style={{ padding: "9px 20px", opacity: deck.cards.length ? 1 : 0.5 }} disabled={!deck.cards.length} onClick={startStudy}>Study this deck</button>
            <button className="pp-btn pp-btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }} onClick={() => { setDecks((prev) => prev.filter((d) => d.id !== deck.id)); setDeckId(""); }}>Delete deck</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <input className="pp-input" style={{ flex: 1, minWidth: 160, padding: "8px 10px", fontSize: 14 }} placeholder="Front (question / term)" value={front} onChange={(e) => setFront(e.target.value)} />
            <input className="pp-input" style={{ flex: 1, minWidth: 160, padding: "8px 10px", fontSize: 14 }} placeholder="Back (answer)" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCard(); }} />
            <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: front.trim() && back.trim() ? 1 : 0.5 }} disabled={!(front.trim() && back.trim())} onClick={addCard}>Add card</button>
          </div>
          <div className="pp-card" style={{ borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Make cards from a photo</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Take or upload a photo of your notes or textbook page. The site reads the text on your device and suggests cards from lines like "Term: definition", questions followed by answers, and "X is Y" sentences. You check them before they're added. Works best on clear, printed text.</div>
            <input type="file" accept="image/*" onChange={readPhoto} disabled={ocrBusy} className="pp-file-input" aria-label="Photo of notes" />
            {ocrMsg && <div style={{ fontSize: 12.5, marginTop: 8 }}>{ocrMsg}</div>}
            {proposals && (
              <div style={{ marginTop: 10 }}>
                {proposals.cards.length === 0 ? (
                  <div style={{ fontSize: 13 }}>I couldn't spot any term/definition pairs in that photo. Try lines written like "Osmosis: movement of water across a membrane", then check the text I read below.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{proposals.cards.length} suggested card{proposals.cards.length === 1 ? "" : "s"} — fix anything that's wrong, untick what you don't want</div>
                    {proposals.cards.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <input type="checkbox" checked={c.on} onChange={() => setProposals((p) => ({ ...p, cards: p.cards.map((x, k) => (k === i ? { ...x, on: !x.on } : x)) }))} aria-label={`Include card ${i + 1}`} style={{ accentColor: "var(--accent)" }} />
                        <input className="pp-input" style={{ flex: 1, minWidth: 130, padding: "6px 8px", fontSize: 13 }} value={c.front} onChange={(e) => setProposals((p) => ({ ...p, cards: p.cards.map((x, k) => (k === i ? { ...x, front: e.target.value } : x)) }))} />
                        <input className="pp-input" style={{ flex: 1, minWidth: 130, padding: "6px 8px", fontSize: 13 }} value={c.back} onChange={(e) => setProposals((p) => ({ ...p, cards: p.cards.map((x, k) => (k === i ? { ...x, back: e.target.value } : x)) }))} />
                      </div>
                    ))}
                    <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", marginTop: 4 }} onClick={addProposals}>Add {proposals.cards.filter((c) => c.on).length} card{proposals.cards.filter((c) => c.on).length === 1 ? "" : "s"} to this deck</button>
                  </>
                )}
                <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>Text I read from the photo</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: "6px 0 0" }}>{rawText || "(nothing)"}</pre></details>
              </div>
            )}
          </div>
          {deck.cards.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}><b><MathText text={c.front} /></b> — <MathText text={c.back} /></span>
              <GradeTag text={`Box ${c.box + 1}`} />
              <button className="pp-btn pp-btn-ghost" style={{ padding: 4, borderRadius: 999 }} onClick={() => updateDeck((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id) }))} aria-label="Delete card"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Tools — exam countdown, study timer, and SAT pacing. Everything here   */
/* is personal and stored on this device.                                 */
/* ---------------------------------------------------------------------- */

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function markStudiedToday() {
  try {
    const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const days = readLocal("preplist:studyDays", []);
    if (!days.includes(key)) { days.push(key); localStorage.setItem("preplist:studyDays", JSON.stringify(days.slice(-400))); }
    window.dispatchEvent(new Event("pp-studied"));
  } catch { /* best-effort */ }
}
function computeStreak(days) {
  const set = new Set(days); const d = new Date(); let n = 0;
  const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function StreakCard() {
  const [days, setDays] = useState(() => readLocal("preplist:studyDays", []));
  useEffect(() => {
    const h = () => setDays(readLocal("preplist:studyDays", []));
    window.addEventListener("pp-studied", h);
    return () => window.removeEventListener("pp-studied", h);
  }, []);
  const streak = computeStreak(days);
  const week = days.filter((k) => (Date.now() - new Date(`${k}T00:00:00`).getTime()) / 86400000 < 7).length;
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div><div className="pp-serif" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{streak}</div><div style={{ fontSize: 12.5, color: "var(--muted)" }}>day study streak</div></div>
      <div><div className="pp-serif" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{week}/7</div><div style={{ fontSize: 12.5, color: "var(--muted)" }}>days studied this week</div></div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 180 }}>A day counts when you finish a quiz, a flashcard round, or a focus block. Stored on this device.</div>
    </div>
  );
}

function CountdownCard() {
  const [items, setItems] = useLocalState("preplist:countdowns", []);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  function add() {
    if (!name.trim() || !date) return;
    setItems((prev) => [...(prev || []), { id: uid(), name: name.trim(), date }]);
    setName(""); setDate("");
  }
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Exam countdown</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Add your own exam or test dates (check them with your school or the exam board).</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input className="pp-input" style={{ flex: 1, minWidth: 150, padding: "8px 10px", fontSize: 14 }} placeholder="e.g. IGCSE Physics Paper 4, SAT" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="pp-input" type="date" aria-label="Exam date" style={{ padding: "8px 10px", fontSize: 14 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: name.trim() && date ? 1 : 0.5 }} disabled={!(name.trim() && date)} onClick={add}>Add</button>
      </div>
      {sorted.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>No exams added yet.</div> : sorted.map((it) => {
        const d = daysUntil(it.date);
        return (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{it.date}</div>
            </div>
            <div className="pp-serif" style={{ fontSize: 17, fontWeight: 700, color: d < 0 ? "var(--muted)" : "var(--text)" }}>{d < 0 ? "Passed" : d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`}</div>
            <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999 }} onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))} aria-label="Remove exam"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

function StudyTimerCard() {
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const endRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const left = Math.round((endRef.current - Date.now()) / 1000);
      if (left > 0) { setSecondsLeft(left); return; }
      try { navigator.vibrate && navigator.vibrate(300); } catch { /* optional */ }
      setRunning(false);
      if (mode === "focus") { markStudiedToday(); setSessions((n) => n + 1); setMode("break"); setSecondsLeft(breakMin * 60); }
      else { setMode("focus"); setSecondsLeft(focusMin * 60); }
    }, 500);
    return () => clearInterval(t);
  }, [running, mode, focusMin, breakMin]);

  useEffect(() => {
    if (!running) return;
    const old = document.title;
    document.title = `${fmtClock(secondsLeft)} · ${mode === "focus" ? "Focus" : "Break"} — PrepList Pro`;
    return () => { document.title = old; };
  }, [running, secondsLeft, mode]);

  function toggle() {
    if (running) { setRunning(false); return; }
    endRef.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
  }
  function reset() { setRunning(false); setMode("focus"); setSecondsLeft(focusMin * 60); }
  function changeFocus(v) { const n = Math.max(1, Math.min(120, Number(v) || 25)); setFocusMin(n); if (!running && mode === "focus") setSecondsLeft(n * 60); }
  function changeBreak(v) { const n = Math.max(1, Math.min(60, Number(v) || 5)); setBreakMin(n); if (!running && mode === "break") setSecondsLeft(n * 60); }

  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Study timer</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Focus in short blocks with breaks in between. When a block ends it pauses so you choose when to carry on.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <div className="pp-serif" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{fmtClock(secondsLeft)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{mode === "focus" ? "Focus" : "Break"} · {sessions} block{sessions === 1 ? "" : "s"} done</div>
        </div>
        <button className="pp-btn pp-btn-primary" style={{ padding: "9px 20px" }} onClick={toggle}>{running ? "Pause" : "Start"}</button>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "9px 14px" }} onClick={reset}>Reset</button>
        <label style={{ fontSize: 12.5 }}>Focus min <input className="pp-input" type="number" min="1" max="120" value={focusMin} onChange={(e) => changeFocus(e.target.value)} style={{ width: 60, padding: "6px 8px", fontSize: 13 }} /></label>
        <label style={{ fontSize: 12.5 }}>Break min <input className="pp-input" type="number" min="1" max="60" value={breakMin} onChange={(e) => changeBreak(e.target.value)} style={{ width: 60, padding: "6px 8px", fontSize: 13 }} /></label>
      </div>
    </div>
  );
}

const GRADE_PRESETS = [
  { id: "school-style", name: "School-style (set your school's weights)", note: "These weights are only a starting point — every school is different, so check your handbook and use \"Save your school's weights\" below to store the real ones.", types: [{ label: "Quiz", weight: 1 }, { label: "Monthly exam", weight: 1 }, { label: "Term exam", weight: 1 }] },
  { id: "equal", name: "Everything counts equally", types: [{ label: "Assessment", weight: 1 }] },
  { id: "exam-heavy", name: "Example: exams count more", note: "Example weights for illustration only.", types: [{ label: "Quiz", weight: 1 }, { label: "Test", weight: 2 }, { label: "Exam", weight: 4 }] }
];

function GradeTrackerCard() {
  const [items, setItems] = useLocalState("preplist:grades", []);
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("100");
  const [weight, setWeight] = useState("1");
  const [target, setTarget] = useLocalState("preplist:gradeTarget", 85);
  const [nextWeight, setNextWeight] = useState("1");
  const [myPresets, setMyPresets] = useLocalState("preplist:gradePresets", []);
  const [presetId, setPresetId] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetTypes, setNewPresetTypes] = useState("");
  const allPresets = [...GRADE_PRESETS, ...myPresets.map((p) => ({ ...p, mine: true }))];
  const activePreset = allPresets.find((p) => p.id === presetId);
  function savePreset() {
    const types = newPresetTypes.split(",").map((t) => {
      const [label, w] = t.split(":");
      return label && label.trim() && Number(w) > 0 ? { label: label.trim(), weight: Number(w) } : null;
    }).filter(Boolean);
    if (!newPresetName.trim() || types.length === 0) return;
    const p = { id: uid(), name: newPresetName.trim(), types };
    setMyPresets((prev) => [...(prev || []), p]);
    setPresetId(p.id); setNewPresetName(""); setNewPresetTypes("");
  }
  const subjects = Array.from(new Set(items.map((i) => i.subject))).sort();
  const canAdd = subject.trim() && name.trim() && score !== "" && Number(max) > 0 && Number(weight) > 0;
  function add() {
    if (!canAdd) return;
    setItems((prev) => [...(prev || []), { id: uid(), subject: subject.trim(), name: name.trim(), score: Number(score), max: Number(max), weight: Number(weight) }]);
    setName(""); setScore("");
  }
  function stats(list) {
    const totalW = list.reduce((a, i) => a + i.weight, 0);
    const sum = list.reduce((a, i) => a + (i.score / i.max) * i.weight, 0);
    return { totalW, sum, avg: totalW ? (sum / totalW) * 100 : 0 };
  }
  const nw = Number(nextWeight) > 0 ? Number(nextWeight) : 1;
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Grade tracker</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Log your quiz, monthly and term exam marks. Weight says how much each counts (e.g. 1 for a quiz, 3 for a term exam) — use your school's own weights. This is your own estimate, not an official grade.</div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="pp-select" aria-label="Weight preset" style={{ padding: "7px 10px", fontSize: 13, maxWidth: 260 }} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            <option value="">Weight preset (optional)…</option>
            {allPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {activePreset && activePreset.types.map((t) => (
            <button key={t.label} className="pp-btn pp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => { setName(t.label); setWeight(String(t.weight)); }}>{t.label} (wt {t.weight})</button>
          ))}
          {activePreset && activePreset.mine && <button className="pp-btn pp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => { setMyPresets((prev) => prev.filter((p) => p.id !== activePreset.id)); setPresetId(""); }}>Delete preset</button>}
        </div>
        {activePreset && activePreset.note && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{activePreset.note}</div>}
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--muted)" }}>Save your school's weights as a preset</summary>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <input className="pp-input" style={{ width: 150, padding: "7px 10px", fontSize: 13 }} placeholder="Preset name" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
            <input className="pp-input" style={{ flex: 1, minWidth: 200, padding: "7px 10px", fontSize: 13 }} placeholder="Quiz:1, Monthly exam:2, Term exam:3" value={newPresetTypes} onChange={(e) => setNewPresetTypes(e.target.value)} />
            <button className="pp-btn pp-btn-primary" style={{ padding: "7px 14px", fontSize: 13 }} onClick={savePreset}>Save preset</button>
          </div>
        </details>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input className="pp-input" list="pp-grade-subjects" style={{ width: 130, padding: "8px 10px", fontSize: 14 }} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <datalist id="pp-grade-subjects">{[...subjects, ...PAPER_SUBJECTS].map((s) => <option key={s} value={s} />)}</datalist>
        <input className="pp-input" style={{ flex: 1, minWidth: 130, padding: "8px 10px", fontSize: 14 }} placeholder="e.g. Monthly exam 2" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="pp-input" type="number" aria-label="Score" style={{ width: 70, padding: "8px 10px", fontSize: 14 }} placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
        <input className="pp-input" type="number" aria-label="Out of" style={{ width: 70, padding: "8px 10px", fontSize: 14 }} placeholder="Out of" value={max} onChange={(e) => setMax(e.target.value)} />
        <input className="pp-input" type="number" aria-label="Weight" style={{ width: 70, padding: "8px 10px", fontSize: 14 }} placeholder="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: canAdd ? 1 : 0.5 }} disabled={!canAdd} onClick={add}>Add</button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
        <label>Target average % <input className="pp-input" type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} style={{ width: 65, padding: "6px 8px", fontSize: 13 }} /></label>
        <label>Next assessment weight <input className="pp-input" type="number" value={nextWeight} onChange={(e) => setNextWeight(e.target.value)} style={{ width: 65, padding: "6px 8px", fontSize: 13 }} /></label>
      </div>
      {subjects.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>No marks logged yet.</div> : subjects.map((sub) => {
        const list = items.filter((i) => i.subject === sub);
        const st = stats(list);
        const need = ((target / 100) * (st.totalW + nw) - st.sum) / nw * 100;
        const needText = need > 100 ? "Above 100% — out of reach with one assessment" : need <= 0 ? "You're already above target" : `${Math.ceil(need)}%`;
        return (
          <div key={sub} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 14 }}>{sub}</b>
              <span className="pp-serif" style={{ fontSize: 18, fontWeight: 700 }}>{st.avg.toFixed(1)}%</span>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Needed next for {target}%: <b>{needText}</b></span>
            </div>
            {list.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "2px 0" }}>
                <span style={{ flex: 1 }}>{i.name}</span>
                <span>{i.score}/{i.max} ({Math.round((i.score / i.max) * 100)}%) · wt {i.weight}</span>
                <button className="pp-btn pp-btn-ghost" style={{ padding: 4, borderRadius: 999 }} onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} aria-label="Remove mark"><X size={12} /></button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ToolsView() {
  return (
    <div>
      <StreakCard />
      <GradeTrackerCard />
      <CountdownCard />
      <StudyTimerCard />
      <div className="pp-card" style={{ borderRadius: 10, padding: 16 }}>
        <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Digital SAT pacing</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <b>Reading and Writing:</b> 2 modules, 54 questions, 64 minutes — about 71 seconds a question.<br />
          <b>Math:</b> 2 modules, 44 questions, 70 minutes — about 95 seconds a question.<br />
          The Quiz tab's "Timed (SAT pace)" option uses these per-question times. Always check College Board for the latest format and test dates.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Global search — one search box that looks across Notes, Videos, Past   */
/* Papers, and the Checklist at once.                                     */
/* ---------------------------------------------------------------------- */

function SearchResultGroup({ label, icon: SectionIcon, items, labelKey, onPick }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <SectionIcon size={12} /> {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.slice(0, 8).map((it) => (
          <div key={it.id} className="pp-search-row" onClick={() => onPick(it)} style={{ padding: "7px 8px", borderRadius: 7, fontSize: 13.5, cursor: "pointer" }}>
            {labelKey ? it[labelKey] : it.title} <span style={{ color: "var(--muted)", fontSize: 11.5 }}>· {it.subject}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GlobalSearchModal({ notes, videos, onClose, onJump }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const noteMatches = s ? notes.filter((n) => n.title.toLowerCase().includes(s) || n.subject.toLowerCase().includes(s)) : [];
  const videoMatches = s ? videos.filter((v) => v.title.toLowerCase().includes(s) || v.subject.toLowerCase().includes(s)) : [];
  const totalMatches = noteMatches.length + videoMatches.length;

  function pick(tabId, elId) { onJump(tabId, elId); onClose(); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 70, padding: "10vh 16px 16px" }} onClick={onClose}>
      <div className="pp-card pp-pop" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "75vh", overflowY: "auto", borderRadius: 14, padding: 18 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input autoFocus className="pp-input" style={{ width: "100%", padding: "10px 12px 10px 34px", fontSize: 15 }} placeholder="Search notes and videos…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {s && (
          <div style={{ marginTop: 14 }}>
            {totalMatches === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 2px" }}>No matches for "{q}".</div>
            ) : (
              <>
                <SearchResultGroup label="Notes" icon={BookOpen} items={noteMatches} onPick={(n) => pick("notes", `note-${n.id}`)} />
                <SearchResultGroup label="Videos" icon={VideoIcon} items={videoMatches} onPick={(v) => pick("videos", `video-${v.id}`)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App shell                                                              */
/* ---------------------------------------------------------------------- */

const TABS = [
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "videos", label: "Videos", icon: VideoIcon },
  { id: "papers", label: "Past Papers", icon: FileText },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "flashcards", label: "Flashcards", icon: Star },
  { id: "tools", label: "Tracker", icon: Clock },
  { id: "saved", label: "Saved", icon: Bookmark }
];

function MainApp({ user, onSwitchRole, theme, setTheme }) {
  // Only subscribe to a collection once a tab that needs it is opened — keeps
  // the number of database reads per visitor (and the free-plan quota) low.
  const [wanted, setWanted] = useState(() => new Set(["notes"]));
  const want = useCallback((...names) => setWanted((prev) => (names.every((n) => prev.has(n)) ? prev : new Set([...prev, ...names]))), []);
  const [notes, notesReady] = useCollection("notes", undefined, wanted.has("notes"));
  const [videos, videosReady] = useCollection("videos", undefined, wanted.has("videos"));
  const [quizQuestions, quizReady] = useCollection("quizQuestions", undefined, wanted.has("quiz"));

  const [tab, setTab] = useState("notes");
  const [showSearch, setShowSearch] = useState(false);
  const TAB_NEEDS = { notes: ["notes"], videos: ["videos"], papers: [], quiz: ["quiz"], saved: ["notes", "videos"], tools: [], flashcards: [] };
  useEffect(() => { want(...(TAB_NEEDS[tab] || [])); }, [tab, want]);
  useEffect(() => { if (showSearch) want("notes", "videos"); }, [showSearch, want]);
  const [toast, setToast] = useState(null);
  const notify = useCallback((t) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const [lastNoteId, setLastNoteId] = useLocalState("preplist:lastNote", null);
  const [lastVideoId, setLastVideoId] = useLocalState("preplist:lastVideo", null);
  const [savedNoteIds, setSavedNoteIds] = useLocalState("preplist:savedNotes", []);
  const [savedVideoIds, setSavedVideoIds] = useLocalState("preplist:savedVideos", []);
  const toggleSaved = (setList) => (id) => setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const onToggleSavedNote = useCallback(toggleSaved(setSavedNoteIds), [setSavedNoteIds]);
  const onToggleSavedVideo = useCallback(toggleSaved(setSavedVideoIds), [setSavedVideoIds]);

  const [pendingScroll, setPendingScroll] = useState(null);
  useEffect(() => {
    if (!pendingScroll || pendingScroll.tab !== tab) return;
    const t = setTimeout(() => {
      document.getElementById(pendingScroll.elId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScroll(null);
    }, 80);
    return () => clearTimeout(t);
  }, [tab, pendingScroll]);
  const jumpTo = useCallback((tabId, elId) => { setTab(tabId); setPendingScroll({ tab: tabId, elId }); }, []);

  async function addNote(payload) {
    try {
      let doc = { ...payload };
      if (payload.type === "image") { doc = { ...payload, fileId: await saveFile(payload.content) }; delete doc.content; }
      await db.collection("notes").add({ ...doc, authorRole: user.role, createdAt: Date.now() });
      return true;
    }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addVideo(payload) {
    try { await db.collection("videos").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addQuizQuestion(payload) {
    try { await db.collection("quizQuestions").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function deleteQuizQuestion(id) {
    try { await db.collection("quizQuestions").doc(id).delete(); }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
  }

  const READY = { notes: notesReady, videos: videosReady, quiz: quizReady };
  const dataReady = (TAB_NEEDS[tab] || []).every((n) => READY[n]);

  return (
    <ToastContext.Provider value={notify}>
      <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}>
        <GlobalStyle />
        <header style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 40 }}>
          <div className="pp-header-row" style={{ maxWidth: 960, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pp-serif pp-header-title" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={17} style={{ color: "var(--accent)" }} /> PrepList Pro</div>
            <div style={{ flex: 1 }} />
            <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999 }} onClick={() => setShowSearch(true)} aria-label="Search everything"><Search size={16} /></button>
            <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999 }} onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button className="pp-btn pp-btn-ghost pp-role-pill" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 5px" }} onClick={onSwitchRole} title="Switch role">
              <RoleBadge role={user.role} size={26} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(user.role)}</span>
              <LogOut size={13} style={{ color: "var(--muted)" }} />
            </button>
          </div>
          <nav className="pp-scrollbar" style={{ maxWidth: 960, margin: "0 auto", padding: "0 18px", display: "flex", gap: 20, overflowX: "auto" }}>
            {TABS.map((t) => (
              <div key={t.id} className={`pp-tab ${tab === t.id ? "active" : ""}`} style={{ padding: "10px 2px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setTab(t.id)}>
                <t.icon size={14} /> {t.label}
              </div>
            ))}
          </nav>
        </header>

        <main style={{ maxWidth: 960, margin: "0 auto", padding: "22px 18px 90px" }}>
          {!dataReady ? <Loading label="Loading…" /> : (
            <>
              {tab === "notes" && <NotesView notes={notes} user={user} onAddNote={addNote} lastNoteId={lastNoteId} setLastNoteId={setLastNoteId} savedNoteIds={savedNoteIds} onToggleSavedNote={onToggleSavedNote} />}
              {tab === "videos" && <VideosView videos={videos} user={user} onAddVideo={addVideo} lastVideoId={lastVideoId} setLastVideoId={setLastVideoId} savedVideoIds={savedVideoIds} onToggleSavedVideo={onToggleSavedVideo} />}
              {tab === "papers" && <PastPapersView />}
              {tab === "quiz" && <QuizView questions={quizQuestions} user={user} notes={notes} onNeedRefs={() => want("notes")} onAddQuestion={addQuizQuestion} onDeleteQuestion={deleteQuizQuestion} />}
              {tab === "tools" && <ToolsView />}
              {tab === "flashcards" && <FlashcardsView />}
              {tab === "saved" && <SavedView notes={notes} videos={videos}
                lastNoteId={lastNoteId} lastVideoId={lastVideoId}
                savedNoteIds={savedNoteIds} savedVideoIds={savedVideoIds}
                onToggleSavedNote={onToggleSavedNote} onToggleSavedVideo={onToggleSavedVideo}
                onJump={jumpTo} />}
            </>
          )}
        </main>

        {showSearch && <GlobalSearchModal notes={notes} videos={videos} onClose={() => setShowSearch(false)} onJump={jumpTo} />}
        {window.__ppVersion && <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", padding: "0 0 18px" }}>PrepList Pro · updated {window.__ppVersion}</div>}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </ToastContext.Provider>
  );
}

function PreplistProRoot() {
  const [theme, setTheme] = useLocalState("preplist:theme", "light");
  const [role, setRole] = useLocalState("preplist:role", null);
  const sessionReady = useAnonymousSession();

  if (!FIREBASE_READY) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><SetupNeededScreen /></div>;
  if (!sessionReady) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><Loading label="Connecting…" /></div>;
  if (!role) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><RoleGate onSelectRole={setRole} theme={theme} setTheme={setTheme} /></div>;

  return <MainApp user={{ role }} onSwitchRole={() => setRole(null)} theme={theme} setTheme={setTheme} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<PreplistProRoot />);