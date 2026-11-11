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
  // Auto-switch to long-polling on networks (schools, some ISPs) that stall Firestore's default streaming.
  try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch { /* best-effort */ }
  // iPhone/iPad Safari can crash repeatedly when the offline cache (IndexedDB) grows large
  // with note photos, so only desktop and Android browsers keep an offline copy.
  const isAppleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isAppleTouch) db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

// Resolves once the silent anonymous sign-in is done. Reading never waits on
// it (the rules allow public reads), only writes do.
const sessionPromise = new Promise((resolve) => {
  if (!FIREBASE_READY) { resolve(); return; }
  auth.onAuthStateChanged((u) => {
    if (u) resolve();
    else auth.signInAnonymously().catch((e) => { console.error("[preplist] anonymous sign-in failed", e); resolve(); });
  });
});
if (FIREBASE_READY) {
  const F = firebase.firestore;
  const gate = (proto, name) => {
    if (!proto || !proto[name]) return;
    const orig = proto[name];
    proto[name] = function (...args) { return sessionPromise.then(() => orig.apply(this, args)); };
  };
  gate(F.CollectionReference && F.CollectionReference.prototype, "add");
  ["set", "update", "delete"].forEach((n) => gate(F.DocumentReference && F.DocumentReference.prototype, n));
  gate(F.WriteBatch && F.WriteBatch.prototype, "commit");
}

// Silently sign every visitor in "anonymously" — no fields, no prompt,
// nothing shown on screen. This exists purely so Firestore's rules can
// require request.auth != null instead of being wide open to anyone on
// the internet, while the app itself still has no login of any kind.
function useAnonymousSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => { let live = true; sessionPromise.then(() => { if (live) setReady(true); }); return () => { live = false; }; }, []);
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
  const isInfo = toast.kind === "info";
  return (
    <div className="pp-pop" style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 22, zIndex: 80,
      maxWidth: 420, background: isError ? "#F6DEDE" : isInfo ? "#E8E3D0" : "#DCEFD9", color: isError ? "#6E2A2A" : isInfo ? "#2C3F57" : "#254D22",
      border: `1.5px solid ${isError ? "#8A3434" : isInfo ? "#778D7A" : "#33662F"}`, borderRadius: 10, padding: "12px 14px",
      display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.45, boxShadow: "0 6px 20px rgba(0,0,0,0.18)"
    }}>
      <span style={{ flex: 1 }}>{toast.text}</span>
      {toast.action && <button onClick={() => { toast.action.onClick(); onClose(); }} style={{ background: "none", border: "1.5px solid currentColor", borderRadius: 6, cursor: "pointer", color: "inherit", padding: "2px 10px", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{toast.action.label}</button>}
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
  folder: <><path d="M3 7.2V5.4a1.8 1.8 0 0 1 1.8-1.8h4.1l2 2.1h7.3a1.8 1.8 0 0 1 1.8 1.8v12a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 19.3Z"/><path d="M3 9.6h18"/></>,
  download: <><line x1="12" y1="4" x2="12" y2="15.5"/><polyline points="7,10.8 12,15.8 17,10.8"/><path d="M4.5 16v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></>,
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
  trash: <><path d="M3.5 6h17"/><path d="M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6"/><path d="M8.5 6V4.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
  helpcircle: <><circle cx="12" cy="12" r="9"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.2-2.6 4"/><line x1="12" y1="17.2" x2="12" y2="17.3"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3.5,7 12,13 20.5,7"/></>,
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
  Trash = makeIcon("trash"), HelpCircle = makeIcon("helpcircle"), LinkIcon = makeIcon("link"), Mail = makeIcon("mail"),
  Folder = makeIcon("folder"), Download = makeIcon("download");

/* ---------------------------------------------------------------------- */
/* Constants                                                              */
/* ---------------------------------------------------------------------- */

const SUBJECTS = [
  "Math", "Science", "Statistics", "Mechanics", "Physics", "Chemistry", "Biology",
  "English", "History", "Computer Science", "Computing", "Economics", "Business", "French", "Arabic", "Islamic", "Other"
];
const ALL_GRADES = "All grades";
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

const ACCESS_PASSWORD = "3069"; // gate for the Admin role — client-side only, not real security

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
const pendingUploads = [];
async function saveFile(dataUrl) {
  // Queue the upload and carry on; the write finishes in the background.
  const ref = db.collection("files").doc();
  fileCache.set(ref.id, dataUrl);
  const done = ref.set({ data: dataUrl, createdAt: Date.now() });
  done.catch(() => {});
  pendingUploads.push(done);
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

// Files tab: metadata lives in "libraryFiles" and the bytes are split into
// small "libraryFileChunks" documents, so a 25 MB upload stays under
// Firestore's 1 MiB per-document limit and is only fetched when opened.
const LIBRARY_CHUNK_BYTES = 512 * 1024;
const MAX_LIBRARY_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
function libraryChunkId(fileId, index) { return `${fileId}__${index}`; }
function guessMimeType(file) {
  if (file && file.type) return file.type;
  const ext = String((file && file.name) || "").split(".").pop().toLowerCase();
  const types = {
    pdf: "application/pdf", txt: "text/plain", csv: "text/csv", md: "text/markdown", json: "application/json",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip"
  };
  return types[ext] || "application/octet-stream";
}
function readBlobChunkBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      resolve(comma >= 0 ? raw.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.readAsDataURL(blob);
  });
}
const libraryBlobCache = new Map();
async function fetchLibraryFileBlob(meta) {
  const cached = libraryBlobCache.get(meta.id);
  if (cached) {
    libraryBlobCache.delete(meta.id);
    libraryBlobCache.set(meta.id, cached);
    return cached;
  }
  const pending = (async () => {
    const count = Math.min(100, Math.max(1, Number(meta.chunkCount) || 1));
    const snaps = await Promise.all(Array.from({ length: count }, (_, i) =>
      db.collection("libraryFileChunks").doc(libraryChunkId(meta.id, i)).get()
    ));
    const parts = snaps.map((snap) => {
      if (!snap.exists) throw new Error("missing-file-chunk");
      const bin = atob(snap.data().data || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    });
    return new Blob(parts, { type: meta.mimeType || "application/octet-stream" });
  })();
  libraryBlobCache.set(meta.id, pending);
  try {
    const blob = await pending;
    while (libraryBlobCache.size > 3) {
      const oldest = libraryBlobCache.keys().next().value;
      if (oldest === meta.id) break;
      libraryBlobCache.delete(oldest);
    }
    libraryBlobCache.set(meta.id, blob);
    return blob;
  } catch (e) {
    libraryBlobCache.delete(meta.id);
    throw e;
  }
}

// Keeps note photos sharp: start big and high quality, and only step down if the
// result would be too large for one Firestore document (1 MiB).
const PHOTO_STEPS = [[1700, 0.82], [1500, 0.78], [1300, 0.72], [1100, 0.68], [900, 0.64]];
const PHOTO_MAX_CHARS = 920000;
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
function drawScaled(img, maxW, quality) {
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
async function resizeImageAdaptive(file) {
  const { img, url } = await loadImageFile(file);
  try {
    let out = "";
    for (const [w, q] of PHOTO_STEPS) {
      out = drawScaled(img, w, q);
      if (out.length <= PHOTO_MAX_CHARS) break;
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
function makeThumb(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(drawScaled(img, 400, 0.62));
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
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
  if (subject.trim().toLowerCase() === "chemistry") return { bg: "#F8DCE8", fg: "#8A2F5C" };
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
function isStaffRole(role) { return role === "admin"; }
function hasElevatedAccess(user) { return isStaffRole(user?.role); }
function canLeadDepartment(user) { return user?.role === "admin"; }
function roleLabel(role) { return role === "admin" ? "Admin" : "Student"; }

/* ---------------------------------------------------------------------- */
/* Global styles                                                          */
/* ---------------------------------------------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      .pp-root {
        --bg-light: #F5F3E6; --surface-light: #FFFFFF; --accent-light: #415A77; --field-light: #FBFAF4;
        --text-light: #0D1B2A; --muted-light: #5B6B7C; --border-light: #E4DEC8;
        --sage-light: #778D7A; --sage-ink-light: #4F6B54; --accent-fg-light: #F4F1DE; --accent-ink-light: #415A77;
        --bg-dark: #17181B; --surface-dark: #212327; --accent-dark: #4F6D8F; --field-dark: #0D1B2A;
        --text-dark: #F4F1DE; --muted-dark: #9AA8B8; --border-dark: #32353B;
        --sage-dark: #8FAA93; --sage-ink-dark: #A3BFA7; --accent-fg-dark: #F4F1DE; --accent-ink-dark: #8FA9C6;
      }
      .pp-root[data-theme='light'] {
        --bg: var(--bg-light); --surface: var(--surface-light); --accent: var(--accent-light); --field: var(--field-light);
        --text: var(--text-light); --muted: var(--muted-light); --border: var(--border-light);
        --accent-fg: var(--accent-fg-light); --accent-ink: var(--accent-ink-light); --sage: var(--sage-light); --sage-ink: var(--sage-ink-light);
      }
      .pp-root[data-theme='dark'] {
        --bg: var(--bg-dark); --surface: var(--surface-dark); --accent: var(--accent-dark); --field: var(--field-dark);
        --text: var(--text-dark); --muted: var(--muted-dark); --border: var(--border-dark);
        --accent-fg: var(--accent-fg-dark); --accent-ink: var(--accent-ink-dark); --sage: var(--sage-dark); --sage-ink: var(--sage-ink-dark);
      }
      .pp-root {
        background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, system-ui, sans-serif;
        min-height: 100%; transition: background 0.25s ease, color 0.25s ease;
      }
      .pp-serif { font-family: 'Inter', -apple-system, system-ui, sans-serif; letter-spacing: -0.015em; }
      .pp-root *:focus-visible { outline: 2.5px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
      .pp-card { background: var(--surface); border: 1px solid var(--border); position: relative; border-radius: 16px !important; box-shadow: 0 1px 2px rgba(13,27,42,0.04), 0 4px 14px rgba(13,27,42,0.04); transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
      .pp-root[data-theme='dark'] .pp-card { box-shadow: none; }
      .pp-card[role='button']:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(13,27,42,0.06), 0 10px 24px rgba(13,27,42,0.08); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
      .pp-root[data-theme='dark'] .pp-card[role='button']:hover { box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
      .pp-index-card { border-radius: 20px !important; }
      .pp-tape { display: none; }
      .pp-btn { font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 600; border-radius: 10px !important; letter-spacing: -0.005em;
        transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease; cursor: pointer; }
      .pp-btn:active { transform: translateY(1px); }
      .pp-btn:disabled { cursor: default; opacity: 0.6; }
      .pp-btn-primary { background: var(--accent); color: var(--accent-fg); border: 1px solid transparent; box-shadow: 0 1px 2px rgba(13,27,42,0.18); }
      .pp-btn-primary:hover { filter: brightness(1.04); }
      .pp-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
      .pp-btn-ghost:hover { background: var(--surface); }
      .pp-input, .pp-select { background: var(--field); border: 1px solid var(--border); color: var(--text); border-radius: 10px !important; font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      .pp-input:focus, .pp-select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
      .pp-input::placeholder { color: var(--muted); }
      .pp-tab { font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 600; color: var(--muted); border-radius: 999px; cursor: pointer; white-space: nowrap; transition: background 0.15s ease, color 0.15s ease; padding: 7px 13px !important; }
      .pp-tab:hover { color: var(--text); background: color-mix(in srgb, var(--accent) 8%, transparent); }
      .pp-tab.active { color: var(--accent-fg); background: var(--accent); }
      .pp-scrollbar::-webkit-scrollbar { height: 0; width: 6px; }
      nav.pp-scrollbar { scrollbar-width: none; }
      .pp-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
      .pp-file-slot { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--bg); }
      .pp-search-row:hover { background: var(--bg); }
      .pp-file-input { display: block; font-family: 'Inter', -apple-system, system-ui, sans-serif; font-size: 12px; color: var(--muted); max-width: 190px; }
      .pp-file-input::file-selector-button {
        font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 600; font-size: 12.5px;
        padding: 6px 11px; border-radius: 7px; border: 1px solid var(--border);
        background: transparent; color: var(--text); cursor: pointer; margin-right: 8px;
        transition: background 0.15s ease;
      }
      .pp-file-input::file-selector-button:hover { background: var(--surface); }
      .pp-role-card { border: 1.5px solid var(--border); border-radius: 10px; padding: 14px; cursor: pointer; text-align: left; background: var(--bg); color: var(--text); font: inherit; appearance: none; -webkit-appearance: none; transition: border-color 0.12s ease, background 0.12s ease; }
      .pp-role-card:hover { border-color: var(--accent); }
      .pp-chip { border: 1.5px solid var(--border); border-radius: 999px; padding: 6px 13px; font-size: 13px; cursor: pointer; background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 600; }
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
        .pp-tab { font-size: 13px; padding: 7px 11px !important; }
        header nav.pp-scrollbar { gap: 4px !important; }
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
const ROLE_ICON = { student: GraduationCap, admin: ShieldCheck };
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
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 40, color: "var(--muted)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Loader2 size={18} style={{ animation: "pp-spin 0.9s linear infinite" }} />
        <span style={{ fontSize: 14 }}>{label}</span>
      </div>
      {slow && <span className="pp-pop" style={{ fontSize: 12.5 }}>Hang tight, your connection is being a little slow today…</span>}
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
function FilterBar({ query, setQuery, subject, setSubject, grade, setGrade, placeholder, extra, hideGrade }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ position: "relative", flex: 2, minWidth: 180 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px 9px 34px", fontSize: 14 }} placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div style={{ width: 168 }}><SubjectSelect value={subject} onChange={setSubject} includeAll /></div>
      {!hideGrade && <div style={{ width: 150 }}><GradeSelect value={grade} onChange={setGrade} includeAll /></div>}
      {extra}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Role gate — no accounts: pick a role, Admin needs a password           */
/* ---------------------------------------------------------------------- */

const ROLE_INFO = {
  student: { label: "Student", icon: GraduationCap, desc: "Browse notes, videos, files, flashcards and past papers." },
  admin: { label: "Admin", icon: ShieldCheck, desc: "Full access — add notes, videos and files." }
};

function BookLogo({ size = 26, style }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" style={{ display: "block", ...style }}>
      <path d="M256 156C196 122 106 120 46 148V408C106 382 196 386 256 418C316 386 406 382 466 408V148C406 120 316 122 256 156Z" fill="#2C3F57" stroke="#2C3F57" strokeWidth="8" strokeLinejoin="round" />
      <path d="M256 140C196 106 106 104 46 132V392C106 366 196 370 256 402C316 370 406 366 466 392V132C406 104 316 106 256 140Z" fill="#415A77" stroke="#415A77" strokeWidth="8" strokeLinejoin="round" />
      <path d="M256 160C200 132 128 130 74 152V366C128 346 200 350 256 380Z" fill="var(--bg)" />
      <path d="M256 160C312 132 384 130 438 152V366C384 346 312 350 256 380Z" fill="var(--bg)" />
      <path d="M256 160V380" stroke="#778D7A" strokeWidth="6" />
      <g stroke="#778D7A" strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M104 204Q165 194 224 212M104 250Q165 240 224 258M104 296Q165 286 224 304M104 342Q140 335 176 345" />
        <path d="M288 212Q347 194 408 204M288 258Q347 240 408 250M288 304Q347 286 408 296M288 345Q324 335 360 342" />
      </g>
      <path d="M330 150V250L350 232L370 250V142Z" fill="#C9AE7C" />
    </svg>
  );
}

const GRADE_CHOICES = [7, 8, 9, 10, 11, 12].map((n) => ({ n, value: `${n}th Grade`, label: `Grade ${n}` }));
const gradeLabel = (g) => (g ? g.replace(/^(\d+)\w*\s+Grade$/, "Grade $1") : "");

function GradeButtons({ value, onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {GRADE_CHOICES.map((g) => (
        <button key={g.n} className="pp-role-card" onClick={() => onPick(g.value)} aria-pressed={value === g.value}
          style={{ padding: "14px 6px", textAlign: "center", fontWeight: 700, fontSize: 15, color: "var(--text)", borderColor: value === g.value ? "var(--accent)" : undefined }}>
          {g.label}
        </button>
      ))}
    </div>
  );
}

function GradeGate({ onPick, onBack, theme, setTheme }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" }}>
      <button className="pp-btn pp-btn-ghost" style={{ position: "absolute", top: 20, right: 20, padding: 8, borderRadius: 999 }} onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <div className="pp-card pp-index-card" style={{ width: "100%", maxWidth: 420, padding: "34px 28px", borderRadius: 10 }}>
        <div className="pp-tape" />
        <button className="pp-btn pp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5, marginBottom: 14 }} onClick={onBack}>← Back</button>
        <div className="pp-serif" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Which grade are you in?</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>You'll only see notes and videos for your grade. We'll remember this on this device, and you can change it any time from the top of the page.</div>
        <GradeButtons value={null} onPick={onPick} />
      </div>
    </div>
  );
}

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
          <BookLogo size={72} style={{ margin: "0 auto 10px" }} />
          <div className="pp-serif" style={{ fontSize: 26, fontWeight: 700 }}>PrepList Pro</div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 4 }}>Notes, videos, files and past papers, all in one place.</div>
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

const MAX_NOTE_PHOTOS = 10;
function MultiPhotoPicker({ value, onChange, max = MAX_NOTE_PHOTOS }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setFailed(0);
    const room = max - value.length;
    const added = [];
    let bad = 0;
    for (const file of files.slice(0, Math.max(room, 0))) {
      try { added.push(await resizeImageAdaptive(file)); } catch { bad++; }
    }
    if (files.length > room) bad += files.length - Math.max(room, 0);
    setFailed(bad);
    if (added.length) onChange([...value, ...added]);
    setBusy(false);
  }
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= value.length) return; const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          {value.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} alt={`Page ${i + 1}`} style={{ height: 96, borderRadius: 8, border: "1px solid var(--border)", display: "block" }} />
              <div style={{ position: "absolute", left: 4, bottom: 4, display: "flex", gap: 3, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, background: "var(--bg)", borderRadius: 999, padding: "1px 7px" }}>{i + 1}</span>
                {i > 0 && <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: "0 6px", fontSize: 12, background: "var(--bg)", borderRadius: 999 }} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>}
                {i < value.length - 1 && <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: "0 6px", fontSize: 12, background: "var(--bg)", borderRadius: 999 }} onClick={() => move(i, 1)} aria-label="Move later">→</button>}
              </div>
              <button type="button" className="pp-btn pp-btn-ghost" style={{ position: "absolute", top: 4, right: 4, padding: 4, borderRadius: 999, background: "var(--bg)" }} onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label={`Remove photo ${i + 1}`}><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {busy ? (
        <div className="pp-btn pp-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", fontSize: 13.5 }}>
          <Loader2 size={15} style={{ animation: "pp-spin 0.9s linear infinite" }} /> Processing…
        </div>
      ) : value.length >= max ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>That's the maximum of {MAX_NOTE_PHOTOS} photos for one note.</div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="pp-file-slot">
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Upload size={12} /> {value.length ? "Add more" : "From files"} (pick several)</div>
            <input type="file" accept="image/*" multiple onChange={handleFiles} className="pp-file-input" aria-label="Photos" />
          </div>
          <div className="pp-file-slot">
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Camera size={12} /> Take a photo</div>
            <input type="file" accept="image/*" capture="environment" onChange={handleFiles} className="pp-file-input" aria-label="Take a photo" />
          </div>
        </div>
      )}
      {failed > 0 && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>{failed} photo{failed > 1 ? "s" : ""} couldn't be added (unreadable, or over the photo limit).</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Ask question / answer forms                                            */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Notes                                                                   */
/* ---------------------------------------------------------------------- */

function NotesView({ notes, user, onAddNote, onDeleteNote, onEditNote, lastNoteId, setLastNoteId, savedNoteIds, onToggleSavedNote }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [openId, setOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
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
      <FilterBar hideGrade={!!user.grade} query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search notes…"
        extra={canUpload && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Upload note</button>} />
      {lastNote && (
        <ContinueBanner title={lastNote.title} subtitle={lastNote.subject}
          onClick={() => document.getElementById(`note-${lastNote.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No notes yet" body={canUpload ? "Upload the first set of notes for students to study from." : (user.grade ? `No notes for ${gradeLabel(user.grade)} yet. Check back soon.` : "Only admins can upload notes — check back soon.")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {filtered.map((n) => {
            const isSaved = savedNoteIds.includes(n.id);
            return (
              <div key={n.id} id={`note-${n.id}`} className="pp-card" role="button" tabIndex={0}
                onClick={() => { setLastNoteId(n.id); setOpenId(n.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setLastNoteId(n.id); setOpenId(n.id); } }}
                style={{ borderRadius: 10, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", outline: n.id === lastNoteId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}><Tag text={n.subject} /><GradeTag text={n.grade} /></div>
                  {canUpload && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setEditId(n.id); }} aria-label="Edit" title="Edit"><Pencil size={14} /></button>}
                  {canUpload && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${n.title}"? You can undo for a few seconds afterwards.`)) onDeleteNote(n); }} aria-label="Delete note" title="Delete note"><Trash size={14} /></button>}
                  <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSavedNote(n.id); }} aria-label={isSaved ? "Remove bookmark" : "Add bookmark"}>
                    <Bookmark size={14} fill={isSaved ? "var(--sage)" : "none"} style={{ color: isSaved ? "var(--sage)" : "var(--accent)" }} />
                  </button>
                </div>
                <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8 }}>{n.title}</div>
                <Desc text={n.description} />
                {n.type === "image" ? (
                  <div style={{ position: "relative", marginTop: 8 }}>
                    <NoteImage note={n.thumb ? { content: n.thumb } : { ...n, fileId: noteFileIds(n)[0] }} noZoom style={{ width: "100%", height: 150, objectFit: "cover", objectPosition: "top", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                    {noteFileIds(n).length > 1 && <span style={{ position: "absolute", right: 6, bottom: 6, fontSize: 11, fontWeight: 700, background: "var(--bg)", color: "var(--text)", borderRadius: 999, padding: "2px 9px", border: "1px solid var(--border)" }}>{noteFileIds(n).length} pages</span>}
                  </div>
                ) : <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}><MathText text={n.content} /></p>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{roleLabel(n.authorRole)} · {timeAgo(n.createdAt)} · Tap to open</div>
              </div>
            );
          })}
        </div>
      )}
      {openId && notes.find((n) => n.id === openId) && (() => { const n = notes.find((x) => x.id === openId); return <NoteViewer note={n} saved={savedNoteIds.includes(n.id)} onToggleSaved={() => onToggleSavedNote(n.id)} onEdit={canUpload ? () => { setOpenId(null); setEditId(n.id); } : null} onClose={() => setOpenId(null)} />; })()}
      {editId && notes.find((n) => n.id === editId) && (() => { const n = notes.find((x) => x.id === editId); return <EditNoteModal key={n.id} note={n} onClose={() => setEditId(null)} onSave={(v) => onEditNote(n, v)} />; })()}
      {showForm && <AddNoteModal onClose={() => setShowForm(false)} onSubmit={async (payload, onProgress) => { const ok = await onAddNote(payload, onProgress); if (ok) setShowForm(false); }} />}
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
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const canSubmit = title.trim() && subject && grade && (type === "text" ? text.trim() : images.length > 0);

  return (
    <Modal title="Upload notes" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics cheat sheet" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <DescriptionField value={description} onChange={setDescription} />
      <Field label="Format">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 14px", fontSize: 13, background: type === "text" ? "var(--surface)" : "transparent", borderColor: type === "text" ? "var(--accent)" : "var(--border)" }} onClick={() => setType("text")}><FileText size={13} style={{ marginRight: 5, display: "inline" }} /> Text</button>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 14px", fontSize: 13, background: type === "image" ? "var(--surface)" : "transparent", borderColor: type === "image" ? "var(--accent)" : "var(--border)" }} onClick={() => setType("image")}><ImageIcon size={13} style={{ marginRight: 5, display: "inline" }} /> Image / scan</button>
        </div>
      </Field>
      {type === "text" ? <Field label="Notes"><MathToolbar textareaRef={textRef} value={text} setValue={setText} /><textarea ref={textRef} className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or write the notes…" /></Field>
        : <Field label="Photos or scanned pages (up to 10)"><MultiPhotoPicker value={images} onChange={setImages} /></Field>}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit || busy}
        onClick={async () => { setBusy(true); try { await onSubmit({ title: title.trim(), subject, grade, description: description.trim(), type, content: type === "text" ? text.trim() : images }, (d, n) => setProg([d, n])); } finally { setBusy(false); setProg(null); } }}>
        {busy ? (prog ? `Uploading photo ${prog[0]} of ${prog[1]}… keep this open` : "Publishing… keep this open") : "Publish note"}
      </button>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Videos                                                                  */
/* ---------------------------------------------------------------------- */

function VideosView({ videos, user, onAddVideo, onDeleteVideo, onEditVideo, lastVideoId, setLastVideoId, savedVideoIds, onToggleSavedVideo }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [editId, setEditId] = useState(null);
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
      <FilterBar hideGrade={!!user.grade} query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search videos…"
        extra={isAdmin && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Add video</button>} />
      {lastVideo && (
        <ContinueBanner title={lastVideo.title} subtitle={lastVideo.subject}
          onClick={() => document.getElementById(`video-${lastVideo.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={VideoIcon} title="No videos yet" body={isAdmin ? "Paste a YouTube link to add the first video." : (user.grade ? `No videos for ${gradeLabel(user.grade)} yet. Check back soon.` : "Only admins can add videos — check back soon.")} />
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
                    {isAdmin && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setEditId(v.id); }} aria-label="Edit" title="Edit"><Pencil size={14} /></button>}
                    {isAdmin && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${v.title}"? You can undo for a few seconds afterwards.`)) onDeleteVideo(v); }} aria-label="Delete video" title="Delete video"><Trash size={14} /></button>}
                    <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSavedVideo(v.id); }} aria-label={isSaved ? "Remove bookmark" : "Add bookmark"}>
                      <Bookmark size={14} fill={isSaved ? "var(--sage)" : "none"} style={{ color: isSaved ? "var(--sage)" : "var(--accent)" }} />
                    </button>
                  </div>
                  <div className="pp-serif" style={{ fontSize: 14.5, fontWeight: 600, marginTop: 8 }}>{v.title}</div>
                  <Desc text={v.description} lines={3} />
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Added by {roleLabel(v.addedByRole)} · {timeAgo(v.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editId && videos.find((v) => v.id === editId) && (() => { const v = videos.find((x) => x.id === editId); return <EditItemModal key={v.id} heading="Edit video" item={v} onClose={() => setEditId(null)} onSave={(patch) => onEditVideo(v, patch)} />; })()}
      {showForm && <AddVideoModal onClose={() => setShowForm(false)} onSubmit={async (payload) => { const ok = await onAddVideo(payload); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddVideoModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const videoId = extractYouTubeId(url);
  const canSubmit = title.trim() && subject && grade && videoId;

  return (
    <Modal title="Add a video" onClose={onClose}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Integration by parts, explained" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <DescriptionField value={description} onChange={setDescription} />
      <Field label="YouTube link">
        <input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        {url && !videoId && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>Couldn't read a video ID from that link.</div>}
      </Field>
      {videoId && (
        <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden", marginBottom: 14, background: "#000" }}>
          <iframe title="preview" src={`https://www.youtube.com/embed/${videoId}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} allowFullScreen />
        </div>
      )}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit} onClick={() => onSubmit({ title: title.trim(), subject, grade, description: description.trim(), youtubeId: videoId })}>Add video</button>
    </Modal>
  );
}

function Desc({ text, lines = 2, style }) {
  if (!text) return null;
  return <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--muted)", marginTop: 5, whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", ...style }}>{text}</div>;
}
function DescriptionField({ value, onChange }) {
  return (
    <Field label="Description (optional)">
      <textarea className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 64, resize: "vertical", fontFamily: "inherit" }} value={value} onChange={(e) => onChange(e.target.value)} maxLength={600} placeholder="e.g. Made by Sara, Grade 10. Covers chapters 4–5." />
    </Field>
  );
}
function EditItemModal({ heading, item, onClose, onSave }) {
  const [title, setTitle] = useState(item.title || "");
  const [subject, setSubject] = useState(item.subject || "");
  const [grade, setGrade] = useState(item.grade || "");
  const [description, setDescription] = useState(item.description || "");
  const [busy, setBusy] = useState(false);
  const canSave = title.trim() && subject && grade && !busy;
  return (
    <Modal title={heading} onClose={() => { if (!busy) onClose(); }}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <DescriptionField value={description} onChange={setDescription} />
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSave ? 1 : 0.5 }} disabled={!canSave}
        onClick={async () => { setBusy(true); try { const ok = await onSave({ title: title.trim(), subject, grade, description: description.trim() }); if (ok) onClose(); } finally { setBusy(false); } }}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </Modal>
  );
}
function ExistingPhoto({ id, inline }) {
  const [src] = useFileData(inline, id, true);
  return src ? <img src={src} alt="" style={{ height: 96, borderRadius: 8, border: "1px solid var(--border)", display: "block" }} /> : <div style={{ height: 96, width: 72, borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>Loading…</div>;
}
function EditNoteModal({ note, onClose, onSave }) {
  const [title, setTitle] = useState(note.title || "");
  const [subject, setSubject] = useState(note.subject || "");
  const [grade, setGrade] = useState(note.grade || "");
  const [description, setDescription] = useState(note.description || "");
  const [text, setText] = useState(note.type === "text" ? note.content || "" : "");
  const textRef = useRef(null);
  const [existing, setExisting] = useState(() => note.type !== "image" ? [] : noteFileIds(note).length ? noteFileIds(note).map((id) => ({ id })) : note.content ? [{ inline: note.content }] : []);
  const [added, setAdded] = useState([]);
  const [busy, setBusy] = useState(false);
  const photoCount = existing.length + added.length;
  const canSave = title.trim() && subject && grade && !busy && (note.type === "text" ? text.trim() : photoCount > 0);
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= existing.length) return; const next = [...existing]; [next[i], next[j]] = [next[j], next[i]]; setExisting(next); };
  return (
    <Modal title="Edit note" onClose={() => { if (!busy) onClose(); }}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <DescriptionField value={description} onChange={setDescription} />
      {note.type === "text" ? (
        <Field label="Notes"><MathToolbar textareaRef={textRef} value={text} setValue={setText} /><textarea ref={textRef} className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      ) : (
        <Field label={`Photos (${photoCount} of ${MAX_NOTE_PHOTOS})`}>
          {existing.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {existing.map((x, i) => (
                <div key={x.id || "inline"} style={{ position: "relative" }}>
                  <ExistingPhoto id={x.id} inline={x.inline} />
                  <div style={{ position: "absolute", left: 4, bottom: 4, display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: "var(--bg)", borderRadius: 999, padding: "1px 7px" }}>{i + 1}</span>
                    {i > 0 && <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: "0 6px", fontSize: 12, background: "var(--bg)", borderRadius: 999 }} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>}
                    {i < existing.length - 1 && <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: "0 6px", fontSize: 12, background: "var(--bg)", borderRadius: 999 }} onClick={() => move(i, 1)} aria-label="Move later">→</button>}
                  </div>
                  <button type="button" className="pp-btn pp-btn-ghost" style={{ position: "absolute", top: 4, right: 4, padding: 4, borderRadius: 999, background: "var(--bg)" }} onClick={() => setExisting(existing.filter((_, k) => k !== i))} aria-label={`Remove photo ${i + 1}`}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <MultiPhotoPicker value={added} onChange={setAdded} max={MAX_NOTE_PHOTOS - existing.length} />
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>New photos are added after the existing ones.</div>
        </Field>
      )}
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSave ? 1 : 0.5 }} disabled={!canSave}
        onClick={async () => { setBusy(true); try { const ok = await onSave({ title: title.trim(), subject, grade, description: description.trim(), text: text.trim(), existing, added }); if (ok) onClose(); } finally { setBusy(false); } }}>
        {busy ? "Saving… please keep this open" : "Save changes"}
      </button>
    </Modal>
  );
}

function noteFileIds(n) { return n.fileIds && n.fileIds.length ? n.fileIds : n.fileId ? [n.fileId] : []; }
function NoteImages({ note, style, noZoom }) {
  const ids = noteFileIds(note);
  if (ids.length <= 1) return <NoteImage note={note} style={style} noZoom={noZoom} />;
  return <div>{ids.map((id, i) => <div key={id} style={{ marginTop: i ? 2 : 0 }}><NoteImage note={{ fileId: id }} style={style} noZoom={noZoom} /></div>)}</div>;
}

async function loadFileData(id) {
  if (fileCache.has(id)) return fileCache.get(id);
  const d = await db.collection("files").doc(id).get();
  const v = d.exists ? d.data().data : null;
  if (v) fileCache.set(id, v);
  return v;
}
async function dataUrlToFile(url, name) {
  const blob = await (await fetch(url)).blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return new File([blob], `${name}.${ext}`, { type: blob.type || "image/jpeg" });
}

function NoteViewer({ note, saved, onToggleSaved, onEdit, onClose }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  async function saveToPhotos() {
    if (saving) return;
    setSaving(true); setMsg("");
    try {
      const ids = noteFileIds(note);
      const urls = ids.length ? await Promise.all(ids.map(loadFileData)) : [note.content];
      if (urls.some((u) => !u)) throw new Error("missing");
      const base = (note.title || "note").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "note";
      const files = await Promise.all(urls.map((u, i) => dataUrlToFile(u, urls.length > 1 ? `${base}-${i + 1}` : base)));
      if (navigator.canShare && navigator.canShare({ files })) {
        try { await navigator.share({ files }); setMsg("Tap “Save Image” to add to Photos"); }
        catch (e) { if (e && e.name === "AbortError") { setSaving(false); return; } throw e; }
      } else {
        files.forEach((f, i) => setTimeout(() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(f); a.download = f.name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }, i * 400));
        setMsg("Downloaded");
      }
    } catch (e) { setMsg("Couldn't save this one"); }
    setSaving(false);
    setTimeout(() => setMsg(""), 3500);
  }
  const btn = { padding: "7px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 };
  return (
    <div role="dialog" aria-label={note.title} style={{ position: "fixed", inset: 0, zIndex: 85, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(8px + env(safe-area-inset-top)) 10px 8px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 3 }}><Tag text={note.subject} /><GradeTag text={note.grade} /></div>
        </div>
        {note.type === "image" && <button className="pp-btn pp-btn-ghost" style={btn} onClick={saveToPhotos} disabled={saving} aria-label="Save to camera roll"><Download size={14} /> {saving ? "…" : "Photos"}</button>}
        {onEdit && <button className="pp-btn pp-btn-ghost" style={btn} onClick={onEdit}><Pencil size={14} /></button>}
        <button className="pp-btn pp-btn-ghost" style={btn} onClick={onToggleSaved} aria-label={saved ? "Remove bookmark" : "Bookmark"}>
          <Bookmark size={14} fill={saved ? "var(--sage)" : "none"} style={{ color: saved ? "var(--sage)" : "var(--accent)" }} />
        </button>
        <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999, flexShrink: 0 }} onClick={onClose} aria-label="Close note"><X size={18} /></button>
      </div>
      {msg && <div style={{ position: "absolute", top: "calc(70px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: "var(--text)", color: "var(--bg)", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 999, zIndex: 2, whiteSpace: "nowrap" }}>{msg}</div>}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: note.type === "image" ? "0 0 env(safe-area-inset-bottom)" : "16px 14px 40px" }}>
        <div style={{ maxWidth: note.type === "image" ? 1400 : 1100, margin: "0 auto" }}>
          {note.description && <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", whiteSpace: "pre-wrap", margin: note.type === "image" ? "12px 14px" : "0 0 14px" }}>{note.description}</p>}
          {note.type === "image"
            ? <NoteImages note={note} noZoom style={{ width: "100%", display: "block" }} />
            : <p style={{ fontSize: 16, lineHeight: 1.65, whiteSpace: "pre-wrap" }}><MathText text={note.content} /></p>}
        </div>
      </div>
    </div>
  );
}

function NoteImage({ note, style, noZoom }) {
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
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === "Escape") setZoom(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);
  return (
    <div ref={boxRef} style={{ minHeight: src ? 0 : 90 }}>
      {zoom && src && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.88)", overflow: "auto", WebkitOverflowScrolling: "touch", cursor: "zoom-out" }}>
          <button type="button" className="pp-btn pp-btn-ghost" style={{ position: "fixed", top: 12, right: 12, padding: 8, borderRadius: 999, background: "var(--bg)", zIndex: 91 }} onClick={() => setZoom(false)} aria-label="Close picture"><X size={18} /></button>
          <img src={src} alt="" style={{ display: "block", margin: "0 auto", maxWidth: "100%", minHeight: "100%", objectFit: "contain" }} />
        </div>
      )}
      {src ? <img src={src} alt="" style={noZoom ? style : { ...style, cursor: "zoom-in" }} onClick={noZoom ? undefined : () => setZoom(true)} draggable={false} /> : <div style={{ fontSize: 12.5, color: "var(--muted)", paddingTop: 8 }}>{failed ? "Couldn't load this image." : "Loading image…"}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Files — admins upload any file up to 25 MB; listing stays light and    */
/* the bytes are fetched only when someone opens or downloads it.         */
/* ---------------------------------------------------------------------- */

function fileKind(meta) {
  const mime = meta.mimeType || "";
  const name = meta.fileName || "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("text/") || /\.(txt|csv|md|log)$/i.test(name)) return "text";
  return "other";
}
function fileKindIcon(meta) { return fileKind(meta) === "image" ? ImageIcon : FileText; }
function fileTypeLabel(meta) {
  const kind = fileKind(meta);
  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  if (kind === "text") return "Text";
  const ext = String(meta.fileName || "").split(".");
  return ext.length > 1 ? ext.pop().toUpperCase() : "File";
}

function FilesView({ files, user, onAddFile, onDeleteFile, onEditFile, onDownloadFile, lastFileId, setLastFileId, savedFileIds, onToggleSavedFile }) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [openId, setOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
  const canUpload = hasElevatedAccess(user);

  const filtered = useMemo(() => {
    let list = files;
    if (subject) list = list.filter((f) => f.subject === subject);
    if (grade) list = list.filter((f) => f.grade === grade);
    if (query.trim()) {
      const s = query.trim().toLowerCase();
      list = list.filter((f) => (f.title || "").toLowerCase().includes(s) || (f.fileName || "").toLowerCase().includes(s) || (f.subject || "").toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [files, query, subject, grade]);

  const lastFile = files.find((f) => f.id === lastFileId);

  return (
    <div>
      <FilterBar query={query} setQuery={setQuery} subject={subject} setSubject={setSubject} grade={grade} setGrade={setGrade} placeholder="Search files…"
        extra={canUpload && <button className="pp-btn pp-btn-primary" style={{ padding: "9px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowForm(true)}><Plus size={15} /> Upload file</button>} />
      {lastFile && (
        <ContinueBanner title={lastFile.title} subtitle={lastFile.subject}
          onClick={() => document.getElementById(`file-${lastFile.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      )}
      {filtered.length === 0 ? (
        <EmptyState icon={Folder} title="No files yet" body={canUpload ? "Upload the first file for students to open or download." : "Only admins can upload files — check back soon."} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {filtered.map((f) => {
            const isSaved = savedFileIds.includes(f.id);
            const KindIcon = fileKindIcon(f);
            const c = subjectColor(f.subject || "x");
            const open = () => { setLastFileId(f.id); setOpenId(f.id); };
            return (
              <div key={f.id} id={`file-${f.id}`} className="pp-card" role="button" tabIndex={0}
                onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
                style={{ borderRadius: 10, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", outline: f.id === lastFileId ? "2px solid var(--accent)" : "none", outlineOffset: 2 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}><Tag text={f.subject} /><GradeTag text={f.grade} /></div>
                  <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onDownloadFile(f); }} aria-label="Download file" title="Download file"><Download size={14} /></button>
                  {canUpload && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setEditId(f.id); }} aria-label="Edit" title="Edit"><Pencil size={14} /></button>}
                  {canUpload && <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${f.title}"? You can undo for a few seconds afterwards.`)) onDeleteFile(f); }} aria-label="Delete file" title="Delete file"><Trash size={14} /></button>}
                  <button className="pp-btn pp-btn-ghost" style={{ padding: 5, borderRadius: 999, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggleSavedFile(f.id); }} aria-label={isSaved ? "Remove bookmark" : "Add bookmark"}>
                    <Bookmark size={14} fill={isSaved ? "var(--sage)" : "none"} style={{ color: isSaved ? "var(--sage)" : "var(--accent)" }} />
                  </button>
                </div>
                <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 600, marginTop: 8, wordBreak: "break-word" }}>{f.title}</div>
                <Desc text={f.description} />
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <KindIcon size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.fileName}>{f.fileName}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fileTypeLabel(f)} · {formatBytes(f.size)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>Added by {roleLabel(f.addedByRole)} · {timeAgo(f.createdAt)} · Tap to open</div>
              </div>
            );
          })}
        </div>
      )}
      {openId && files.find((f) => f.id === openId) && (() => { const f = files.find((x) => x.id === openId); return <FileViewer file={f} onClose={() => setOpenId(null)} onDownload={onDownloadFile} />; })()}
      {editId && files.find((f) => f.id === editId) && (() => { const f = files.find((x) => x.id === editId); return <EditItemModal key={f.id} heading="Edit file" item={f} onClose={() => setEditId(null)} onSave={(patch) => onEditFile(f, patch)} />; })()}
      {showForm && <AddFileModal onClose={() => setShowForm(false)} onSubmit={async (payload, onProgress) => { const ok = await onAddFile(payload, onProgress); if (ok) setShowForm(false); }} />}
    </div>
  );
}

function AddFileModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const canSubmit = title.trim() && subject && grade && file && file.size > 0 && file.size <= MAX_LIBRARY_FILE_BYTES && !busy;

  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    if (!f.size) setError("That file is empty — pick another one.");
    else if (f.size > MAX_LIBRARY_FILE_BYTES) setError(`That file is ${formatBytes(f.size)} — the limit is ${formatBytes(MAX_LIBRARY_FILE_BYTES)}.`);
    else setError("");
  }

  return (
    <Modal title="Upload a file" onClose={() => { if (!busy) onClose(); }}>
      <Field label="Title"><input className="pp-input" style={{ width: "100%", padding: "9px 12px", fontSize: 14.5 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics formula booklet" /></Field>
      <TwoUp>
        <Field label="Subject"><SubjectSelect value={subject} onChange={setSubject} /></Field>
        <Field label="Grade"><GradeSelect value={grade} onChange={setGrade} /></Field>
      </TwoUp>
      <DescriptionField value={description} onChange={setDescription} />
      <Field label="File (any type, up to 25 MB)">
        <div className="pp-file-slot">
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}><Upload size={12} /> Choose a file</div>
          <input type="file" onChange={pickFile} disabled={busy} className="pp-file-input" aria-label="File to upload" />
        </div>
        {file && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5 }}>
            <FileText size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
            <span style={{ color: "var(--muted)", flexShrink: 0 }}>{formatBytes(file.size)}</span>
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: "#8A3434", marginTop: 6 }}>{error}</div>}
      </Field>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Large files are stored in parts and only downloaded when someone opens them. PDFs, images and text can preview here; other types download to open in the right app.</div>
      <button className="pp-btn pp-btn-primary" style={{ width: "100%", padding: "10px 0", opacity: canSubmit ? 1 : 0.5 }} disabled={!canSubmit}
        onClick={async () => { setBusy(true); setProgress(0); try { await onSubmit({ title: title.trim(), subject, grade, description: description.trim(), file }, setProgress); } finally { setBusy(false); } }}>
        {busy ? `Uploading… ${progress}%` : "Upload file"}
      </button>
    </Modal>
  );
}

function FileViewer({ file, onClose, onDownload }) {
  const kind = fileKind(file);
  const [state, setState] = useState({ loading: true, url: null, text: null, tooBig: false, failed: false });

  useEffect(() => {
    let live = true;
    let objectUrl = null;
    setState({ loading: true, url: null, text: null, tooBig: false, failed: false });
    (async () => {
      try {
        const blob = await fetchLibraryFileBlob(file);
        if (!live) return;
        if (kind === "text" && blob.size <= MAX_TEXT_PREVIEW_BYTES) {
          const text = await blob.text();
          if (live) setState({ loading: false, url: null, text, tooBig: false, failed: false });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        if (live) setState({ loading: false, url: objectUrl, text: null, tooBig: kind === "text", failed: false });
      } catch {
        if (live) setState({ loading: false, url: null, text: null, tooBig: false, failed: true });
      }
    })();
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id, kind]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div role="dialog" aria-label={file.title} style={{ position: "fixed", inset: 0, zIndex: 85, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pp-serif" style={{ fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.title}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}><Tag text={file.subject} /><GradeTag text={file.grade} /></div>
        </div>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={() => onDownload(file)}>
          <Download size={14} /> Download
        </button>
        <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999, flexShrink: 0 }} onClick={onClose} aria-label="Close file"><X size={18} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 14px 40px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", minHeight: "100%", display: "flex", flexDirection: "column" }}>
          {file.description && <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", whiteSpace: "pre-wrap", margin: "0 0 14px" }}>{file.description}</p>}
          {state.loading ? <Loading label="Loading file…" /> : state.failed ? (
            <EmptyState icon={FileText} title="Couldn't load this file" body="It may have been removed, or the connection dropped. Try again, or use Download." />
          ) : kind === "image" ? (
            <img src={state.url} alt={file.fileName} style={{ maxWidth: "100%", margin: "0 auto", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
          ) : kind === "pdf" ? (
            <div style={{ flex: 1, minHeight: "70dvh", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                <span style={{ flex: 1, minWidth: 180 }}>If the preview stays blank, use Download or open it in a new tab.</span>
                {state.url && <a className="pp-btn pp-btn-ghost" href={state.url} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", fontSize: 12, textDecoration: "none" }}>Open in new tab</a>}
              </div>
              <iframe title={file.fileName} src={state.url} style={{ flex: 1, width: "100%", minHeight: "65dvh", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
            </div>
          ) : kind === "text" && state.text != null ? (
            <pre style={{ margin: 0, padding: 14, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "monospace" }}>{state.text}</pre>
          ) : (
            <div className="pp-card" style={{ borderRadius: 10, padding: 26, textAlign: "center", margin: "auto", maxWidth: 420 }}>
              <Folder size={34} style={{ color: "var(--muted)", margin: "0 auto 10px" }} />
              <div className="pp-serif" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{state.tooBig ? "Too large to preview here" : "No preview for this file type"}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 14 }}>Download it to open it in the right app.</div>
              <button className="pp-btn pp-btn-primary" style={{ padding: "9px 18px" }} onClick={() => onDownload(file)}><Download size={14} style={{ marginRight: 6, display: "inline" }} />Download file</button>
              {state.url && <div style={{ marginTop: 10 }}><a className="pp-btn pp-btn-ghost" href={state.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", fontSize: 12.5, textDecoration: "none", display: "inline-block" }}>Open in new tab</a></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function SavedView({ notes, videos, files, lastNoteId, lastVideoId, lastFileId, savedNoteIds, savedVideoIds, savedFileIds, onToggleSavedNote, onToggleSavedVideo, onToggleSavedFile, onJump }) {
  const lastNote = notes.find((n) => n.id === lastNoteId);
  const lastVideo = videos.find((v) => v.id === lastVideoId);
  const lastFile = files.find((f) => f.id === lastFileId);
  const recents = [
    lastNote && { tab: "notes", elId: `note-${lastNote.id}`, title: lastNote.title, subtitle: lastNote.subject },
    lastVideo && { tab: "videos", elId: `video-${lastVideo.id}`, title: lastVideo.title, subtitle: lastVideo.subject },
    lastFile && { tab: "files", elId: `file-${lastFile.id}`, title: lastFile.title, subtitle: lastFile.subject }
  ].filter(Boolean);

  const savedNotes = notes.filter((n) => savedNoteIds.includes(n.id));
  const savedVideos = videos.filter((v) => savedVideoIds.includes(v.id));
  const savedFiles = files.filter((f) => savedFileIds.includes(f.id));
  const hasSaved = savedNotes.length || savedVideos.length || savedFiles.length;

  return (
    <div>
      <div className="pp-serif" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 10 }}>Continue where you left off</div>
      {recents.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>Nothing opened yet — browse Notes, Videos or Files to get started.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {recents.map((r) => <ContinueBanner key={r.tab} title={r.title} subtitle={r.subtitle} onClick={() => onJump(r.tab, r.elId)} />)}
        </div>
      )}

      <div className="pp-serif" style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 10 }}>Bookmarked</div>
      {!hasSaved ? (
        <EmptyState icon={Bookmark} title="Nothing bookmarked yet" body="Tap the bookmark icon on any note, video or file to save it here." />
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
          <BookmarkSection label="Files" icon={Folder} items={savedFiles}>
            {savedFiles.map((f) => (
              <BookmarkRow key={f.id} title={f.title} tags={<><Tag text={f.subject} /><GradeTag text={f.grade} /></>}
                onOpen={() => onJump("files", `file-${f.id}`)} onRemove={() => onToggleSavedFile(f.id)} />
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
const cambridgeLink = (label, slug) => ({ pick: { level: slug.startsWith("cambridge-igcse") ? "IGCSE" : "AS & A Level", slug }, label: label + " — papers & mark schemes", url: `${CAMBRIDGE_BASE}/${slug}/past-papers/` });
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
    title: "About Save My Exams", source: "sme", official: false,
    note: "Third-party revision site with past papers and notes by topic. Some content needs a free or paid account. We only link to it — nothing from the site is copied or embedded here. Left half / Right half open a window on that half of your screen, and a PDF you open inside it stays in that window.",
    links: [
      { label: "Save My Exams home", url: "https://www.savemyexams.com/" },
      { label: "All IGCSE subjects", url: "https://www.savemyexams.com/igcse/" },
      { label: "All AS Level subjects", url: "https://www.savemyexams.com/as/" },
      { label: "All A Level subjects", url: "https://www.savemyexams.com/a-level/" }
    ]
  },
  {
    title: "Save My Exams \u2014 IGCSE \u2014 Cambridge", source: "sme", official: false, compact: true,
    links: [
      { label: "Biology", url: "https://www.savemyexams.com/igcse/biology/cie/past-papers/" },
      { label: "Business", url: "https://www.savemyexams.com/igcse/business/cie/past-papers/" },
      { label: "Chemistry", url: "https://www.savemyexams.com/igcse/chemistry/cie/past-papers/" },
      { label: "Computer Science", url: "https://www.savemyexams.com/igcse/computer-science/cie/past-papers/" },
      { label: "Economics", url: "https://www.savemyexams.com/igcse/economics/cie/past-papers/" },
      { label: "English Language", url: "https://www.savemyexams.com/igcse/english-language/cie/past-papers/" },
      { label: "English Literature", url: "https://www.savemyexams.com/igcse/english-literature/cie/past-papers/" },
      { label: "Geography", url: "https://www.savemyexams.com/igcse/geography/cie/past-papers/" },
      { label: "History", url: "https://www.savemyexams.com/igcse/history/cie/past-papers/" },
      { label: "Maths", url: "https://www.savemyexams.com/igcse/maths/cie/past-papers/" },
      { label: "Physics", url: "https://www.savemyexams.com/igcse/physics/cie/past-papers/" },
      { label: "Psychology", url: "https://www.savemyexams.com/igcse/psychology/cie/past-papers/" },
      { label: "Sociology", url: "https://www.savemyexams.com/igcse/sociology/cie/past-papers/" }
    ]
  },
  {
    title: "Save My Exams \u2014 IGCSE \u2014 Edexcel", source: "sme", official: false, compact: true,
    links: [
      { label: "Arabic", url: "https://www.savemyexams.com/igcse/arabic/edexcel/past-papers/" },
      { label: "Biology", url: "https://www.savemyexams.com/igcse/biology/edexcel/past-papers/" },
      { label: "Business", url: "https://www.savemyexams.com/igcse/business/edexcel/past-papers/" },
      { label: "Chemistry", url: "https://www.savemyexams.com/igcse/chemistry/edexcel/past-papers/" },
      { label: "Chinese", url: "https://www.savemyexams.com/igcse/chinese/edexcel/past-papers/" },
      { label: "Computer Science", url: "https://www.savemyexams.com/igcse/computer-science/edexcel/past-papers/" },
      { label: "Economics", url: "https://www.savemyexams.com/igcse/economics/edexcel/past-papers/" },
      { label: "English Literature", url: "https://www.savemyexams.com/igcse/english-literature/edexcel/past-papers/" },
      { label: "French", url: "https://www.savemyexams.com/igcse/french/edexcel/past-papers/" },
      { label: "Further Maths", url: "https://www.savemyexams.com/igcse/further-maths/edexcel/past-papers/" },
      { label: "Geography", url: "https://www.savemyexams.com/igcse/geography/edexcel/past-papers/" },
      { label: "History", url: "https://www.savemyexams.com/igcse/history/edexcel/past-papers/" },
      { label: "Maths", url: "https://www.savemyexams.com/igcse/maths/edexcel/a/past-papers/" },
      { label: "Physics", url: "https://www.savemyexams.com/igcse/physics/edexcel/past-papers/" }
    ]
  },
  {
    title: "Save My Exams \u2014 AS Level \u2014 Cambridge", source: "sme", official: false, compact: true,
    links: [
      { label: "Biology", url: "https://www.savemyexams.com/as/biology/cie/past-papers/" },
      { label: "Business", url: "https://www.savemyexams.com/as/business/cie/past-papers/" },
      { label: "Chemistry", url: "https://www.savemyexams.com/as/chemistry/cie/past-papers/" },
      { label: "Computer Science", url: "https://www.savemyexams.com/as/computer-science/cie/past-papers/" },
      { label: "Economics", url: "https://www.savemyexams.com/as/economics/cie/past-papers/" },
      { label: "English Language", url: "https://www.savemyexams.com/as/english-language/cie/past-papers/" },
      { label: "Further Maths", url: "https://www.savemyexams.com/as/further-maths/cie/past-papers/" },
      { label: "History", url: "https://www.savemyexams.com/as/history/cie/past-papers/" },
      { label: "Maths", url: "https://www.savemyexams.com/as/maths/cie/past-papers/" },
      { label: "Physics", url: "https://www.savemyexams.com/as/physics/cie/past-papers/" },
      { label: "Psychology", url: "https://www.savemyexams.com/as/psychology/cie/past-papers/" },
      { label: "Sociology", url: "https://www.savemyexams.com/as/sociology/cie/past-papers/" }
    ]
  },
  {
    title: "Save My Exams \u2014 A Level \u2014 Cambridge", source: "sme", official: false, compact: true,
    links: [
      { label: "Biology", url: "https://www.savemyexams.com/a-level/biology/cie/past-papers/" },
      { label: "Business", url: "https://www.savemyexams.com/a-level/business/cie/past-papers/" },
      { label: "Chemistry", url: "https://www.savemyexams.com/a-level/chemistry/cie/past-papers/" },
      { label: "Computer Science", url: "https://www.savemyexams.com/a-level/computer-science/cie/past-papers/" },
      { label: "Economics", url: "https://www.savemyexams.com/a-level/economics/cie/past-papers/" },
      { label: "English Language", url: "https://www.savemyexams.com/a-level/english-language/cie/past-papers/" },
      { label: "English Literature", url: "https://www.savemyexams.com/a-level/english-literature/cie/past-papers/" },
      { label: "Further Maths", url: "https://www.savemyexams.com/a-level/further-maths/cie/past-papers/" },
      { label: "Geography", url: "https://www.savemyexams.com/a-level/geography/cie/past-papers/" },
      { label: "History", url: "https://www.savemyexams.com/a-level/history/cie/past-papers/" },
      { label: "Maths", url: "https://www.savemyexams.com/a-level/maths/cie/past-papers/" },
      { label: "Physics", url: "https://www.savemyexams.com/a-level/physics/cie/past-papers/" },
      { label: "Psychology", url: "https://www.savemyexams.com/a-level/psychology/cie/past-papers/" },
      { label: "Sociology", url: "https://www.savemyexams.com/a-level/sociology/cie/past-papers/" }
    ]
  },
  {
    title: "Save My Exams \u2014 A Level \u2014 Edexcel (International)", source: "sme", official: false, compact: true,
    links: [
      { label: "Arabic", url: "https://www.savemyexams.com/a-level/arabic/edexcel/past-papers/" },
      { label: "Business", url: "https://www.savemyexams.com/a-level/business/edexcel/past-papers/" },
      { label: "Chemistry", url: "https://www.savemyexams.com/a-level/chemistry/edexcel/past-papers/" },
      { label: "Chinese", url: "https://www.savemyexams.com/a-level/chinese/edexcel/past-papers/" },
      { label: "English Language", url: "https://www.savemyexams.com/a-level/english-language/edexcel/past-papers/" },
      { label: "English Literature", url: "https://www.savemyexams.com/a-level/english-literature/edexcel/past-papers/" },
      { label: "French", url: "https://www.savemyexams.com/a-level/french/edexcel/past-papers/" },
      { label: "Further Maths", url: "https://www.savemyexams.com/a-level/further-maths/edexcel/past-papers/" },
      { label: "Geography", url: "https://www.savemyexams.com/a-level/geography/edexcel/past-papers/" },
      { label: "History", url: "https://www.savemyexams.com/a-level/history/edexcel/past-papers/" },
      { label: "Maths", url: "https://www.savemyexams.com/a-level/maths/edexcel/past-papers/" },
      { label: "Physics", url: "https://www.savemyexams.com/a-level/physics/edexcel/past-papers/" },
      { label: "Psychology", url: "https://www.savemyexams.com/a-level/psychology/edexcel/past-papers/" }
    ]
  },
  {
    title: "Save My Exams — AP", source: "sme", official: false, compact: true,
    links: [
      { label: "All AP subjects", url: "https://www.savemyexams.com/ap/" },
      { label: "AP Biology", url: "https://www.savemyexams.com/ap/biology/" },
      { label: "AP Chemistry", url: "https://www.savemyexams.com/ap/chemistry/" },
      { label: "AP Physics", url: "https://www.savemyexams.com/ap/physics/" },
      { label: "AP Psychology", url: "https://www.savemyexams.com/ap/psychology/" },
      { label: "AP Statistics", url: "https://www.savemyexams.com/ap/statistics/" },
      { label: "AP Environmental Science", url: "https://www.savemyexams.com/ap/environmental-science/" },
      { label: "AP Calculus AB", url: "https://www.savemyexams.com/ap/maths/college-board/calculus-ab/20/" },
      { label: "AP Calculus BC", url: "https://www.savemyexams.com/ap/maths/college-board/calculus-bc/20/" },
      { label: "AP US History", url: "https://www.savemyexams.com/ap/history/college-board/us-history/23/" }
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
  const [alt, setAlt] = useState(false);
  useEffect(() => { setAlt(false); }, [item && item.url]);
  const src = item ? (alt ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(item.url)}` : item.url) : "";
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <select className="pp-select" aria-label={label} style={{ padding: "5px 8px", fontSize: 12.5, width: "100%" }} value={item ? item.url : ""} onChange={(e) => onPick(e.target.value)}>
            {!item && <option value="">Choose a page…</option>}
            {items.map((i) => <option key={i.url} value={i.url}>{i.group}: {i.label}</option>)}
          </select>
        </div>
        {item && <button className="pp-btn pp-btn-ghost" style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }} onClick={() => setAlt((v) => !v)}>{alt ? "Normal viewer" : "Blank? Try other viewer"}</button>}
        {item && <a className="pp-btn pp-btn-ghost" href={item.url} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>New tab</a>}
      </div>
      {item && <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "4px 12px", borderBottom: "1px solid var(--border)" }}>Large PDFs can take a few seconds. If this side stays blank, press “Blank? Try other viewer”, or use New tab.</div>}
      {item ? <iframe key={src} title={item.label} src={src} style={{ flex: 1, width: "100%", minHeight: 0, border: 0, background: "#fff" }} />
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

function CambridgePapers({ onOpen, onHalf, preset }) {
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState("IGCSE");
  const [slug, setSlug] = useState("");
  const [seriesName, setSeriesName] = useState("");
  useEffect(() => {
    fetch("cambridge-papers.json").then((r) => r.json()).then(setIndex).catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (!preset || !index) return;
    const subjectMatch = index.subjects.find((x) => x.slug === preset.slug);
    setLevel(preset.level); setSlug(preset.slug); setSeriesName(subjectMatch ? Object.keys(subjectMatch.series)[0] || "" : "");
    const el = document.getElementById("cambridge-picker");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preset, index]);
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
    <div id="cambridge-picker" className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 22 }}>
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
              <a className="pp-btn pp-btn-ghost" style={{ ...btn, textDecoration: "none" }} href={url(d.qp)} target="_blank" rel="noopener noreferrer">New tab</a>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => onHalf(url(d.qp), "left")}>Left half</button>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => onHalf(url(d.qp), "right")}>Right half</button></span>}
            {d.ms && <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>Mark scheme</span>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => open(d.ms, null)}>Open</button>
              <a className="pp-btn pp-btn-ghost" style={{ ...btn, textDecoration: "none" }} href={url(d.ms)} target="_blank" rel="noopener noreferrer">New tab</a>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => onHalf(url(d.ms), "left")}>Left half</button>
              <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => onHalf(url(d.ms), "right")}>Right half</button></span>}
            {d.qp && d.ms && <button className="pp-btn pp-btn-primary" style={btn} onClick={() => open(d.qp, d.ms)}>Paper + mark scheme side by side</button>}
            {d.qp && d.ms && <button className="pp-btn pp-btn-ghost" style={btn} onClick={() => { onHalf(url(d.qp), "left"); onHalf(url(d.ms), "right"); }} title="Opens two windows, one on each half of your screen">Two half-screen windows</button>}
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
  const [preset, setPreset] = useState(null);
  const [split, setSplit] = useState(null);
  const embedItems = RESOURCE_GROUPS.flatMap((g) => g.links.filter((l) => l.embed).map((l) => ({ ...l, group: g.title })));
  const half = (url, side) => { if (!openHalfScreen(url, side)) notify({ kind: "error", text: "Your browser blocked the pop-up. Allow pop-ups for this site, then try again." }); };
  return (
    <div>
      <div className="pp-card" style={{ borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 13, lineHeight: 1.55 }}>
        <div className="pp-serif" style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>Past papers — pick your exam board</div>
        Past papers belong to the exam boards, and Cambridge doesn't allow them to be republished on other websites — so this page links to the official sources instead of copying them.
        <b>Cambridge:</b> choose a subject and pick papers, and each question paper and mark scheme opens straight into a split screen (side by side, or stacked on a phone) — the PDFs stay inside the split. <b>Other sites</b> (Pearson, College Board, the IB, Save My Exams) refuse to be shown inside other websites, so use <b>Open</b> (new tab) or <b>Left half</b> / <b>Right half</b>, which open a window on that half of your screen; a PDF you open inside that window stays in it.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="tablist" aria-label="Past paper source">
        {PAPER_SOURCES.map((p) => (
          <button key={p.id} role="tab" aria-selected={source === p.id} className={`pp-btn ${source === p.id ? "pp-btn-primary" : "pp-btn-ghost"}`} style={{ padding: "7px 16px", fontSize: 13.5 }} onClick={() => setSource(p.id)}>{p.label}</button>
        ))}
      </div>
      {source === "cambridge" && <CambridgePapers preset={preset} onHalf={half} onOpen={(items, left, right) => setSplit({ items, left, right })} />}
      {RESOURCE_GROUPS.filter((g) => g.source === source).map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700 }}>{g.title}</div>
            <GradeTag text={g.official ? "Official" : "Third-party"} />
          </div>
          {g.note && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>{g.note}</div>}
          <div style={{ display: "grid", gridTemplateColumns: g.compact ? "repeat(auto-fill, minmax(300px, 1fr))" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 8 }}>
            {g.links.map((l) => (
              <div key={l.url} className="pp-card" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{l.label}</div>
                <a className="pp-btn pp-btn-ghost" href={l.url} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Open</a>
                {l.pick ? (
                  <button className="pp-btn pp-btn-primary" onClick={() => setPreset({ ...l.pick, n: Date.now() })} style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0 }} title="Choose a paper and mark scheme and open them side by side">Pick papers</button>
                ) : l.embed ? (
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

function fmtClock(total) {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

function FlashcardsView({ sharedDecks, user, notify }) {
  useEffect(() => { const id = setTimeout(() => { loadTesseract().catch(() => {}); }, 1200); return () => clearTimeout(id); }, []);
  const [localDecks, setDecks] = useLocalState("preplist:flashcards", []);
  const [boxes, setBoxes] = useLocalState("preplist:flashBoxes", {});
  const [deckId, setDeckId] = useState("");
  const [newDeck, setNewDeck] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newGrade, setNewGrade] = useState(user.grade || "");
  const [shareIt, setShareIt] = useState(true);
  const [fSubject, setFSubject] = useState("");
  const [fGrade, setFGrade] = useState("");
  const myUid = auth && auth.currentUser ? auth.currentUser.uid : null;
  const staff = hasElevatedAccess(user);
  const shared = useMemo(() => (sharedDecks || [])
    .filter((d) => (user.grade ? (d.grade === user.grade || d.grade === ALL_GRADES) : !fGrade || d.grade === fGrade || d.grade === ALL_GRADES) && (!fSubject || d.subject === fSubject))
    .map((d) => ({ ...d, id: `s:${d.id}`, sid: d.id, shared: true, cards: (d.cards || []).map((c) => ({ ...c, box: boxes[c.id] || 0 })) }))
    .sort((a, b) => a.subject.localeCompare(b.subject) || b.createdAt - a.createdAt), [sharedDecks, user.grade, fGrade, fSubject, boxes]);
  const decks = useMemo(() => [...shared, ...(localDecks || [])], [shared, localDecks]);
  const canEdit = (d) => !d.shared || staff || (myUid && d.authorUid === myUid);
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
    addCards(picked);
    setProposals(null); setRawText("");
  }

  async function addDeck() {
    if (!newDeck.trim()) return;
    if (shareIt) {
      if (!newSubject || !newGrade) { notify({ kind: "error", text: "Pick a subject and grade so other students can find your deck." }); return; }
      await sessionPromise;
      const ref = db.collection("flashDecks").doc();
      notify({ kind: "info", sticky: true, text: "Setting up your deck for everyone…" });
      ref.set({ name: newDeck.trim(), subject: newSubject, grade: newGrade, cards: [], authorUid: auth.currentUser ? auth.currentUser.uid : null, authorRole: user.role, createdAt: Date.now() })
        .then(() => notify({ kind: "ok", text: "Deck is live for your grade." }))
        .catch((e) => notify({ kind: "error", text: friendlyDbError(e) }));
      setDeckId(`s:${ref.id}`); setNewDeck("");
      return;
    }
    const d = { id: uid(), name: newDeck.trim(), cards: [] };
    setDecks((prev) => [...(prev || []), d]); setDeckId(d.id); setNewDeck("");
  }
  async function addCards(list) {
    if (deck && deck.shared) {
      db.collection("flashDecks").doc(deck.sid).update({ cards: firebase.firestore.FieldValue.arrayUnion(...list.map(({ id, front, back }) => ({ id, front, back }))) })
        .then(() => notify({ kind: "ok", text: list.length > 1 ? "Cards added." : "Card added." }))
        .catch((e) => notify({ kind: "error", text: friendlyDbError(e) }));
    } else updateDeck((d) => ({ ...d, cards: [...d.cards, ...list] }));
  }
  async function removeCard(c) {
    if (deck.shared) {
      db.collection("flashDecks").doc(deck.sid).update({ cards: deck.cards.filter((x) => x.id !== c.id).map(({ id, front, back }) => ({ id, front, back })) })
        .catch((e) => notify({ kind: "error", text: friendlyDbError(e) }));
    } else updateDeck((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id) }));
  }
  async function removeDeck() {
    if (deck.shared) {
      if (!window.confirm(`Delete "${deck.name}" for everyone?`)) return;
      db.collection("flashDecks").doc(deck.sid).delete().catch((e) => notify({ kind: "error", text: friendlyDbError(e) }));
      setDeckId("");
    } else { setDecks((prev) => prev.filter((d) => d.id !== deck.id)); setDeckId(""); }
  }
  function updateDeck(fn) { setDecks((prev) => prev.map((d) => (d.id === deckId ? fn(d) : d))); }
  function addCard() {
    if (!front.trim() || !back.trim()) return;
    addCards([{ id: uid(), front: front.trim(), back: back.trim(), box: 0 }]);
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
    if (deck.shared) setBoxes((b) => ({ ...b, [id]: known ? Math.min((b[id] || 0) + 1, 4) : 0 }));
    else updateDeck((d) => ({ ...d, cards }));
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
        Study decks other students made for your grade and subject, or make your own and share it with everyone. Cards you get right show up less; cards you miss come back sooner. Use $...$ for maths. Your progress is saved on this device.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ width: 168 }}><SubjectSelect value={fSubject} onChange={setFSubject} includeAll /></div>
        {!user.grade && <div style={{ width: 150 }}><GradeSelect value={fGrade} onChange={setFGrade} includeAll /></div>}
        <select className="pp-select" aria-label="Deck" style={{ padding: "8px 10px", fontSize: 14, flex: 1, minWidth: 190 }} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          <option value="">{shared.length ? "Choose a deck…" : "No shared decks yet — make one below"}</option>
          {shared.length > 0 && <optgroup label={user.grade ? `Shared · ${gradeLabel(user.grade)}` : "Shared decks"}>
            {shared.map((d) => <option key={d.id} value={d.id}>{d.subject}{user.grade ? "" : ` · ${d.grade}`} — {d.name} ({d.cards.length})</option>)}
          </optgroup>}
          {(localDecks || []).length > 0 && <optgroup label="Private (this device only)">
            {localDecks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cards.length})</option>)}
          </optgroup>}
        </select>
      </div>
      <div className="pp-card" style={{ borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Make a new deck</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="pp-input" style={{ flex: 2, minWidth: 150, padding: "8px 10px", fontSize: 14 }} placeholder="Deck name, e.g. Cells and organelles" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addDeck(); }} />
          {shareIt && <div style={{ width: 160 }}><SubjectSelect value={newSubject} onChange={setNewSubject} /></div>}
          {shareIt && <div style={{ width: 150 }}><select className="pp-select" aria-label="Grade" style={{ padding: "9px 10px", fontSize: 14, width: "100%" }} value={newGrade} onChange={(e) => setNewGrade(e.target.value)}>
            <option value="" disabled>Grade…</option>
            <option value={ALL_GRADES}>All grades</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select></div>}
          <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: newDeck.trim() ? 1 : 0.5 }} disabled={!newDeck.trim()} onClick={addDeck}>Create deck</button>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
          <input type="checkbox" checked={shareIt} onChange={(e) => setShareIt(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Share with everyone in that grade and subject
        </label>
      </div>
      {deck && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button className="pp-btn pp-btn-primary" style={{ padding: "9px 20px", opacity: deck.cards.length ? 1 : 0.5 }} disabled={!deck.cards.length} onClick={startStudy}>Study this deck</button>
            {canEdit(deck) && <button className="pp-btn pp-btn-ghost" style={{ padding: "9px 14px", fontSize: 13 }} onClick={removeDeck}>Delete deck</button>}
            {deck.shared && <span style={{ fontSize: 12, color: "var(--muted)" }}>Shared deck · {deck.subject} · {deck.grade}</span>}
          </div>
          {canEdit(deck) && <><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
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
          </>}
          {deck.cards.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}><b><MathText text={c.front} /></b> — <MathText text={c.back} /></span>
              <GradeTag text={`Box ${c.box + 1}`} />
              {canEdit(deck) && <button className="pp-btn pp-btn-ghost" style={{ padding: 4, borderRadius: 999 }} onClick={() => removeCard(c)} aria-label="Delete card"><X size={12} /></button>}
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
      <div style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 180 }}>A day counts when you finish a flashcard round or a focus block. Stored on this device.</div>
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

const DEFAULT_GRADE_SETUP = { final: 50, ca: 30, nCA: 2, nP: 4 };
const MARK_TYPES = [{ id: "periodic", label: "Periodic" }, { id: "ca", label: "CA" }];

// Term grade = final (default 50%) + term exams (50%). Term exams = CAs (30%) + periodics (70%).
// One mark's worth = its category's share of the grade divided by how many of that category the term has
// (e.g. 4 periodics share 35%, so each is worth 8.75% of the whole grade).
// Marks you haven't entered yet are assumed to match the term average you started with.
function gradeSetup(s) {
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const final = n(s && s.final, 50, 0, 100), ca = n(s && s.ca, 30, 0, 100);
  return { final, ca, nCA: Math.round(n(s && s.nCA, 2, 1, 20)), nP: Math.round(n(s && s.nP, 4, 1, 20)) };
}
function markWorth(type, s) {
  const termW = 100 - s.final;
  return type === "ca" ? (termW * s.ca) / 100 / s.nCA : (termW * (100 - s.ca)) / 100 / s.nP;
}
function planResult(plan, s) {
  const termW = 100 - s.final;
  const X = Number(plan.avg);
  const marks = (plan.marks || []).map((m) => ({ ...m, pct: (m.score / m.max) * 100, worth: markWorth(m.type, s) }));
  const delta = marks.reduce((a, m) => a + (m.worth * (m.pct - X)) / 100, 0);
  const termPoints = (termW * X) / 100 + delta;
  const finalW = s.final / 100;
  return {
    marks,
    term: termW > 0 ? (termPoints / termW) * 100 : X,
    best: termPoints + s.final,
    worst: termPoints,
    need: finalW > 0 ? (Number(plan.target) - termPoints) / finalW : null
  };
}

function GradeTrackerCard() {
  const [plans, setPlans] = useLocalState("preplist:gradePlans", []);
  const [setupRaw, setSetupRaw] = useLocalState("preplist:gradeSetup", DEFAULT_GRADE_SETUP);
  const [subject, setSubject] = useState("");
  const [target, setTarget] = useState("90");
  const [avg, setAvg] = useState("");
  const s = gradeSetup(setupRaw);
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const canAdd = subject.trim() && avg !== "" && Number(avg) >= 0 && Number(avg) <= 100 && target !== "" && Number(target) > 0;
  function addPlan() {
    if (!canAdd) return;
    setPlans((prev) => [...(prev || []), { id: uid(), subject: subject.trim(), target: Number(target), avg: Number(avg), marks: [] }]);
    setSubject(""); setAvg("");
  }
  const setField = (key) => (e) => setSetupRaw({ ...setupRaw, [key]: e.target.value === "" ? "" : Number(e.target.value) });
  const numBox = { width: 62, padding: "6px 8px", fontSize: 13 };
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div className="pp-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Grade target planner</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
        Put in your target and your term average right now, then add each mark as it comes back. Every mark only counts for its share: the final is <b>{fmt(s.final)}%</b>, CAs <b>{fmt(markWorth("ca", s) * s.nCA)}%</b> (so <b>{fmt(markWorth("ca", s))}%</b> each), periodics <b>{fmt(markWorth("periodic", s) * s.nP)}%</b> (<b>{fmt(markWorth("periodic", s))}%</b> each). This is your own estimate, not an official grade.
      </div>
      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--muted)" }}>Change the weights and how many marks there are</summary>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 13, alignItems: "center" }}>
          <label>Final % <input className="pp-input" type="number" min="0" max="100" value={setupRaw.final} onChange={setField("final")} style={numBox} /></label>
          <label>CAs % of term exams <input className="pp-input" type="number" min="0" max="100" value={setupRaw.ca} onChange={setField("ca")} style={numBox} /></label>
          <label>CAs in the term <input className="pp-input" type="number" min="1" max="20" value={setupRaw.nCA} onChange={setField("nCA")} style={numBox} /></label>
          <label>Periodics in the term <input className="pp-input" type="number" min="1" max="20" value={setupRaw.nP} onChange={setField("nP")} style={numBox} /></label>
          <button className="pp-btn pp-btn-ghost" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => setSetupRaw(DEFAULT_GRADE_SETUP)}>Reset</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Set these to match your school: if you have 5 periodics a term, put 5 so each one is worth less.</div>
      </details>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <label style={{ fontSize: 11.5, color: "var(--muted)" }}>Subject<br />
          <input className="pp-input" list="pp-grade-subjects" style={{ width: 130, padding: "8px 10px", fontSize: 14 }} placeholder="e.g. Math" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <datalist id="pp-grade-subjects">{PAPER_SUBJECTS.map((x) => <option key={x} value={x} />)}</datalist>
        <label style={{ fontSize: 11.5, color: "var(--muted)" }}>Target grade %<br />
          <input className="pp-input" type="number" style={{ width: 90, padding: "8px 10px", fontSize: 14 }} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label style={{ fontSize: 11.5, color: "var(--muted)" }}>Term average now %<br />
          <input className="pp-input" type="number" style={{ width: 110, padding: "8px 10px", fontSize: 14 }} placeholder="e.g. 78" value={avg} onChange={(e) => setAvg(e.target.value)} />
        </label>
        <button className="pp-btn pp-btn-primary" style={{ padding: "8px 16px", opacity: canAdd ? 1 : 0.5 }} disabled={!canAdd} onClick={addPlan}>Add subject</button>
      </div>
      {plans.length === 0 ? <div style={{ fontSize: 13, color: "var(--muted)" }}>No subjects yet. Add one above.</div> : plans.map((pl) => <PlanCard key={pl.id} plan={pl} setup={s} fmt={fmt} onPatch={(fn) => setPlans((prev) => prev.map((p) => (p.id === pl.id ? fn(p) : p)))} onRemove={() => setPlans((prev) => prev.filter((p) => p.id !== pl.id))} />)}
    </div>
  );
}

function PlanCard({ plan, setup, fmt, onPatch, onRemove }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("periodic");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("100");
  const r = planResult(plan, setup);
  const canAdd = name.trim() && score !== "" && Number(max) > 0;
  function addMark() {
    if (!canAdd) return;
    onPatch((p) => ({ ...p, marks: [...(p.marks || []), { id: uid(), name: name.trim(), type, score: Number(score), max: Number(max) }] }));
    setName(""); setScore("");
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  let verdict, tone;
  if (r.need === null) { verdict = r.term >= plan.target ? "Your term average is already at your target." : "With no final, your target isn't reachable."; tone = r.term >= plan.target ? "ok" : "bad"; }
  else if (r.need <= 0) { verdict = `You've already secured ${plan.target}%. Even a 0% final would keep you there.`; tone = "ok"; }
  else if (r.need > 100) { verdict = `Out of reach. Even a perfect final gives you about ${r1(r.best)}%.`; tone = "bad"; }
  else if (r.need >= 90) { verdict = `Possible, but tough: you'd need about ${Math.ceil(r.need)}% on the final.`; tone = "warn"; }
  else { verdict = `Possible: you'd need about ${Math.ceil(r.need)}% on the final.`; tone = "ok"; }
  const color = tone === "ok" ? "var(--sage-ink)" : tone === "warn" ? "#8A6A12" : "#8A3434";
  const count = (ty) => r.marks.filter((m) => m.type === ty).length;
  const tooMany = count("periodic") > setup.nP ? "periodics" : count("ca") > setup.nCA ? "CAs" : null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 15 }}>{plan.subject}</b>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Target {plan.target}% · started at {plan.avg}% · term average now</span>
        <span className="pp-serif" style={{ fontSize: 20, fontWeight: 700 }}>{r1(r.term)}%</span>
        <button className="pp-btn pp-btn-ghost" style={{ padding: 4, borderRadius: 999, marginLeft: "auto" }} onClick={() => { if (window.confirm(`Remove ${plan.subject}?`)) onRemove(); }} aria-label={`Remove ${plan.subject}`}><X size={13} /></button>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color, margin: "6px 0" }}>{verdict}</div>
      {r.need !== null && r.need > 0 && r.need <= 100 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Best case with a 100% final: {r1(r.best)}% · worst case with a 0% final: {r1(r.worst)}%.</div>}
      {tooMany && <div style={{ fontSize: 12, color: "#8A6A12", marginBottom: 6 }}>You've added more {tooMany} than the term has. Check the numbers under "Change the weights".</div>}
      {r.marks.map((m) => {
        const effect = (m.worth * (m.pct - Number(plan.avg))) / 100;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "2px 0", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 120 }}>{m.name} <span style={{ color: "var(--muted)" }}>· {m.type === "ca" ? "CA" : "Periodic"}, worth {fmt(m.worth)}% of your grade</span></span>
            <span>{m.score}/{m.max} ({Math.round(m.pct)}%)</span>
            <span style={{ color: effect >= 0 ? "#2F6B3F" : "#8A3434", minWidth: 52, textAlign: "right" }}>{effect >= 0 ? "+" : ""}{fmt(effect)}%</span>
            <button className="pp-btn pp-btn-ghost" style={{ padding: 4, borderRadius: 999 }} onClick={() => onPatch((p) => ({ ...p, marks: p.marks.filter((x) => x.id !== m.id) }))} aria-label="Remove mark"><X size={12} /></button>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <select className="pp-select" aria-label="Type of mark" style={{ padding: "7px 10px", fontSize: 13.5 }} value={type} onChange={(e) => setType(e.target.value)}>
          {MARK_TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <input className="pp-input" style={{ flex: 1, minWidth: 120, padding: "7px 10px", fontSize: 13.5 }} placeholder="New mark, e.g. Periodic 3" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="pp-input" type="number" aria-label="Score" style={{ width: 70, padding: "7px 10px", fontSize: 13.5 }} placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
        <input className="pp-input" type="number" aria-label="Out of" style={{ width: 70, padding: "7px 10px", fontSize: 13.5 }} placeholder="Out of" value={max} onChange={(e) => setMax(e.target.value)} />
        <button className="pp-btn pp-btn-ghost" style={{ padding: "7px 14px", fontSize: 13, opacity: canAdd ? 1 : 0.5 }} disabled={!canAdd} onClick={addMark}>Add mark</button>
      </div>
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
          Always check College Board for the latest format and test dates.
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

function GlobalSearchModal({ notes, videos, files, onClose, onJump }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const noteMatches = s ? notes.filter((n) => n.title.toLowerCase().includes(s) || n.subject.toLowerCase().includes(s)) : [];
  const videoMatches = s ? videos.filter((v) => v.title.toLowerCase().includes(s) || v.subject.toLowerCase().includes(s)) : [];
  const fileMatches = s ? files.filter((f) => (f.title || "").toLowerCase().includes(s) || (f.fileName || "").toLowerCase().includes(s) || (f.subject || "").toLowerCase().includes(s)) : [];
  const totalMatches = noteMatches.length + videoMatches.length + fileMatches.length;

  function pick(tabId, elId) { onJump(tabId, elId); onClose(); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 70, padding: "10vh 16px 16px" }} onClick={onClose}>
      <div className="pp-card pp-pop" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "75vh", overflowY: "auto", borderRadius: 14, padding: 18 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input autoFocus className="pp-input" style={{ width: "100%", padding: "10px 12px 10px 34px", fontSize: 15 }} placeholder="Search notes, videos and files…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {s && (
          <div style={{ marginTop: 14 }}>
            {totalMatches === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 2px" }}>No matches for "{q}".</div>
            ) : (
              <>
                <SearchResultGroup label="Notes" icon={BookOpen} items={noteMatches} onPick={(n) => pick("notes", `note-${n.id}`)} />
                <SearchResultGroup label="Videos" icon={VideoIcon} items={videoMatches} onPick={(v) => pick("videos", `video-${v.id}`)} />
                <SearchResultGroup label="Files" icon={Folder} items={fileMatches} onPick={(f) => pick("files", `file-${f.id}`)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackCard({ isAdmin, feedback }) {
  const notify = useToast();
  const [deviceId, setDeviceId] = useLocalState("preplist:deviceId", null);
  const [saved, setSaved] = useLocalState("preplist:myFeedback", null);
  const [rating, setRating] = useState((saved && saved.rating) || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState((saved && saved.comment) || "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    try {
      let id = deviceId;
      if (!id) { id = uid(); setDeviceId(id); }
      await db.collection("feedback").doc(id).set({ rating, comment: comment.trim().slice(0, 300), updatedAt: Date.now() });
      setSaved({ rating, comment: comment.trim() });
      notify({ kind: "ok", text: "Thank you for your feedback!" });
    } catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
    setBusy(false);
  }
  const shown = hover || rating;
  const avg = feedback && feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : 0;
  return (
    <div className="pp-card" style={{ borderRadius: 10, padding: 20, maxWidth: 560, marginTop: 16 }}>
      <div className="pp-serif" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Rate PrepList Pro</div>
      <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 10 }}>How are we doing? Tap a star out of 5.</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }} role="radiogroup" aria-label="Rating out of 5 stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="pp-btn pp-btn-ghost"
            style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent" }}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}>
            <Star size={30} fill={n <= shown ? "#E2A92B" : "none"} style={{ color: n <= shown ? "#E2A92B" : "var(--muted)" }} />
          </button>
        ))}
      </div>
      <textarea className="pp-input" maxLength={300} style={{ width: "100%", padding: "9px 12px", fontSize: 14, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
        placeholder="Anything we should improve? (optional — please don't include personal details)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="pp-btn pp-btn-primary" style={{ marginTop: 10, padding: "9px 20px", opacity: rating && !busy ? 1 : 0.5 }} disabled={!rating || busy} onClick={submit}>{saved ? "Update my feedback" : "Send feedback"}</button>
      {isAdmin && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Admin view: {feedback && feedback.length ? `${avg.toFixed(1)} / 5 from ${feedback.length} rating${feedback.length === 1 ? "" : "s"}` : "no ratings yet"}</div>
          {(feedback || []).filter((f) => f.comment).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10).map((f) => (
            <div key={f.id} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--border)" }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)} — {f.comment} <span style={{ color: "var(--muted)", fontSize: 11.5 }}>· {timeAgo(f.updatedAt)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactView({ isAdmin, feedback }) {
  const notify = useToast();
  const email = "preplistpro@gmail.com";
  function copy() {
    const done = () => notify({ kind: "ok", text: "Email address copied." });
    const fail = () => notify({ kind: "error", text: "Couldn't copy — please copy it by hand." });
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(done, fail);
    else fail();
  }
  return (
    <div>
    <div className="pp-card" style={{ borderRadius: 10, padding: 20, maxWidth: 560 }}>
      <div className="pp-serif" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Contact us</div>
      <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
        Found a bug? Have an idea for a feature? Want to help write notes or make videos? Email us — we read every message.
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a className="pp-btn pp-btn-primary" href={`mailto:${email}`} style={{ padding: "10px 18px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}><Mail size={15} /> {email}</a>
        <button className="pp-btn pp-btn-ghost" style={{ padding: "10px 16px", fontSize: 13.5 }} onClick={copy}>Copy email</button>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 16 }}>PrepList Pro is an independent student project and is not affiliated with or endorsed by any school or organisation.</div>
    </div>
    <FeedbackCard isAdmin={isAdmin} feedback={feedback} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* App shell                                                              */
/* ---------------------------------------------------------------------- */

const TABS = [
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "videos", label: "Videos", icon: VideoIcon },
  { id: "files", label: "Files", icon: Folder },
  { id: "papers", label: "Past Papers", icon: FileText },
  { id: "flashcards", label: "Flashcards", icon: Star },
  { id: "tools", label: "Tracker", icon: Clock },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "contact", label: "Contact", icon: Mail }
];

function MainApp({ user, onChangeGrade, onSwitchRole, theme, setTheme }) {
  // Only subscribe to a collection once a tab that needs it is opened — keeps
  // the number of database reads per visitor (and the free-plan quota) low.
  const [wanted, setWanted] = useState(() => new Set(["notes"]));
  const want = useCallback((...names) => setWanted((prev) => (names.every((n) => prev.has(n)) ? prev : new Set([...prev, ...names]))), []);
  const [notes, notesReady] = useCollection("notes", undefined, wanted.has("notes"));
  const [videos, videosReady] = useCollection("videos", undefined, wanted.has("videos"));
  const [libraryFiles, libraryFilesReady] = useCollection("libraryFiles", undefined, wanted.has("files"));
  const [feedbackList] = useCollection("feedback", undefined, wanted.has("feedback"));
  const [flashDecks, flashDecksReady] = useCollection("flashDecks", undefined, wanted.has("flashcards"));

  const [tab, setTab] = useState("notes");
  const [showSearch, setShowSearch] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const notesShown = useMemo(() => (user.grade ? notes.filter((n) => n.grade === user.grade) : notes), [notes, user.grade]);
  const videosShown = useMemo(() => (user.grade ? videos.filter((v) => v.grade === user.grade) : videos), [videos, user.grade]);
  const TAB_NEEDS = { notes: ["notes"], videos: ["videos"], files: ["files"], papers: [], saved: ["notes", "videos", "files"], tools: [], flashcards: ["flashcards"], contact: [] };
  useEffect(() => { want(...(TAB_NEEDS[tab] || [])); if (tab === "contact" && user.role === "admin") want("feedback"); }, [tab, want]);
  useEffect(() => { if (showSearch) want("notes", "videos", "files"); }, [showSearch, want]);
  const [toast, setToast] = useState(null);
  const notify = useCallback((t) => setToast(t), []);
  // Shows a gentle "working on it" message that turns into a result when the write lands.
  const track = useCallback((promise, working, done) => {
    notify({ kind: "info", sticky: true, text: working });
    return Promise.resolve(promise).then(() => notify({ kind: "ok", text: done })).catch((e) => notify({ kind: "error", text: friendlyDbError(e) }));
  }, [notify]);
  useEffect(() => {
    if (!toast || toast.sticky) return;
    const t = setTimeout(() => setToast(null), toast.action ? 10000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const [lastNoteId, setLastNoteId] = useLocalState("preplist:lastNote", null);
  const [lastVideoId, setLastVideoId] = useLocalState("preplist:lastVideo", null);
  const [lastFileId, setLastFileId] = useLocalState("preplist:lastFile", null);
  const [savedNoteIds, setSavedNoteIds] = useLocalState("preplist:savedNotes", []);
  const [savedVideoIds, setSavedVideoIds] = useLocalState("preplist:savedVideos", []);
  const [savedFileIds, setSavedFileIds] = useLocalState("preplist:savedFiles", []);
  const toggleSaved = (setList) => (id) => setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const onToggleSavedNote = useCallback(toggleSaved(setSavedNoteIds), [setSavedNoteIds]);
  const onToggleSavedVideo = useCallback(toggleSaved(setSavedVideoIds), [setSavedVideoIds]);
  const onToggleSavedFile = useCallback(toggleSaved(setSavedFileIds), [setSavedFileIds]);

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

  async function addNote(payload, onProgress) {
    try {
      let doc = { ...payload };
      if (payload.type === "image") {
        let done = 0;
        const total = payload.content.length;
        const [fileIds, thumb] = await Promise.all([Promise.all(payload.content.map((d) => saveFile(d).then((id) => { done++; if (onProgress) onProgress(done, total); return id; }))), makeThumb(payload.content[0])]);
        doc = { ...payload, fileId: fileIds[0], fileIds }; delete doc.content;
        if (thumb) doc.thumb = thumb;
      }
      const uploads = pendingUploads.splice(0);
      track(Promise.all([...uploads, db.collection("notes").add({ ...doc, authorRole: user.role, createdAt: Date.now() })]),
        "Sending your note out… it's already on your screen, just keep this tab open a little longer.", "Note published.");
      return true;
    }
    catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function updateItem(coll, id, patch) {
    track(db.collection(coll).doc(id).update(patch), "Saving your changes…", "Changes saved.");
    return true;
  }
  async function editNote(note, v) {
    try {
      const patch = { title: v.title, subject: v.subject, grade: v.grade, description: v.description };
      let removedIds = [];
      if (note.type === "text") patch.content = v.text;
      else {
        const keptIds = [];
        for (const x of v.existing) keptIds.push(x.id || await saveFile(x.inline));
        const newIds = await Promise.all(v.added.map((d) => saveFile(d)));
        const finalIds = [...keptIds, ...newIds];
        if (!finalIds.length) { notify({ kind: "error", text: "A photo note needs at least one photo." }); return false; }
        patch.fileIds = finalIds; patch.fileId = finalIds[0];
        if (note.content) patch.content = firebase.firestore.FieldValue.delete();
        const oldIds = noteFileIds(note);
        removedIds = oldIds.filter((id) => !finalIds.includes(id));
        if (finalIds[0] !== oldIds[0] || !note.thumb) {
          const firstSrc = (v.existing[0] && v.existing[0].inline) || fileCache.get(finalIds[0]) || (!v.existing.length ? v.added[0] : null);
          const thumb = firstSrc ? await makeThumb(firstSrc) : null;
          if (thumb) patch.thumb = thumb;
        }
      }
      await db.collection("notes").doc(note.id).update(patch);
      removedIds.forEach((id) => { fileCache.delete(id); db.collection("files").doc(id).delete().catch(() => {}); });
      notify({ kind: "ok", text: "Changes saved." });
      return true;
    } catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); return false; }
  }
  async function addVideo(payload) {
    track(db.collection("videos").add({ ...payload, addedByRole: user.role, createdAt: Date.now() }), "Adding your video, almost there…", "Video added.");
    return true;
  }
  async function addLibraryFile(payload, onProgress) {
    let fileId = null;
    let chunkCount = 0;
    const writtenIndexes = [];
    try {
      const file = payload.file;
      if (!file) return false;
      if (!file.size) { notify({ kind: "error", text: "That file is empty — pick another one." }); return false; }
      if (file.size > MAX_LIBRARY_FILE_BYTES) {
        notify({ kind: "error", text: `That file is too large — the limit is ${formatBytes(MAX_LIBRARY_FILE_BYTES)}.` });
        return false;
      }
      const ref = db.collection("libraryFiles").doc();
      fileId = ref.id;
      chunkCount = Math.max(1, Math.ceil(file.size / LIBRARY_CHUNK_BYTES));
      for (let start = 0; start < chunkCount; start += 6) {
        const end = Math.min(start + 6, chunkCount);
        const batch = db.batch();
        for (let i = start; i < end; i++) {
          const from = i * LIBRARY_CHUNK_BYTES;
          const chunk = file.slice(from, Math.min(from + LIBRARY_CHUNK_BYTES, file.size));
          const data = await readBlobChunkBase64(chunk);
          batch.set(db.collection("libraryFileChunks").doc(libraryChunkId(fileId, i)), { fileId, index: i, data, createdAt: Date.now() });
          writtenIndexes.push(i);
        }
        await batch.commit();
        if (onProgress) onProgress(Math.round((end / chunkCount) * 100));
      }
      await ref.set({
        title: payload.title,
        subject: payload.subject,
        grade: payload.grade,
        description: payload.description || "",
        fileName: file.name,
        mimeType: guessMimeType(file),
        size: file.size,
        chunkCount,
        addedByRole: user.role,
        createdAt: Date.now()
      });
      notify({ kind: "ok", text: "File uploaded." });
      return true;
    } catch (e) {
      if (fileId) {
        try {
          for (let i = 0; i < writtenIndexes.length; i += 400) {
            const batch = db.batch();
            writtenIndexes.slice(i, i + 400).forEach((idx) => batch.delete(db.collection("libraryFileChunks").doc(libraryChunkId(fileId, idx))));
            await batch.commit().catch(() => {});
          }
        } catch { /* best-effort cleanup */ }
      }
      notify({ kind: "error", text: friendlyDbError(e) });
      return false;
    }
  }
  async function downloadLibraryFile(file) {
    try {
      const blob = await fetchLibraryFileBlob(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      notify({ kind: "error", text: "Couldn't download that file — check your connection and try again." });
    }
  }
  async function deleteLibraryFile(file) {
    try {
      const { id, ...data } = file;
      await db.collection("libraryFiles").doc(id).delete();
      const chunkCount = Math.min(100, Math.max(1, Number(file.chunkCount) || 1));
      function purgeChunks() {
        libraryBlobCache.delete(id);
        for (let i = 0; i < chunkCount; i += 400) {
          const batch = db.batch();
          for (let j = i; j < Math.min(i + 400, chunkCount); j++) batch.delete(db.collection("libraryFileChunks").doc(libraryChunkId(id, j)));
          batch.commit().catch(() => {});
        }
      }
      const timer = setTimeout(purgeChunks, 12000);
      notify({
        kind: "ok", text: `Deleted "${file.title}".`,
        action: {
          label: "Undo",
          onClick: async () => {
            clearTimeout(timer);
            try {
              await db.collection("libraryFiles").doc(id).set(data);
              notify({ kind: "ok", text: `Restored "${file.title}".` });
            } catch (e) {
              purgeChunks();
              notify({ kind: "error", text: friendlyDbError(e) });
            }
          }
        }
      });
    } catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
  }
  // Deletes documents but keeps a copy for ~10 seconds so "Undo" can put them back.
  async function deleteWithUndo(coll, items, label, fileIds = []) {
    if (!items.length) return;
    try {
      for (let i = 0; i < items.length; i += 400) {
        const batch = db.batch();
        items.slice(i, i + 400).forEach((it) => batch.delete(db.collection(coll).doc(it.id)));
        await batch.commit();
      }
      const timer = setTimeout(() => fileIds.forEach((fid) => db.collection("files").doc(fid).delete().catch(() => {})), 12000);
      notify({
        kind: "ok", text: `Deleted ${label}.`,
        action: {
          label: "Undo",
          onClick: async () => {
            clearTimeout(timer);
            try {
              for (let i = 0; i < items.length; i += 400) {
                const batch = db.batch();
                items.slice(i, i + 400).forEach((it) => { const { id, ...data } = it; batch.set(db.collection(coll).doc(id), data); });
                await batch.commit();
              }
              notify({ kind: "ok", text: `Restored ${label}.` });
            } catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
          }
        }
      });
    } catch (e) { notify({ kind: "error", text: friendlyDbError(e) }); }
  }
  const deleteNote = (n) => deleteWithUndo("notes", [n], `"${n.title}"`, noteFileIds(n));
  const deleteVideo = (v) => deleteWithUndo("videos", [v], `"${v.title}"`);

  const READY = { notes: notesReady, videos: videosReady, files: libraryFilesReady, flashcards: flashDecksReady };
  const dataReady = (TAB_NEEDS[tab] || []).every((n) => READY[n]);

  return (
    <ToastContext.Provider value={notify}>
      <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}>
        <GlobalStyle />
        <header style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "color-mix(in srgb, var(--bg) 82%, transparent)", backdropFilter: "saturate(1.4) blur(14px)", WebkitBackdropFilter: "saturate(1.4) blur(14px)", zIndex: 40 }}>
          <div className="pp-header-row" style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div className="pp-serif pp-header-title" style={{ fontSize: 19, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><BookLogo size={26} /> PrepList Pro</div>
            <div style={{ flex: 1 }} />
            <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999 }} onClick={() => setShowSearch(true)} aria-label="Search everything"><Search size={16} /></button>
            <button className="pp-btn pp-btn-ghost" style={{ padding: 8, borderRadius: 999 }} onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
            {user.grade && <button className="pp-btn pp-btn-ghost" style={{ padding: "6px 11px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }} onClick={() => setShowGrade(true)} title="Change your grade" aria-label={`${gradeLabel(user.grade)}. Change grade`}>{gradeLabel(user.grade)} ▾</button>}
            <button className="pp-btn pp-btn-ghost pp-role-pill" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 5px" }} onClick={onSwitchRole} title="Switch role">
              <RoleBadge role={user.role} size={26} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{roleLabel(user.role)}</span>
              <LogOut size={13} style={{ color: "var(--muted)" }} />
            </button>
          </div>
          <nav className="pp-scrollbar" style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 12px", display: "flex", gap: 20, overflowX: "auto" }}>
            {TABS.map((t) => (
              <div key={t.id} className={`pp-tab ${tab === t.id ? "active" : ""}`} style={{ padding: "10px 2px", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setTab(t.id)}>
                <t.icon size={14} /> {t.label}
              </div>
            ))}
          </nav>
        </header>

        <main style={{ maxWidth: 1040, margin: "0 auto", padding: "26px 20px 90px" }}>
          {!dataReady ? <Loading label="Loading…" /> : (
            <>
              {tab === "notes" && <NotesView notes={notesShown} user={user} onAddNote={addNote} onDeleteNote={deleteNote} onEditNote={editNote} lastNoteId={lastNoteId} setLastNoteId={setLastNoteId} savedNoteIds={savedNoteIds} onToggleSavedNote={onToggleSavedNote} />}
              {tab === "videos" && <VideosView videos={videosShown} user={user} onAddVideo={addVideo} onDeleteVideo={deleteVideo} onEditVideo={(v, patch) => updateItem("videos", v.id, patch)} lastVideoId={lastVideoId} setLastVideoId={setLastVideoId} savedVideoIds={savedVideoIds} onToggleSavedVideo={onToggleSavedVideo} />}
              {tab === "files" && <FilesView files={libraryFiles} user={user} onAddFile={addLibraryFile} onDeleteFile={deleteLibraryFile} onEditFile={(f, patch) => updateItem("libraryFiles", f.id, patch)} onDownloadFile={downloadLibraryFile} lastFileId={lastFileId} setLastFileId={setLastFileId} savedFileIds={savedFileIds} onToggleSavedFile={onToggleSavedFile} />}
              {tab === "papers" && <PastPapersView />}
              {tab === "tools" && <ToolsView />}
              {tab === "flashcards" && <FlashcardsView sharedDecks={flashDecks} user={user} notify={notify} />}
              {tab === "contact" && <ContactView isAdmin={user.role === "admin"} feedback={feedbackList} />}
              {tab === "saved" && <SavedView notes={notes} videos={videos} files={libraryFiles}
                lastNoteId={lastNoteId} lastVideoId={lastVideoId} lastFileId={lastFileId}
                savedNoteIds={savedNoteIds} savedVideoIds={savedVideoIds} savedFileIds={savedFileIds}
                onToggleSavedNote={onToggleSavedNote} onToggleSavedVideo={onToggleSavedVideo} onToggleSavedFile={onToggleSavedFile}
                onJump={jumpTo} />}
            </>
          )}
        </main>

        {showGrade && <Modal title="Change your grade" onClose={() => setShowGrade(false)}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Notes and videos will switch to the grade you pick. This is saved on this device.</div>
          <GradeButtons value={user.grade} onPick={(g) => { onChangeGrade(g); setShowGrade(false); }} />
        </Modal>}
        {showSearch && <GlobalSearchModal notes={notesShown} videos={videosShown} files={libraryFiles} onClose={() => setShowSearch(false)} onJump={jumpTo} />}
        {window.__ppVersion && <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", padding: "0 0 18px" }}>PrepList Pro · updated {window.__ppVersion}</div>}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </ToastContext.Provider>
  );
}

function PreplistProRoot() {
  const [theme, setTheme] = useLocalState("preplist:theme", "light");
  useEffect(() => { document.documentElement.style.background = document.body.style.background = theme === "dark" ? "#17181B" : "#F5F3E6"; }, [theme]);
  const [role, setRole] = useLocalState("preplist:role2", null);
  const [myGrade, setMyGrade] = useLocalState("preplist:myGrade", null);
  const sessionReady = useAnonymousSession();

  if (!FIREBASE_READY) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><SetupNeededScreen /></div>;
  if (!role) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><RoleGate onSelectRole={setRole} theme={theme} setTheme={setTheme} /></div>;

  if (role === "student" && !GRADE_CHOICES.some((g) => g.value === myGrade)) return <div className="pp-root" data-theme={theme} style={{ minHeight: "100dvh" }}><GlobalStyle /><GradeGate onPick={setMyGrade} onBack={() => setRole(null)} theme={theme} setTheme={setTheme} /></div>;

  return <MainApp user={{ role, grade: role === "student" ? myGrade : null }} onChangeGrade={setMyGrade} onSwitchRole={() => setRole(null)} theme={theme} setTheme={setTheme} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<PreplistProRoot />);