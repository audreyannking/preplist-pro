const { useState, useEffect, useCallback, useMemo, useContext, createContext } = React;

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
  camera: <><path d="M4 8h3l1.4-1.9h7.2L17 8h3a1 1 0 0 1 1 1v10.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.3" r="3.4"/></>
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
  Megaphone = makeIcon("megaphone"), Camera = makeIcon("camera");

/* ---------------------------------------------------------------------- */
/* Constants                                                              */
/* ---------------------------------------------------------------------- */

const SUBJECTS = [
  "Math", "Science", "Statistics", "Mechanics", "Physics", "Chemistry", "Biology",
  "English", "History", "Computer Science", "Economics", "Business", "French", "Arabic", "Other"
];
const DEPARTMENTS = ["Academics", "Lower School", "Outreach", "Social Responsibility", "Management", "Activities", "Discipline", "Wellness", "Sports"];
const GRADES = ["6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"];
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
  student: { label: "Student", icon: GraduationCap, desc: "Post questions, browse the feed, help others out." },
  teacher: { label: "Teacher", icon: Briefcase, desc: "Answer questions and upload notes for your subjects." },
  admin: { label: "Admin", icon: ShieldCheck, desc: "Full access — manage notes, videos, grid questions and review." }
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
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>Post a problem. Solve one together.</div>
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
      <div className="pp-card pp-pop" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 620 : 480, maxHeight: "92dvh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 22 }}>
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
  return <div style={{ display: "flex", gap: 10 }}>{React.Children.map(children, (c) => <div style={{ flex: 1 }}>{c}</div>)}</div>;
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

function AskQuestionModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [format, setFormat] = useState("text");
  const [options, setOptions] = useState(["", ""]);
  const [pairs, setPairs] = useState([{ left: "", right: "" }, { left: "", right: "" }]);

  const formatOk =
    format === "text" ? true :
    format === "mc" ? options.every((o) => o.trim()) :
    pairs.every((p) => p.left.trim() && p.right.trim());
  const canSubmit = title.trim() && subject && grade && text.trim() && formatOk;

  function setOption(i, val) { setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o))); }
  function addOption() { if (options.length < 6) setOptions((prev) => [...prev, ""]); }
  function removeOption(i) { if (options.length > 2) setOptions((prev) => prev.filter((_, idx) => idx !== i)); }
  function setPair(i, side, val) { setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [side]: val } : p))); }
  function addPair() { if (pairs.length < 8) setPairs((prev) => [...prev, { left: "", right: "" }]); }
  function removePair(i) { if (pairs.length > 2) setPairs((prev) => prev.filter((_, idx) => idx !== i)); }

  function submit() {
    const base = { title: title.trim(), subject, grade, text: text.trim(), photo, format };
    if (format === "mc") onSubmit({ ...base, options: options.map((o) => o.trim()) });
    else if (format === "matching") onSubmit({ ...base, pairs: pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) });
    else onSubmit(base);
  }

  return (
    <Modal title="Post a question" onClose={onClose}>
      <Field label="Title">
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} placeholder="e.g. Stuck on this related-rates problem" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <Field label="Question">
        <textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} placeholder="Type out the question, or describe what's in the photo…" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Field label="Format (optional)">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pp-btn pp-btn-ghost" style={{ flex: 1, padding: "7px 0", fontSize: 12.5, background: format === "text" ? "var(--surface)" : "transparent", borderColor: format === "text" ? "var(--accent)" : "var(--border)" }} onClick={() => setFormat("text")}>Plain text</button>
          <button type="button" className="pp-btn pp-btn-ghost" style={{ flex: 1, padding: "7px 0", fontSize: 12.5, background: format === "mc" ? "var(--surface)" : "transparent", borderColor: format === "mc" ? "var(--accent)" : "var(--border)" }} onClick={() => setFormat("mc")}>Multiple choice</button>
          <button type="button" className="pp-btn pp-btn-ghost" style={{ flex: 1, padding: "7px 0", fontSize: 12.5, background: format === "matching" ? "var(--surface)" : "transparent", borderColor: format === "matching" ? "var(--accent)" : "var(--border)" }} onClick={() => setFormat("matching")}>Matching</button>
        </div>
      </Field>
      {format === "mc" && (
        <Field label="Answer choices">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--muted)", width: 16 }}>{String.fromCharCode(97 + i)})</span>
                <input className="pp-input" style={{ flex: 1, padding: "7px 10px", fontSize: 13.5 }} value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Choice ${i + 1}`} />
                {options.length > 2 && <button className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999 }} onClick={() => removeOption(i)} aria-label="Remove choice"><X size={13} /></button>}
              </div>
            ))}
          </div>
          {options.length < 6 && <button className="pp-btn pp-btn-ghost" style={{ marginTop: 8, padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }} onClick={addOption}><Plus size={13} /> Add choice</button>}
        </Field>
      )}
      {format === "matching" && (
        <Field label="Pairs to match">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pairs.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input className="pp-input" style={{ flex: 1, padding: "7px 10px", fontSize: 13.5 }} value={p.left} onChange={(e) => setPair(i, "left", e.target.value)} placeholder={`Column A, item ${i + 1}`} />
                <input className="pp-input" style={{ flex: 1, padding: "7px 10px", fontSize: 13.5 }} value={p.right} onChange={(e) => setPair(i, "right", e.target.value)} placeholder={`Column B, item ${i + 1}`} />
                {pairs.length > 2 && <button className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999 }} onClick={() => removePair(i)} aria-label="Remove pair"><X size={13} /></button>}
              </div>
            ))}
          </div>
          {pairs.length < 8 && <button className="pp-btn pp-btn-ghost" style={{ marginTop: 8, padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }} onClick={addPair}><Plus size={13} /> Add pair</button>}
        </Field>
      )}
      <Field label="Photo of the problem"><PhotoPicker value={photo} onChange={setPhoto} /></Field>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Student-submitted questions are reviewed by an admin before they appear in the shared feed.</div>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={submit}>Submit question</button>
    </Modal>
  );
}

function AnswerForm({ onSubmit, note }) {
  const [photo, setPhoto] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = photo && explanation.trim() && !busy;

  async function submit() {
    if (!photo || !explanation.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ photo, explanation: explanation.trim() });
    setBusy(false);
    if (ok) { setPhoto(null); setExplanation(""); }
  }

  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }} className="pp-serif">Post your answer</div>
      <Field label="Photo of your worked solution"><PhotoPicker value={photo} onChange={setPhoto} required /></Field>
      <Field label="Explain your reasoning">
        <textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} placeholder="Walk through how you got there…" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "8px 0", fontSize: 13.5, opacity: canSubmit ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={!canSubmit} onClick={submit}>
        {busy && <Loader2 size={14} style={{ animation: "pp-spin 0.9s linear infinite" }} />}
        {busy ? "Submitting…" : "Submit answer"}
      </button>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{note}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Question Card — answers live in a subcollection, subscribed here       */
/* ---------------------------------------------------------------------- */

function QuestionCard({ q, user, onMarkAnswered, expanded, onToggleExpand, showStatus }) {
  const tilt = useMemo(() => cardTilt(q.id), [q.id]);
  const notify = useToast();
  const [answers] = useCollection(`questions/${q.id}/answers`);
  const visibleAnswers = answers.filter((a) => a.modStatus === "approved");

  async function addAnswer(payload) {
    const answer = { ...payload, authorRole: user.role, createdAt: Date.now(), helpful: false, modStatus: hasElevatedAccess(user) ? "approved" : "pending" };
    try {
      const ref = await db.collection(`questions/${q.id}/answers`).add(answer);
      if (answer.modStatus === "pending") {
        await db.collection("reviewQueue").doc(`answer_${ref.id}`).set({
          kind: "answer", title: `Answering: ${q.title}`, authorRole: answer.authorRole, text: answer.explanation,
          photo: answer.photo, createdAt: answer.createdAt, targetPath: `questions/${q.id}/answers/${ref.id}`
        });
      }
      return true;
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
      return false;
    }
  }
  async function markHelpful(answerId) {
    try {
      await Promise.all(answers.map((a) =>
        db.doc(`questions/${q.id}/answers/${a.id}`).update({ helpful: a.id === answerId })
      ));
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
    }
  }

  return (
    <div className="pp-card pp-index-card" style={{ borderRadius: 8, padding: 16, transform: expanded ? "none" : `rotate(${tilt}deg)`, transition: "transform 0.15s ease", marginBottom: 16 }}>
      <div style={{ marginLeft: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <Tag text={q.subject} />
          <GradeTag text={q.grade} />
          {showStatus && <StatusBadge status={q.modStatus} />}
          {q.solved && (
            <span key="solved" className="pp-stamp" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#33662F", border: "1.5px solid #33662F", borderRadius: 6, padding: "1px 7px", transform: "rotate(-8deg)" }}>
              <Check size={12} /> SOLVED
            </span>
          )}
        </div>
        <div className="pp-serif" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, cursor: "pointer" }} onClick={onToggleExpand}>{q.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{roleLabel(q.askerRole)} · {timeAgo(q.createdAt)}</div>
      </div>

      <p style={{ marginLeft: 10, marginTop: 10, fontSize: 14.5, lineHeight: 1.55, color: "var(--text)" }}>{q.text}</p>

      {q.format === "mc" && q.options && (
        <div style={{ marginLeft: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {q.options.map((opt, i) => <div key={i} style={{ fontSize: 14, display: "flex", gap: 8 }}><span style={{ color: "var(--muted)" }}>{String.fromCharCode(97 + i)})</span> {opt}</div>)}
        </div>
      )}
      {q.format === "matching" && q.pairs && (
        <div style={{ marginLeft: 10, marginTop: 8, display: "flex", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Column A</div>
            {q.pairs.map((p, i) => <div key={i} style={{ fontSize: 14, marginBottom: 3 }}>{i + 1}. {p.left}</div>)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Column B</div>
            {q.pairs.map((p, i) => <div key={i} style={{ fontSize: 14, marginBottom: 3 }}>{String.fromCharCode(65 + i)}. {p.right}</div>)}
          </div>
        </div>
      )}
      {q.photo && <img src={q.photo} alt="" style={{ marginLeft: 10, marginTop: 10, maxHeight: expanded ? 320 : 160, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer" }} onClick={onToggleExpand} />}

      <div style={{ marginLeft: 10, marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }} onClick={onToggleExpand}>
          <MessageSquare size={14} /> {visibleAnswers.length} {visibleAnswers.length === 1 ? "answer" : "answers"}
        </button>
        {visibleAnswers.length > 0 && (
          <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }} onClick={onMarkAnswered}>
            <Check size={14} /> {q.solved ? "Reopen" : "Mark as answered"}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginLeft: 10, marginTop: 14, borderTop: "1px dashed var(--border)", paddingTop: 14 }}>
          {visibleAnswers.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--muted)" }}>No answers yet — be the first to help.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleAnswers.map((a) => (
                <div key={a.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <RoleBadge role={a.authorRole} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(a.authorRole)}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>· {timeAgo(a.createdAt)}</span>
                    {a.helpful && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 700, color: "var(--accent-ink)" }}><Star size={12} fill="var(--accent)" stroke="var(--accent-ink)" /> Most helpful</span>}
                  </div>
                  <img src={a.photo} alt="" style={{ maxHeight: 200, borderRadius: 6, border: "1px solid var(--border)", marginBottom: 8 }} />
                  <p style={{ fontSize: 14, lineHeight: 1.55 }}>{a.explanation}</p>
                  {!a.helpful && (
                    <button className="pp-btn pp-btn-ghost" style={{ marginTop: 8, padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }} onClick={() => markHelpful(a.id)}><Star size={12} /> Mark most helpful</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {user && q.modStatus === "approved" && (
            <AnswerForm onSubmit={addAnswer} note={hasElevatedAccess(user) ? "Your answer will be posted right away." : "Your answer is sent to an admin for a quick review before it appears here."} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Feed                                                                    */
/* ---------------------------------------------------------------------- */

function FeedView({ questions, user, mineOnly, myQuestionIds, onMarkAnswered, expandedId, setExpandedId }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const filtered = useMemo(() => {
    let list = mineOnly ? questions.filter((q) => myQuestionIds.includes(q.id)) : questions.filter((q) => q.modStatus === "approved");
    if (subject) list = list.filter((q) => q.subject === subject);
    if (grade) list = list.filter((q) => q.grade === grade);
    if (query.trim()) {
      const s = query.trim().toLowerCase();
      list = list.filter((x) => x.title.toLowerCase().includes(s) || x.subject.toLowerCase().includes(s) || x.text.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [questions, query, subject, grade, mineOnly, myQuestionIds]);

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search questions by title or subject…" />
      {filtered.length === 0 ? (
        <EmptyState icon={mineOnly ? Pencil : MessageSquare}
          title={mineOnly ? "Nothing here from this browser yet" : "No questions match"}
          body={mineOnly ? "Post a question and it'll show up here right away — once an admin approves it, it'll also appear in the shared feed. (This list only remembers what you posted from this browser.)" : "Try a different search, subject or grade, or check back later."} />
      ) : (
        filtered.map((q) => (
          <QuestionCard key={q.id} q={q} user={user} showStatus={mineOnly}
            expanded={expandedId === q.id} onToggleExpand={() => setExpandedId(expandedId === q.id ? null : q.id)}
            onMarkAnswered={() => onMarkAnswered(q)} />
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Notes                                                                   */
/* ---------------------------------------------------------------------- */

function NotesView({ notes, user, onAddNote }) {
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

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search notes…"
        extra={canUpload && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Upload note</button>} />
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes yet" body={canUpload ? "Upload the first set of notes for students to study from." : "Only admins and teachers can upload notes — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {filtered.map((n) => (
            <div key={n.id} className="pp-card" style={{ borderRadius: 10, padding: 14, transform: `rotate(${cardTilt(n.id) * 0.6}deg)` }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag text={n.subject} /><GradeTag text={n.grade} /></div>
              <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8 }}>{n.title}</div>
              {n.type === "image" ? <img src={n.content} alt="" style={{ width: "100%", marginTop: 8, borderRadius: 6, border: "1px solid var(--border)" }} /> : <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>{n.content}</p>}
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
      {type === "text" ? <Field label="Notes"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or write the notes…" /></Field>
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
  const isAdmin = canLeadDepartment(user);

  const filtered = useMemo(() => {
    let list = videos;
    if (subject) list = list.filter((v) => v.subject === subject);
    if (grade) list = list.filter((v) => v.grade === grade);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((v) => v.title.toLowerCase().includes(s) || v.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [videos, query, subject, grade]);

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search videos…"
        extra={isAdmin && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add video</button>} />
      {filtered.length === 0 ? (
        <EmptyState icon={VideoIcon} title="No videos yet" body={isAdmin ? "Paste a YouTube link to add the first video." : "Only admins can add videos — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((v) => (
            <div key={v.id} className="pp-card" style={{ borderRadius: 10, overflow: "hidden" }}>
              <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
                <iframe title={v.title} src={`https://www.youtube.com/embed/${v.youtubeId}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Tag text={v.subject} /><GradeTag text={v.grade} /></div>
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
/* Poorly Answered Questions — solutions live in a subcollection          */
/* ---------------------------------------------------------------------- */

function PoorQuestionItem({ pq, user, expanded, onToggle }) {
  const notify = useToast();
  const [solutions] = useCollection(`poorQuestions/${pq.id}/solutions`);
  const visibleSolutions = solutions.filter((s) => s.modStatus === "approved");

  async function addSolution(payload) {
    const solution = { ...payload, authorRole: user.role, createdAt: Date.now(), modStatus: hasElevatedAccess(user) ? "approved" : "pending" };
    try {
      const ref = await db.collection(`poorQuestions/${pq.id}/solutions`).add(solution);
      if (solution.modStatus === "pending") {
        await db.collection("reviewQueue").doc(`solution_${ref.id}`).set({
          kind: "solution", title: `Solving: ${pq.title}`, authorRole: solution.authorRole, text: solution.explanation,
          photo: solution.photo, createdAt: solution.createdAt, targetPath: `poorQuestions/${pq.id}/solutions/${ref.id}`
        });
      }
      return true;
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
      return false;
    }
  }

  return (
    <div className="pp-card pp-index-card" style={{ borderRadius: 8, padding: 16, marginBottom: 16, borderLeft: "3px solid #C97A7A" }}>
      <div style={{ marginLeft: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}><Tag text={pq.subject} /><GradeTag text={pq.grade} /></div>
        <div className="pp-serif" style={{ fontSize: 17, fontWeight: 600, cursor: "pointer" }} onClick={onToggle}>{pq.title}</div>
        <p style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>{pq.text}</p>
        {pq.note && <div style={{ fontSize: 13, marginTop: 8, color: "var(--muted)", fontStyle: "italic" }}>Why it's tricky: {pq.note}</div>}
        {pq.photo && <img src={pq.photo} alt="" style={{ marginTop: 10, maxHeight: expanded ? 300 : 150, borderRadius: 6, border: "1px solid var(--border)" }} />}
        <button className="pp-btn pp-btn-ghost" style={{ marginTop: 12, padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }} onClick={onToggle}>
          <MessageSquare size={14} /> {visibleSolutions.length} {visibleSolutions.length === 1 ? "solution" : "solutions"}
        </button>
        {expanded && (
          <div style={{ marginTop: 14, borderTop: "1px dashed var(--border)", paddingTop: 14 }}>
            {visibleSolutions.length === 0 ? <div style={{ fontSize: 13.5, color: "var(--muted)" }}>No approved solutions yet.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleSolutions.map((s) => (
                  <div key={s.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <RoleBadge role={s.authorRole} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(s.authorRole)}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>· {timeAgo(s.createdAt)}</span>
                    </div>
                    <img src={s.photo} alt="" style={{ maxHeight: 200, borderRadius: 6, border: "1px solid var(--border)", marginBottom: 8 }} />
                    <p style={{ fontSize: 14, lineHeight: 1.55 }}>{s.explanation}</p>
                  </div>
                ))}
              </div>
            )}
            {user && <AnswerForm onSubmit={addSolution} note={hasElevatedAccess(user) ? "Your solution will be posted right away." : "Solutions from students are reviewed by an admin before they're posted."} />}
          </div>
        )}
      </div>
    </div>
  );
}

function PoorQuestionsView({ poorQuestions, user, onAdd, expandedId, setExpandedId }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const isAdmin = user?.role === "admin";

  const filtered = useMemo(() => {
    let list = poorQuestions;
    if (subject) list = list.filter((p) => p.subject === subject);
    if (grade) list = list.filter((p) => p.grade === grade);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((p) => p.title.toLowerCase().includes(s) || p.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [poorQuestions, query, subject, grade]);

  return (
    <div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>Questions admins have flagged as commonly answered poorly — a good place to focus extra practice.</div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search…"
        extra={isAdmin && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add question</button>} />
      {filtered.length === 0 ? (
        <EmptyState icon={Flag} title="Nothing here yet" body={isAdmin ? "Add a question here to spotlight it for extra practice." : "Admins haven't flagged any questions yet — check back soon."} />
      ) : (
        filtered.map((pq) => <PoorQuestionItem key={pq.id} pq={pq} user={user} expanded={expandedId === pq.id} onToggle={() => setExpandedId(expandedId === pq.id ? null : pq.id)} />)
      )}
      {showForm && <AddPoorQuestionModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAdd(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddPoorQuestionModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const canSubmit = title.trim() && subject && grade && text.trim();

  return (
    <Modal title="Add a poorly answered question" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Free-body diagrams on an incline" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <Field label="Question"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type out the question…" /></Field>
      <Field label="Why it's tricky (optional)"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Students forget to resolve gravity into components" /></Field>
      <Field label="Photo (optional)"><PhotoPicker value={photo} onChange={setPhoto} /></Field>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={() => onSubmit({ title: title.trim(), subject, grade, text: text.trim(), note: note.trim(), photo })}>
        Add to list
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Grid Questions                                                         */
/* ---------------------------------------------------------------------- */

const GRID_TYPES = [{ id: "mc", label: "Multiple choice" }, { id: "tf", label: "True / False" }, { id: "short", label: "Short answer" }];

function GridQuestionsView({ gridQuestions, user, attempts, onAdd, onAttempt }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [openId, setOpenId] = useState(null);
  const isAdmin = isStaffRole(user?.role);

  const filtered = useMemo(() => {
    let list = gridQuestions;
    if (subject) list = list.filter((q) => q.subject === subject);
    if (grade) list = list.filter((q) => q.grade === grade);
    if (query.trim()) { const s = query.trim().toLowerCase(); list = list.filter((q) => q.prompt.toLowerCase().includes(s) || q.subject.toLowerCase().includes(s)); }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [gridQuestions, query, subject, grade]);

  return (
    <div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>Practice questions from admins. Answer one and find out right away if you've got it.</div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search grid questions…"
        extra={isAdmin && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add question</button>} />
      {filtered.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No grid questions yet" body={isAdmin ? "Add a practice question — multiple choice, true/false, or short answer." : "Admins haven't added any grid questions yet — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((gq) => <GridQuestionCard key={gq.id} gq={gq} attempt={attempts[gq.id]} open={openId === gq.id} onToggle={() => setOpenId(openId === gq.id ? null : gq.id)} onAttempt={(payload) => onAttempt(gq.id, payload)} />)}
        </div>
      )}
      {showForm && <AddGridQuestionModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAdd(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function GridQuestionCard({ gq, attempt, open, onToggle, onAttempt }) {
  const [shortValue, setShortValue] = useState("");
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <Tag text={gq.subject} /><GradeTag text={gq.grade} />
        {attempt && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: attempt.correct ? "#33662F" : "#8A3434" }}>{attempt.correct ? <Check size={12} /> : <X size={12} />} {attempt.correct ? "Correct" : "Answered"}</span>}
      </div>
      <div className="pp-serif" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, cursor: "pointer" }} onClick={onToggle}>{gq.prompt}</div>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {gq.qType !== "short" ? (
            <>
              {gq.options.map((opt, i) => {
                const picked = attempt?.selectedIndex === i;
                const isCorrectOpt = i === gq.correctIndex;
                let bg = "var(--bg)", border = "var(--border)", color = "var(--text)";
                if (attempt) {
                  if (isCorrectOpt) { bg = "#DCEFD9"; border = "#33662F"; color = "#254D22"; }
                  else if (picked && !isCorrectOpt) { bg = "#F6DEDE"; border = "#8A3434"; color = "#6E2A2A"; }
                }
                return <button key={i} className="pp-btn" style={{ textAlign: "left", padding: "9px 12px", fontSize: 13.5, background: bg, border: `1.5px solid ${border}`, color, borderRadius: 8 }} onClick={() => !attempt && onAttempt({ selectedIndex: i, correct: i === gq.correctIndex })}>{opt}</button>;
              })}
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="pp-input" style={{ flex: 1, padding: "8px 10px", fontSize: 13.5 }} placeholder="Type your answer…" value={shortValue} onChange={(e) => setShortValue(e.target.value)} disabled={!!attempt} />
                {!attempt && <button className="pp-btn pp-btn-primary" style={{ padding: "8px 14px", fontSize: 13, opacity: shortValue.trim() ? 1 : 0.5 }} disabled={!shortValue.trim()} onClick={() => onAttempt({ enteredText: shortValue.trim(), correct: shortValue.trim().toLowerCase() === gq.correctAnswer.trim().toLowerCase() })}>Submit</button>}
              </div>
              {attempt && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Correct answer: <span style={{ color: "var(--text)", fontWeight: 600 }}>{gq.correctAnswer}</span></div>}
            </>
          )}
          {attempt && <div className="pp-pop" style={{ fontSize: 12.5, marginTop: 4, color: attempt.correct ? "#33662F" : "#8A3434", fontWeight: 600 }}>{attempt.correct ? "Nice — that's right!" : "Not quite — see the correct answer above."}</div>}
        </div>
      )}
    </div>
  );
}

function AddGridQuestionModal({ onClose, onSubmit }) {
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [qType, setQType] = useState("mc");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState("");

  const canSubmit = prompt.trim() && subject && grade && (qType === "short" ? correctAnswer.trim() : options.every((o) => o.trim()) && options.length >= 2);

  function setOption(i, val) { setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o))); }
  function addOption() { if (options.length < 6) setOptions((prev) => [...prev, ""]); }
  function removeOption(i) { if (options.length <= 2) return; setOptions((prev) => prev.filter((_, idx) => idx !== i)); if (correctIndex >= options.length - 1) setCorrectIndex(0); }

  function submit() {
    if (qType === "short") onSubmit([{ prompt: prompt.trim(), subject, grade, qType, correctAnswer: correctAnswer.trim() }]);
    else if (qType === "tf") onSubmit([{ prompt: prompt.trim(), subject, grade, qType, options: ["True", "False"], correctIndex }]);
    else onSubmit([{ prompt: prompt.trim(), subject, grade, qType, options: options.map((o) => o.trim()), correctIndex }]);
  }

  return (
    <Modal title="Add a grid question" onClose={onClose}>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <Field label="Question type">
        <div style={{ display: "flex", gap: 8 }}>
          {GRID_TYPES.map((t) => <button key={t.id} className="pp-btn pp-btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5, background: qType === t.id ? "var(--surface)" : "transparent", borderColor: qType === t.id ? "var(--accent)" : "var(--border)" }} onClick={() => setQType(t.id)}>{t.label}</button>)}
        </div>
      </Field>
      <Field label="Question"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. What is the derivative of sin(x)?" /></Field>
      {qType === "mc" && (
        <Field label="Answer options — select the correct one">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="radio" name="correct" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} style={{ accentColor: "var(--accent)", width: 16, height: 16, flexShrink: 0 }} aria-label={`Mark option ${i + 1} correct`} />
                <input className="pp-input" style={{ flex: 1, padding: "8px 10px", fontSize: 13.5 }} value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                {options.length > 2 && (
                  <button className="pp-btn pp-btn-ghost" style={{ padding: 6, borderRadius: 999 }} onClick={() => removeOption(i)} aria-label="Remove option"><X size={13} /></button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button className="pp-btn pp-btn-ghost" style={{ marginTop: 8, padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }} onClick={addOption}><Plus size={13} /> Add option</button>
          )}
        </Field>
      )}
      {qType === "tf" && (
        <Field label="Correct answer">
          <div style={{ display: "flex", gap: 8 }}>
            {["True", "False"].map((label, i) => <button key={label} className="pp-btn pp-btn-ghost" style={{ flex: 1, padding: "9px 0", fontSize: 13.5, background: correctIndex === i ? "var(--surface)" : "transparent", borderColor: correctIndex === i ? "var(--accent)" : "var(--border)" }} onClick={() => setCorrectIndex(i)}>{label}</button>)}
          </div>
        </Field>
      )}
      {qType === "short" && (
        <Field label="Correct answer">
          <input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="e.g. cos(x)" />
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Matched against what the student types, ignoring case and extra spaces.</div>
        </Field>
      )}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5, marginTop: 4 }} disabled={!canSubmit} onClick={submit}>Add question</button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Review queue (admin) — reads the flat reviewQueue collection           */
/* ---------------------------------------------------------------------- */

function ReviewRow({ item, onApprove, onReject }) {
  return (
    <div className="pp-card" style={{ borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{item.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <RoleBadge role={item.authorRole} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(item.authorRole)}</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>· {timeAgo(item.createdAt)}</span>
      </div>
      {item.photo && <img src={item.photo} alt="" style={{ maxHeight: 140, borderRadius: 6, border: "1px solid var(--border)", marginBottom: 6 }} />}
      <p style={{ fontSize: 13.5 }}>{item.text}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="pp-btn pp-btn-primary" style={{ padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }} onClick={onApprove}><Check size={13} /> Approve</button>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }} onClick={onReject}><X size={13} /> Reject</button>
      </div>
    </div>
  );
}

function ReviewView({ reviewQueue }) {
  const notify = useToast();
  async function decide(item, status) {
    try {
      await db.doc(item.targetPath).update({ modStatus: status });
      await db.collection("reviewQueue").doc(item.id).delete();
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
    }
  }
  const byKind = { question: [], answer: [], solution: [] };
  reviewQueue.forEach((it) => { if (byKind[it.kind]) byKind[it.kind].push(it); });
  const total = reviewQueue.length;

  if (total === 0) return <EmptyState icon={ListChecks} title="All caught up" body="Nothing waiting on review right now — student submissions will show up here." />;

  const SECTIONS = [["question", "Questions"], ["answer", "Answers"], ["solution", "Solutions"]];
  return (
    <div>
      {SECTIONS.map(([kind, label]) => byKind[kind].length > 0 && (
        <div key={kind} style={{ marginBottom: 26 }}>
          <div className="pp-serif" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{label} ({byKind[kind].length})</div>
          {byKind[kind].map((item) => <ReviewRow key={item.id} item={item} onApprove={() => decide(item, "approved")} onReject={() => decide(item, "rejected")} />)}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Events & Announcements                                                 */
/* ---------------------------------------------------------------------- */

function formatDateStr(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function formatEventRange(ev) {
  if (!ev.startDate) return "";
  if (!ev.endDate || ev.endDate === ev.startDate) return formatDateStr(ev.startDate);
  return `${formatDateStr(ev.startDate)} – ${formatDateStr(ev.endDate)}`;
}

function EventsAnnouncementsView({ events, announcements, user, myVolunteeredIds, onAddEvent, onToggleVolunteer, onAddAnnouncement }) {
  const [sub, setSub] = useState("events");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className={`pp-chip ${sub === "events" ? "selected" : ""}`} onClick={() => setSub("events")}><Calendar size={13} style={{ marginRight: 5, display: "inline", verticalAlign: -2 }} /> Events</button>
        <button className={`pp-chip ${sub === "announcements" ? "selected" : ""}`} onClick={() => setSub("announcements")}><Megaphone size={13} style={{ marginRight: 5, display: "inline", verticalAlign: -2 }} /> Announcements</button>
      </div>
      {sub === "events"
        ? <EventsView events={events} user={user} myVolunteeredIds={myVolunteeredIds} onAdd={onAddEvent} onToggleVolunteer={onToggleVolunteer} />
        : <AnnouncementsView announcements={announcements} user={user} onAdd={onAddAnnouncement} />}
    </div>
  );
}

function EventsView({ events, user, myVolunteeredIds, onAdd, onToggleVolunteer }) {
  const [showForm, setShowForm] = useState(false);
  const [department, setDepartment] = useState("");
  const canAdd = canLeadDepartment(user);
  const sorted = useMemo(() => {
    let list = department ? events.filter((ev) => ev.department === department) : events;
    return [...list].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }, [events, department]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, maxWidth: 460 }}>Upcoming events from the department. If one needs a hand, sign up right here.</div>
        {canAdd && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add event</button>}
      </div>
      <div style={{ marginBottom: 16, maxWidth: 220 }}>
        <select className="pp-select" style={{ width: "100%", padding: "9px 10px", fontSize: 14 }} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={Calendar} title="No events yet" body={canAdd ? "Add an upcoming event, and let students know if you need volunteers." : "Nothing scheduled yet — check back soon."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sorted.map((ev) => <EventCard key={ev.id} ev={ev} joined={myVolunteeredIds.includes(ev.id)} onToggleVolunteer={onToggleVolunteer} />)}
        </div>
      )}
      {showForm && <AddEventModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAdd(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function EventCard({ ev, joined, onToggleVolunteer }) {
  const needsVolunteers = ev.volunteersNeeded > 0;
  const count = ev.volunteerCount || 0;
  const isFull = count >= ev.volunteersNeeded && !joined;

  return (
    <div className="pp-card pp-index-card" style={{ borderRadius: 8, padding: 16 }}>
      <div style={{ marginLeft: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent)", padding: "2px 9px", borderRadius: 999 }}><Calendar size={11} /> {formatEventRange(ev)}</span>
          <GradeTag text={ev.department} />
        </div>
        <div className="pp-serif" style={{ fontSize: 17, fontWeight: 600 }}>{ev.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Posted by {roleLabel(ev.createdByRole)} · {timeAgo(ev.createdAt)}</div>
        <p style={{ fontSize: 14.5, marginTop: 10, lineHeight: 1.55 }}>{ev.description}</p>
        {needsVolunteers && (
          <div style={{ marginTop: 14, borderTop: "1px dashed var(--border)", paddingTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Users size={14} style={{ color: "var(--muted)" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{count} of {ev.volunteersNeeded} spots filled</span>
            {!joined ? (
              <button className="pp-btn pp-btn-ghost" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5 }} onClick={() => onToggleVolunteer(ev.id, true)} disabled={isFull}>{isFull ? "Full" : "I'll help"}</button>
            ) : (
              <button className="pp-btn pp-btn-ghost" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, background: "var(--surface)", borderColor: "var(--accent)" }} onClick={() => onToggleVolunteer(ev.id, false)}><Check size={13} /> You're signed up — cancel</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddEventModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [needsVolunteers, setNeedsVolunteers] = useState(false);
  const [volunteersNeeded, setVolunteersNeeded] = useState(1);
  const canSubmit = title.trim() && department && startDate && description.trim();

  return (
    <Modal title="Add an event" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fall science fair" /></Field>
      <Field label="Department">
        <select className="pp-select" style={{ width: "100%", padding: "9px 10px", fontSize: 14.5 }} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="" disabled>Select a department…</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>
      <TwoUp>
        <Field label="From"><input type="date" className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="To"><input type="date" className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </TwoUp>
      <Field label="Details"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening, where, and anything students should know…" /></Field>
      <Field label="Volunteers">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={needsVolunteers} onChange={(e) => setNeedsVolunteers(e.target.checked)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
          This event needs student volunteers
        </label>
        {needsVolunteers && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>How many?</span>
            <input type="number" min={1} className="pp-input" style={{ width: 80, padding: "7px 10px", fontSize: 14 }} value={volunteersNeeded} onChange={(e) => setVolunteersNeeded(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        )}
      </Field>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={() => onSubmit({ title: title.trim(), department, startDate, endDate: endDate || startDate, description: description.trim(), volunteersNeeded: needsVolunteers ? volunteersNeeded : 0, volunteerCount: 0 })}>
        Add event
      </button>
    </Modal>
  );
}

function AnnouncementsView({ announcements, user, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const canAdd = hasElevatedAccess(user);
  const sorted = useMemo(() => [...announcements].sort((a, b) => b.createdAt - a.createdAt), [announcements]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, maxWidth: 520 }}>School news from teachers and admins — exam requirements, reminders, and anything else worth knowing.</div>
        {canAdd && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add announcement</button>}
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" body={canAdd ? "Post something students and staff should know about." : "Nothing posted yet — check back soon."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((a) => (
            <div key={a.id} className="pp-card" style={{ borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div>
              <div className="pp-serif" style={{ fontSize: 16.5, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{roleLabel(a.authorRole)}</div>
              <p style={{ fontSize: 14.5, marginTop: 10, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <AddAnnouncementModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAdd(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddAnnouncementModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const canSubmit = title.trim() && body.trim();
  return (
    <Modal title="Add an announcement" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm exam schedule" /></Field>
      <Field label="Details"><textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What students and staff need to know…" /></Field>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={() => onSubmit({ title: title.trim(), body: body.trim() })}>Post announcement</button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* App shell                                                              */
/* ---------------------------------------------------------------------- */

const TABS = [
  { id: "feed", label: "Feed", icon: MessageSquare },
  { id: "mine", label: "My Prep List", icon: Pencil },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "videos", label: "Videos", icon: VideoIcon },
  { id: "poor", label: "Poorly Answered Questions", icon: Flag },
  { id: "grid", label: "Grid Questions", icon: LayoutGrid },
  { id: "events", label: "Events & Announcements", icon: Calendar },
  { id: "review", label: "Review Queue", icon: ListChecks, adminOnly: true }
];

function MainApp({ user, onSwitchRole, theme, setTheme }) {
  const [questions, questionsReady] = useCollection("questions");
  const [notes, notesReady] = useCollection("notes");
  const [videos, videosReady] = useCollection("videos");
  const [poorQuestions, poorReady] = useCollection("poorQuestions");
  const [gridQuestions, gridReady] = useCollection("gridQuestions");
  const [events, eventsReady] = useCollection("events");
  const [announcements, announcementsReady] = useCollection("announcements");
  const [reviewQueue] = useCollection(user.role === "admin" ? "reviewQueue" : null);
  const [attempts, setAttemptsLocal] = useLocalState("preplist:gridAttempts", {});
  const [myQuestionIds, setMyQuestionIds] = useLocalState("preplist:myQuestions", []);
  const [myVolunteeredIds, setMyVolunteeredIds] = useLocalState("preplist:myVolunteered", []);

  const [tab, setTab] = useState("feed");
  const [showAsk, setShowAsk] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPoorId, setExpandedPoorId] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = useCallback((t) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function addQuestion(payload) {
    const q = { ...payload, askerRole: user.role, createdAt: Date.now(), solved: false, modStatus: hasElevatedAccess(user) ? "approved" : "pending" };
    try {
      const ref = await db.collection("questions").add(q);
      setMyQuestionIds((prev) => [ref.id, ...prev]);
      if (q.modStatus === "pending") {
        await db.collection("reviewQueue").doc(`question_${ref.id}`).set({ kind: "question", title: q.title, authorRole: q.askerRole, text: q.text, photo: q.photo, createdAt: q.createdAt, targetPath: `questions/${ref.id}` });
      }
      setShowAsk(false);
      setTab(hasElevatedAccess(user) ? "feed" : "mine");
      return true;
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
      return false;
    }
  }
  async function markAnswered(q) {
    try { await db.collection("questions").doc(q.id).update({ solved: !q.solved }); }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
  }

  async function addNote(payload) {
    try { await db.collection("notes").add({ ...payload, authorRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addVideo(payload) {
    try { await db.collection("videos").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addPoorQuestion(payload) {
    try { await db.collection("poorQuestions").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addGridQuestion(payloads) {
    const items = Array.isArray(payloads) ? payloads : [payloads];
    try {
      const batch = db.batch();
      items.forEach((p) => batch.set(db.collection("gridQuestions").doc(), { ...p, createdByRole: user.role, createdAt: Date.now() }));
      await batch.commit();
      return true;
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
      return false;
    }
  }
  function attemptGrid(qid, payload) { setAttemptsLocal((prev) => ({ ...prev, [qid]: { ...payload, answeredAt: Date.now() } })); }

  async function addEvent(payload) {
    try { await db.collection("events").add({ ...payload, createdByRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function toggleVolunteer(eventId, joining) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const already = myVolunteeredIds.includes(eventId);
    try {
      if (joining) {
        if (already || (ev.volunteerCount || 0) >= ev.volunteersNeeded) return;
        await db.collection("events").doc(eventId).update({ volunteerCount: firebase.firestore.FieldValue.increment(1) });
        setMyVolunteeredIds((prev) => [...prev, eventId]);
      } else {
        if (!already) return;
        await db.collection("events").doc(eventId).update({ volunteerCount: firebase.firestore.FieldValue.increment(-1) });
        setMyVolunteeredIds((prev) => prev.filter((id) => id !== eventId));
      }
    } catch (e) {
      notify({ kind: "error", text: friendlyDbError(e) });
    }
  }
  async function addAnnouncement(payload) {
    try { await db.collection("announcements").add({ ...payload, authorRole: user.role, createdAt: Date.now() }); return true; }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }

  const dataReady = questionsReady && notesReady && videosReady && poorReady && gridReady && eventsReady && announcementsReady;
  const isAdmin = user.role === "admin";
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <ToastContext.Provider value={notify}>
      <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}>
        <GlobalStyle />
        <header style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 40 }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pp-serif" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={17} style={{ color: "var(--accent)" }} /> PrepList Pro</div>
            <div style={{ flex: 1 }} />
            <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999 }} onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button className="pp-btn pp-btn-ghost" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 5px" }} onClick={onSwitchRole} title="Switch role">
              <RoleBadge role={user.role} size={26} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(user.role)}</span>
              <LogOut size={13} style={{ color: "var(--muted)" }} />
            </button>
          </div>
          <nav className="pp-scrollbar" style={{ maxWidth: 960, margin: "0 auto", padding: "0 18px", display: "flex", gap: 20, overflowX: "auto" }}>
            {visibleTabs.map((t) => (
              <div key={t.id} className={`pp-tab ${tab === t.id ? "active" : ""}`} style={{ padding: "10px 2px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setTab(t.id)}>
                <t.icon size={14} /> {t.label}
                {t.id === "review" && reviewQueue.length > 0 && <span style={{ background: "var(--accent)", color: "var(--accent-ink)", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "1px 6px" }}>{reviewQueue.length}</span>}
              </div>
            ))}
          </nav>
        </header>

        <main style={{ maxWidth: 960, margin: "0 auto", padding: "22px 18px 90px" }}>
          {!dataReady ? <Loading label="Loading the feed…" /> : (
            <>
              {tab === "feed" && <FeedView questions={questions} user={user} mineOnly={false} myQuestionIds={myQuestionIds} onMarkAnswered={markAnswered} expandedId={expandedId} setExpandedId={setExpandedId} />}
              {tab === "mine" && <FeedView questions={questions} user={user} mineOnly={true} myQuestionIds={myQuestionIds} onMarkAnswered={markAnswered} expandedId={expandedId} setExpandedId={setExpandedId} />}
              {tab === "notes" && <NotesView notes={notes} user={user} onAddNote={addNote} />}
              {tab === "videos" && <VideosView videos={videos} user={user} onAddVideo={addVideo} />}
              {tab === "poor" && <PoorQuestionsView poorQuestions={poorQuestions} user={user} onAdd={addPoorQuestion} expandedId={expandedPoorId} setExpandedId={setExpandedPoorId} />}
              {tab === "grid" && <GridQuestionsView gridQuestions={gridQuestions} user={user} attempts={attempts} onAdd={addGridQuestion} onAttempt={attemptGrid} />}
              {tab === "events" && <EventsAnnouncementsView events={events} announcements={announcements} user={user} myVolunteeredIds={myVolunteeredIds} onAddEvent={addEvent} onToggleVolunteer={toggleVolunteer} onAddAnnouncement={addAnnouncement} />}
              {tab === "review" && isAdmin && <ReviewView reviewQueue={reviewQueue} />}
            </>
          )}
        </main>

        {(tab === "feed" || tab === "mine") && (
          <button className="pp-btn pp-btn-primary" style={{ position: "fixed", bottom: 22, right: 22, borderRadius: 999, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.18)", zIndex: 30 }} onClick={() => setShowAsk(true)} aria-label="Ask a question"><Plus size={22} /></button>
        )}
        {showAsk && <AskQuestionModal onClose={() => setShowAsk(false)} onSubmit={addQuestion} />}
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