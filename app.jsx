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
  bookmark: <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z"/>
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
  Megaphone = makeIcon("megaphone"), Camera = makeIcon("camera"), Bookmark = makeIcon("bookmark");

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
const EXAM_TYPES = ["IGCSE", "AS Level", "A Level"];
const ZONES = ["Zone 1", "Zone 2", "Zone 3"];
const VARIANTS = ["Variant 1", "Variant 2", "Variant 3"];
const ACCESS_PASSWORD = "3147"; // gate for Teacher/Admin role — client-side only, not real security

/* ---------------------------------------------------------------------- */
/* Firestore + local-storage helpers                                      */
/* ---------------------------------------------------------------------- */

function useCollection(path, opts) {
  const [docs, setDocs] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
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
  }, [path, opts && opts.orderBy, opts && opts.dir]);
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

// Past-paper PDFs are stored as base64 directly in Firestore (no paid
// storage plan needed), so they're capped well under the 1 MiB per-document
// limit — fine for text-based papers, tight for heavily scanned ones.
const MAX_PDF_BYTES = 700 * 1024;
function readPdfAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF_BYTES) {
      reject(new Error(`That PDF is too large (${Math.round(file.size / 1024)}KB) — the free plan this site uses caps past papers at about ${Math.round(MAX_PDF_BYTES / 1024)}KB. Try a smaller/lower-resolution scan.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
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
      .katex { font-size: 1.05em; }

      @media (max-width: 480px) {
        .pp-twoup { flex-direction: column; gap: 14px; }
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
  return (
    <select className="pp-select" aria-label={label || "Exam type"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All exam types</option> : <option value="" disabled>Exam type…</option>}
      {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
function PaperSubjectSelect({ value, onChange, includeAll, label }) {
  return (
    <select className="pp-select" aria-label={label || "Subject"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All subjects</option> : <option value="" disabled>Subject…</option>}
      {PAPER_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
function ZoneSelect({ value, onChange, includeAll, label }) {
  return (
    <select className="pp-select" aria-label={label || "Zone"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All zones</option> : <option value="" disabled>Zone…</option>}
      {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
    </select>
  );
}
function VariantSelect({ value, onChange, includeAll, label }) {
  return (
    <select className="pp-select" aria-label={label || "Variant"} style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {includeAll ? <option value="">All variants</option> : <option value="" disabled>Variant…</option>}
      {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
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

function NotesView({ notes, user, onAddNote }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [lastNoteId, setLastNoteId] = useLocalState("preplist:lastNote", null);
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
          {filtered.map((n) => (
            <div key={n.id} id={`note-${n.id}`} className="pp-card" onClick={() => setLastNoteId(n.id)}
              style={{ borderRadius: 10, padding: 14, cursor: "pointer", transform: `rotate(${cardTilt(n.id) * 0.6}deg)`, outline: n.id === lastNoteId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag text={n.subject} /><GradeTag text={n.grade} />{n.id === lastNoteId && <Bookmark size={13} style={{ color: "var(--accent)" }} />}</div>
              <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8 }}>{n.title}</div>
              {n.type === "image" ? <img src={n.content} alt="" style={{ width: "100%", marginTop: 8, borderRadius: 6, border: "1px solid var(--border)" }} /> : <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}><MathText text={n.content} /></p>}
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{roleLabel(n.authorRole)} · {timeAgo(n.createdAt)}</div>
            </div>
          ))}
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

function VideosView({ videos, user, onAddVideo }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [lastVideoId, setLastVideoId] = useLocalState("preplist:lastVideo", null);
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
          {filtered.map((v) => (
            <div key={v.id} id={`video-${v.id}`} className="pp-card" onClick={() => setLastVideoId(v.id)}
              style={{ borderRadius: 10, overflow: "hidden", outline: v.id === lastVideoId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
              <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
                <iframe title={v.title} src={`https://www.youtube.com/embed/${v.youtubeId}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag text={v.subject} /><GradeTag text={v.grade} />{v.id === lastVideoId && <Bookmark size={13} style={{ color: "var(--accent)" }} />}</div>
                <div className="pp-serif" style={{ fontSize: 14.5, fontWeight: 600, marginTop: 8 }}>{v.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Added by {roleLabel(v.addedByRole)} · {timeAgo(v.createdAt)}</div>
              </div>
            </div>
          ))}
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

/* ---------------------------------------------------------------------- */
/* Past Papers                                                            */
/* ---------------------------------------------------------------------- */

function PapersView({ papers, user, onAddPaper }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [zone, setZone] = useState("");
  const [variant, setVariant] = useState("");
  const [lastPaperId, setLastPaperId] = useLocalState("preplist:lastPaper", null);
  const canUpload = hasElevatedAccess(user);

  const syllabusOptions = useMemo(() => Array.from(new Set(papers.map((p) => p.syllabus).filter(Boolean))).sort(), [papers]);

  const filtered = useMemo(() => {
    let list = papers;
    if (subject) list = list.filter((p) => p.subject === subject);
    if (examType) list = list.filter((p) => p.examType === examType);
    if (syllabus) list = list.filter((p) => p.syllabus === syllabus);
    if (zone) list = list.filter((p) => p.zone === zone);
    if (variant) list = list.filter((p) => p.variant === variant);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((p) => p.title.toLowerCase().includes(s) || p.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [papers, query, subject, examType, syllabus, zone, variant]);

  const lastPaper = papers.find((p) => p.id === lastPaperId);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px 9px 34px", fontSize: 14 }} placeholder="Search past papers…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ width: 168 }}><PaperSubjectSelect value={subject} onChange={setSubject} includeAll /></div>
        <div style={{ width: 140 }}><ExamTypeSelect value={examType} onChange={setExamType} includeAll /></div>
        <div style={{ width: 140 }}>
          <select className="pp-select" aria-label="Syllabus" style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={syllabus} onChange={(e) => setSyllabus(e.target.value)}>
            <option value="">All syllabuses</option>
            {syllabusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ width: 120 }}><ZoneSelect value={zone} onChange={setZone} includeAll /></div>
        <div style={{ width: 140 }}><VariantSelect value={variant} onChange={setVariant} includeAll /></div>
        {canUpload && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Upload paper</button>}
      </div>
      {lastPaper && (
        <ContinueBanner title={lastPaper.title} subtitle={`${lastPaper.subject} · ${lastPaper.examType}${lastPaper.syllabus ? ` · ${lastPaper.syllabus}` : ""}`}
          onClick={() => { const el = document.getElementById(`paper-${lastPaper.id}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No past papers yet" body={canUpload ? "Upload the first past paper as a PDF." : "Only admins and teachers can upload past papers — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {filtered.map((p) => (
            <div key={p.id} id={`paper-${p.id}`} className="pp-card" style={{ borderRadius: 10, padding: 14, transform: `rotate(${cardTilt(p.id) * 0.6}deg)`, outline: p.id === lastPaperId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag text={p.subject} /><GradeTag text={p.examType} />{p.syllabus && <GradeTag text={p.syllabus} />}<GradeTag text={p.zone} /><GradeTag text={p.variant} />{p.id === lastPaperId && <Bookmark size={13} style={{ color: "var(--accent)" }} />}</div>
              <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8 }}>{p.title}</div>
              <a className="pp-btn pp-btn-ghost" href={p.fileData} target="_blank" rel="noopener noreferrer" download={p.fileName || `${p.title}.pdf`} onClick={() => setLastPaperId(p.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "6px 12px", fontSize: 12.5, textDecoration: "none" }}>
                <FileText size={13} /> Open PDF
              </a>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{roleLabel(p.uploadedByRole)} · {timeAgo(p.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
      {showForm && <AddPaperModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAddPaper(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddPaperModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [examType, setExamType] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [zone, setZone] = useState("");
  const [variant, setVariant] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = title.trim() && subject && examType && syllabus.trim() && zone && variant && fileData && !busy;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const data = await readPdfAsDataUrl(file);
      setFileData(data);
      setFileName(file.name);
    } catch (err) {
      setFileData(null);
      setFileName("");
      setError(err.message || "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload a past paper" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. May/June 2023 Paper 1" /></Field>
      <TwoUp>
        <Field label="Subject"><PaperSubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Exam type"><ExamTypeSelect value={examType} onChange={setExamType} /></Field>
      </TwoUp>
      <Field label="Syllabus code">
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="e.g. 0610 (check the front page of the paper)" />
      </Field>
      <TwoUp>
        <Field label="Zone"><ZoneSelect value={zone} onChange={setZone} /></Field>
        <Field label="Variant"><VariantSelect value={variant} onChange={setVariant} /></Field>
      </TwoUp>
      <Field label="PDF file">
        {fileData ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pp-file-slot" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><FileText size={13} /> {fileName}</span>
            <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999 }} onClick={() => { setFileData(null); setFileName(""); }} aria-label="Remove file"><X size={13} /></button>
          </div>
        ) : busy ? (
          <div className="pp-btn pp-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", fontSize: 13.5 }}><Loader2 size={15} style={{ animation: "pp-spin 0.9s linear infinite" }} /> Reading file…</div>
        ) : (
          <div className="pp-file-slot" style={{ display: "inline-block" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5 }}>Choose a PDF (max ~{Math.round(MAX_PDF_BYTES / 1024)}KB)</div>
            <input type="file" accept="application/pdf" onChange={handleFile} className="pp-file-input" />
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>{error}</div>}
      </Field>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={() => onSubmit({ title: title.trim(), subject, examType, syllabus: syllabus.trim(), zone, variant, fileData, fileName })}>
        Publish past paper
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* App shell                                                              */
/* ---------------------------------------------------------------------- */

const TABS = [
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "videos", label: "Videos", icon: VideoIcon },
  { id: "papers", label: "Past Papers", icon: FileText }
];

function MainApp({ user, onSwitchRole, theme, setTheme }) {
  const [notes, notesReady] = useCollection("notes");
  const [videos, videosReady] = useCollection("videos");
  const [papers, papersReady] = useCollection("pastPapers");

  const [tab, setTab] = useState("notes");
  const [toast, setToast] = useState(null);
  const notify = useCallback((t) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function addNote(payload) {
    try { await db.collection("notes").add({ ...payload, authorRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addVideo(payload) {
    try { await db.collection("videos").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addPaper(payload) {
    try { await db.collection("pastPapers").add({ ...payload, uploadedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }

  const dataReady = notesReady && videosReady && papersReady;

  return (
    <ToastContext.Provider value={notify}>
      <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}>
        <GlobalStyle />
        <header style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 40 }}>
          <div className="pp-header-row" style={{ maxWidth: 960, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pp-serif pp-header-title" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={17} style={{ color: "var(--accent)" }} /> PrepList Pro</div>
            <div style={{ flex: 1 }} />
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
              {tab === "notes" && <NotesView notes={notes} user={user} onAddNote={addNote} />}
              {tab === "videos" && <VideosView videos={videos} user={user} onAddVideo={addVideo} />}
              {tab === "papers" && <PapersView papers={papers} user={user} onAddPaper={addPaper} />}
            </>
          )}
        </main>

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