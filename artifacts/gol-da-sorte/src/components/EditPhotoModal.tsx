import { useState, useRef } from "react";

const G = {
  bg: "linear-gradient(170deg, #050505 0%, #0e0c00 50%, #050505 100%)",
  gold: "#FFD700",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,200,0,0.25)",
  text: "#ffffff",
  muted: "#888888",
  error: "#ff5555",
  success: "#55ff88",
};

function apiUrl(path: string) {
  return `/api${path}`;
}

interface Props {
  userId: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditPhotoModal({ userId, onClose, onUpdated }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Foto muito grande (máx 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/users/${userId}/photo`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoBase64: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar foto");
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(160deg, #111 0%, #1c1500 100%)",
        border: `1.5px solid ${G.border}`,
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 340,
        position: "relative",
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", background: "transparent", border: "none",
            color: "#666", fontSize: 22, cursor: "pointer", right: 20, top: 16,
          }}
        >✕</button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🖼</div>
          <div style={{ color: G.gold, fontSize: 22, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>
            EDITAR FOTO
          </div>
        </div>

        <div style={{
          width: 120, height: 120, borderRadius: "50%",
          border: `2px solid ${G.gold}`, overflow: "hidden",
          background: "#1a1a1a", margin: "0 auto 16px",
          boxShadow: "0 0 12px rgba(255,215,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
          ) : (
            <span style={{ fontSize: 40, color: "#555" }}>👤</span>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%", background: "rgba(255,200,0,0.12)",
            color: G.gold, border: `1.5px solid ${G.border}`,
            borderRadius: 12, padding: "12px",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            marginBottom: 12,
          }}
        >
          📁 ESCOLHER FOTO
        </button>

        {error && (
          <div style={{ color: G.error, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!preview || loading}
          style={{
            width: "100%", background: preview && !loading
              ? "linear-gradient(135deg, #FFD700, #FF8C00)"
              : "rgba(255,255,255,0.08)",
            color: preview && !loading ? "#000" : "#666",
            border: "none", borderRadius: 12, padding: "14px",
            fontSize: 15, fontWeight: 900, cursor: preview && !loading ? "pointer" : "default",
            opacity: preview && !loading ? 1 : 0.5,
          }}
        >
          {loading ? "SALVANDO..." : "💾 SALVAR FOTO"}
        </button>
      </div>
    </div>
  );
}
