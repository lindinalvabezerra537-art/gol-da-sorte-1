import { useState, useRef, useCallback, useEffect } from "react";

const PIRATA_W = 694;
const PIRATA_H = 1280;
const PIRATA_RATIO = PIRATA_W / PIRATA_H;

const N_TILES = 81;
const INITIAL_PATH: { x: number; y: number }[] = Array.from({ length: N_TILES }, (_, i) => ({
  x: 0.02 + (i / (N_TILES - 1)) * 0.96,
  y: 0.5,
}));

type Point = { x: number; y: number; label?: number };
type Bounds = { x: number; y: number; w: number; h: number };

function calcBounds(vw: number, vh: number): Bounds {
  if (!vw || !vh) return { x: 0, y: 0, w: 300, h: 500 };
  const conRatio = vw / vh;
  let w: number, h: number, x: number, y: number;
  if (conRatio > PIRATA_RATIO) {
    h = vh; w = h * PIRATA_RATIO; x = (vw - w) / 2; y = 0;
  } else {
    w = vw; h = w / PIRATA_RATIO; x = 0; y = (vh - h) / 2;
  }
  return { x, y, w, h };
}

function extendPath(path: Point[]): Point[] {
  if (path.length >= N_TILES) return path.slice(0, N_TILES);
  const last = path[path.length - 1] ?? { x: 0.5, y: 0.5 };
  const extra = Array.from({ length: N_TILES - path.length }, (_, i) => ({
    x: Math.min(1, last.x + (i + 1) * 0.015),
    y: last.y,
  }));
  return [...path, ...extra];
}

const LS_KEY = "boardEditorPath";
const LS_VER = "v1";

function savePathLocally(path: Point[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(path));
    localStorage.setItem(LS_KEY + "Version", "v3");
  } catch {}
}

function loadPathLocally(): Point[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Current format: raw array + separate version key
    if (Array.isArray(data) && data.length > 0) {
      const ver = localStorage.getItem(LS_KEY + "Version");
      if (ver === "v3") return extendPath(data);
    }
    // Legacy format: { ver: "v1", path: [...] }
    if (data?.ver === LS_VER && Array.isArray(data.path) && data.path.length > 0)
      return extendPath(data.path);
    return null;
  } catch { return null; }
}

async function loadPathFromServer(): Promise<Point[] | null> {
  try {
    const res = await fetch("/api/settings/pirate-path");
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data?.path) && data.path.length > 0) return extendPath(data.path);
    return null;
  } catch { return null; }
}

async function savePathToServer(path: Point[]): Promise<void> {
  try {
    await fetch("/api/settings/pirate-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  } catch {}
}

export default function BoardEditor({ onClose }: { onClose: (finalPath: Point[]) => void }) {
  const [path, setPath] = useState<Point[]>(INITIAL_PATH.map(p => ({ ...p })));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const draggingRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [bounds, setBounds] = useState<Bounds>(() => calcBounds(window.innerWidth, window.innerHeight));
  const pathRef = useRef<Point[]>(path);
  pathRef.current = path;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    setBounds(calcBounds(window.innerWidth, window.innerHeight));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    loadPathFromServer().then(serverPath => {
      if (serverPath) {
        setPath(serverPath);
        savePathLocally(serverPath);
      } else {
        const local = loadPathLocally();
        if (local) setPath(local);
      }
      setLoaded(true);
    });
  }, []);

  const scheduleSave = useCallback((newPath: Point[]) => {
    savePathLocally(newPath);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      await savePathToServer(newPath);
      setSaving(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    }, 800);
  }, []);

  const clientToNorm = useCallback((clientX: number, clientY: number): Point | null => {
    const b = calcBounds(window.innerWidth, window.innerHeight);
    const nx = (clientX - b.x) / b.w;
    const ny = (clientY - b.y) / b.h;
    return { x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) };
  }, []);

  const handleDelete = useCallback((i: number) => {
    const next = pathRef.current.filter((_, idx) => idx !== i);
    setPath(next);
    scheduleSave(next);
  }, [scheduleSave]);

  const handleMouseDown = useCallback((e: React.MouseEvent, i: number) => {
    e.preventDefault(); e.stopPropagation();
    if (deleteMode) { handleDelete(i); return; }
    draggingRef.current = i; setDragging(i);
  }, [deleteMode, handleDelete]);

  const handleTouchStart = useCallback((e: React.TouchEvent, i: number) => {
    e.preventDefault(); e.stopPropagation();
    if (deleteMode) { handleDelete(i); return; }
    draggingRef.current = i; setDragging(i);
  }, [deleteMode, handleDelete]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const idx = draggingRef.current;
    if (idx === null) return;
    const norm = clientToNorm(e.clientX, e.clientY);
    if (!norm) return;
    const next = [...pathRef.current];
    next[idx] = norm;
    setPath(next);
    scheduleSave(next);
  }, [clientToNorm, scheduleSave]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const idx = draggingRef.current;
    if (idx === null || !e.touches[0]) return;
    e.preventDefault();
    const norm = clientToNorm(e.touches[0].clientX, e.touches[0].clientY);
    if (!norm) return;
    const next = [...pathRef.current];
    next[idx] = norm;
    setPath(next);
    scheduleSave(next);
  }, [clientToNorm, scheduleSave]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null; setDragging(null);
  }, []);

  const generateCode = () =>
    `const PIRATE_PATH: { x: number; y: number }[] = [\n` +
    path.map((p, i) => {
      const tag = i === 0 ? " // 0 — INÍCIO" : i === path.length - 1 ? ` // ${i} — TOP VIRAL 👑` : ` // ${i}`;
      return `  { x: ${p.x.toFixed(3)}, y: ${p.y.toFixed(3)} },${tag}`;
    }).join("\n") + `\n];`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generateCode()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    if (confirm("Resetar para as coordenadas originais?")) {
      const reset = INITIAL_PATH.map(p => ({ ...p }));
      setPath(reset);
      draggingRef.current = null; setDragging(null);
      scheduleSave(reset);
    }
  };

  const handleAlignHorizontal = () => {
    const n = path.length;
    const aligned = path.map((_, i) => ({
      x: 0.02 + (i / (n - 1)) * 0.96,
      y: 0.5,
    }));
    setPath(aligned);
    scheduleSave(aligned);
  };

  const handleSaveNow = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    savePathLocally(pathRef.current);
    await savePathToServer(pathRef.current);
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  const tileW = Math.max(bounds.w * 0.090, 33);
  const tileH = Math.max(bounds.w * 0.070, 25);

  // Width of the left side panel (in the black area) — leave 8px gap
  const leftMargin = Math.max(0, bounds.x);
  const sidePanelWidth = leftMargin > 56 ? leftMargin - 8 : 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        cursor: dragging !== null ? "grabbing" : "default",
        userSelect: "none", touchAction: "none",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Board image centered */}
      <img
        src="/pirata.jpg"
        alt="Tabuleiro"
        draggable={false}
        style={{
          position: "absolute",
          left: bounds.x, top: bounds.y,
          width: bounds.w, height: bounds.h,
          objectFit: "fill",
          pointerEvents: "none", userSelect: "none",
          opacity: loaded ? 1 : 0.5,
        }}
      />

      {/* Draggable tiles */}
      {path.map((pos, i) => {
        const isStart = i === 0;
        const isEnd = i === path.length - 1;
        const isDrag = dragging === i;
        const cx = bounds.x + pos.x * bounds.w;
        const cy = bounds.y + pos.y * bounds.h;
        return (
          <div
            key={i}
            onMouseDown={e => handleMouseDown(e, i)}
            onTouchStart={e => handleTouchStart(e, i)}
            style={{
              position: "absolute",
              left: cx - tileW / 2, top: cy - tileH / 2,
              width: tileW, height: tileH,
              borderRadius: tileH * 0.28,
              border: deleteMode ? "2.5px solid #f44"
                : isDrag  ? "2.5px solid #0ff"
                : isStart ? "2.5px solid rgba(80,255,80,0.95)"
                : isEnd   ? "2.5px solid rgba(255,215,0,1)"
                :           "2px solid rgba(255,215,0,0.75)",
              background: deleteMode ? "rgba(100,0,0,0.90)"
                : isDrag  ? "rgba(0,90,140,0.97)"
                : isStart ? "rgba(0,70,10,0.93)"
                : isEnd   ? "rgba(100,68,0,0.96)"
                :           "rgba(12,10,30,0.92)",
              boxShadow: deleteMode ? "0 0 8px 3px rgba(255,60,60,0.50)"
                : isDrag  ? "0 0 0 5px rgba(0,255,255,0.5), 0 2px 10px #000"
                : isEnd   ? "0 0 12px 4px rgba(255,200,0,0.60)"
                : isStart ? "0 0 8px 2px rgba(60,255,60,0.50)"
                :           "0 1px 4px rgba(0,0,0,0.7)",
              cursor: deleteMode ? "pointer" : "grab",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: isDrag ? 30 : 10, touchAction: "none",
            }}
          >
            <span style={{
              fontSize: Math.max(tileH * 0.40, 9),
              color: isDrag ? "#0ff" : isStart ? "#90ffA0" : isEnd ? "#FFD700" : "rgba(255,215,0,0.9)",
              fontWeight: 900, textShadow: "0 1px 3px #000",
              lineHeight: 1, userSelect: "none", pointerEvents: "none",
            }}>
              {isStart ? "🏁" : isEnd ? "👑" : (path[i]?.label ?? (i + 1))}
            </span>
          </div>
        );
      })}

      {/* ── Side Panel in the black area (left) ── */}
      {sidePanelWidth > 0 && (
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: sidePanelWidth, bottom: 0,
          background: "rgba(0,0,0,0.95)",
          borderRight: "2px solid #FFD700",
          zIndex: 50,
          display: "flex", flexDirection: "column",
          gap: 4, padding: "8px 6px",
          pointerEvents: "auto",
          fontFamily: "monospace",
          overflowY: "auto",
        }}>
          {/* Title */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #FFD700", paddingBottom: 4, marginBottom: 2 }}>
            <span style={{ color: "#FFD700", fontWeight: 700, fontSize: 14 }}>🏴‍☠️ Editor</span>
          </div>

          {/* Status */}
          <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginBottom: 2 }}>
            {deleteMode
              ? <span style={{ color: "#f66" }}>🗑️ Clique para apagar</span>
              : dragging !== null
              ? <span style={{ color: "#0ff" }}>Arrastando #{dragging}</span>
              : !loaded
              ? <span style={{ color: "#fa0" }}>Carregando...</span>
              : <span>Arraste as casas</span>
            }
          </div>

          {/* Delete toggle */}
          <button onClick={() => setDeleteMode(v => !v)}
            style={{ padding: "6px 4px", background: deleteMode ? "#3a0000" : "#1a0000", color: deleteMode ? "#f88" : "#f66", border: `1px solid ${deleteMode ? "#a00" : "#600"}`, borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: deleteMode ? 700 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {deleteMode ? "🗑️ Apagando..." : "🗑️ Apagar"}
          </button>

          {/* Save */}
          <button onClick={handleSaveNow}
            style={{ padding: "6px 4px", background: savedOk ? "#0a3a0a" : saving ? "#1a1a00" : "#002a00", color: savedOk ? "#0f0" : saving ? "#ff0" : "#4d4", border: `1px solid ${savedOk ? "#0a0" : saving ? "#880" : "#040"}`, borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {savedOk ? "✅ Salvo!" : saving ? "⏳..." : "💾 Salvar"}
          </button>

          {/* Code toggle */}
          <button onClick={() => setShowCode(v => !v)}
            style={{ padding: "6px 4px", background: "#1a1a40", color: "#88f", border: "1px solid #446", borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {showCode ? "🙈 Código" : "💻 Código"}
          </button>

          {/* Copy */}
          <button onClick={handleCopy}
            style={{ padding: "6px 4px", background: copied ? "#0a3a0a" : "#0a200a", color: copied ? "#0f0" : "#0d0", border: "1px solid #0a0", borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {copied ? "✅ Copiado!" : "📋 Copiar"}
          </button>

          {/* Align */}
          <button onClick={handleAlignHorizontal}
            style={{ padding: "6px 4px", background: "#1a0a40", color: "#c8f", border: "1px solid #60a", borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            ➖ Alinhar
          </button>

          {/* Reset */}
          <button onClick={handleReset}
            style={{ padding: "6px 4px", background: "#300", color: "#f88", border: "1px solid #600", borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            🔄 Resetar
          </button>

          {/* Close */}
          <button onClick={() => onClose(pathRef.current)}
            style={{ padding: "6px 4px", background: "#222", color: "#ccc", border: "1px solid #555", borderRadius: 6, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            ✕ Fechar
          </button>

          {/* Legend */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #333", paddingTop: 4, fontSize: 9, color: "#888", display: "flex", flexDirection: "column", gap: 2 }}>
            <span>🟢 #0 = INÍCIO</span>
            <span>👑 #{N_TILES - 1} = TOP</span>
            <span>{saving ? "⏳ Salvando..." : savedOk ? "✅ Salvo!" : "☁️ Auto-salvando"}</span>
          </div>
        </div>
      )}

      {/* Fallback top bar when no side space (e.g. portrait mode / small screen) */}
      {sidePanelWidth === 0 && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
          display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
          background: "rgba(0,0,0,0.92)", borderBottom: "1.5px solid #FFD700",
          flexWrap: "nowrap", overflowX: "auto", pointerEvents: "auto", fontFamily: "monospace",
        }}>
          <span style={{ color: "#FFD700", fontWeight: 700, fontSize: 14 }}>🏴‍☠️ Editor</span>
          <span style={{ color: "#aaa", fontSize: 10, flexShrink: 0, whiteSpace: "nowrap" }}>
            {deleteMode
              ? <span style={{ color: "#f66" }}>🗑️ Clique para apagar</span>
              : dragging !== null
              ? <span style={{ color: "#0ff" }}>Arrastando #{dragging}</span>
              : !loaded
              ? <span style={{ color: "#fa0" }}>Carregando...</span>
              : <span>Arraste as casas</span>
            }
          </span>
          <button onClick={() => setDeleteMode(v => !v)}
            style={{ padding: "3px 8px", background: deleteMode ? "#3a0000" : "#1a0000", color: deleteMode ? "#f88" : "#f66", border: `1px solid ${deleteMode ? "#a00" : "#600"}`, borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap", fontWeight: deleteMode ? 700 : 400 }}>
            {deleteMode ? "🗑️ Apagando..." : "🗑️ Apagar"}
          </button>
          <button onClick={handleSaveNow}
            style={{ padding: "3px 8px", background: savedOk ? "#0a3a0a" : saving ? "#1a1a00" : "#002a00", color: savedOk ? "#0f0" : saving ? "#ff0" : "#4d4", border: `1px solid ${savedOk ? "#0a0" : saving ? "#880" : "#040"}`, borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            {savedOk ? "✅ Salvo!" : saving ? "⏳..." : "💾 Salvar"}
          </button>
          <button onClick={() => setShowCode(v => !v)}
            style={{ padding: "3px 8px", background: "#1a1a40", color: "#88f", border: "1px solid #446", borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            {showCode ? "🙈 Código" : "💻 Código"}
          </button>
          <button onClick={handleCopy}
            style={{ padding: "3px 8px", background: copied ? "#0a3a0a" : "#0a200a", color: copied ? "#0f0" : "#0d0", border: "1px solid #0a0", borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            {copied ? "✅ Copiado!" : "📋 Copiar"}
          </button>
          <button onClick={handleAlignHorizontal}
            style={{ padding: "3px 8px", background: "#1a0a40", color: "#c8f", border: "1px solid #60a", borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            ➖ Alinhar
          </button>
          <button onClick={handleReset}
            style={{ padding: "3px 8px", background: "#300", color: "#f88", border: "1px solid #600", borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            🔄 Resetar
          </button>
          <button onClick={() => onClose(pathRef.current)}
            style={{ padding: "3px 8px", background: "#222", color: "#ccc", border: "1px solid #555", borderRadius: 6, cursor: "pointer", fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}>
            ✕ Fechar
          </button>
        </div>
      )}

      {/* Code panel on the right */}
      {showCode && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: 320, background: "rgba(10,10,20,0.97)", borderLeft: "1px solid #333",
          overflow: "auto", padding: "12px 12px 12px", zIndex: 40,
          pointerEvents: "auto",
        }}>
          <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>
            Cole este código no App.tsx:
          </div>
          <pre style={{ color: "#a0ffa0", fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, fontFamily: "monospace" }}>
            {generateCode()}
          </pre>
        </div>
      )}
    </div>
  );
}
