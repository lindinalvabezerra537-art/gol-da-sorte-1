import { useState, useRef, useEffect } from "react";

const G = {
  gold: "#FFD700",
  border: "rgba(255,200,0,0.25)",
  muted: "#888888",
  error: "#ff5555",
  success: "#55ff88",
};

function getApiUrl(path: string) {
  return `${window.location.origin}/api${path}`;
}

interface Props {
  userId: number;
  initialSocialLink?: string | null;
  onClose: () => void;
  onUpdated: (updates: { fotoBase64?: string; rankingSocialLink?: string }) => void;
}

export default function EditProfileModal({ userId, initialSocialLink, onClose, onUpdated }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState("");
  const [socialLink, setSocialLink] = useState(initialSocialLink || "");
  const [ranking, setRanking] = useState<{ cidadeRank: number; estadoRank: number; brasilRank: number } | null>(null);
  const [userData, setUserData] = useState<{ cidade: string; estado: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(getApiUrl(`/users/${userId}`)).then(r => r.json()),
      fetch(getApiUrl(`/users/${userId}/ranking`)).then(r => r.json()),
    ]).then(([userRes, rankingRes]) => {
      if (userRes.user) {
        setPhone(userRes.user.phone || "");
        setUserData({ cidade: userRes.user.cidade, estado: userRes.user.estado });
      }
      if (rankingRes.cidadeRank !== undefined) {
        setRanking({
          cidadeRank: Number(rankingRes.cidadeRank),
          estadoRank: Number(rankingRes.estadoRank),
          brasilRank: Number(rankingRes.brasilRank),
        });
      }
    }).catch(() => {});
  }, [userId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Foto muito grande (máx 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!preview) return;
    setLoadingPhoto(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/users/${userId}/photo`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoBase64: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar foto");
      onUpdated({ fotoBase64: preview });
      setPreview(null);
      setSuccess("Foto atualizada!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoadingProfile(true);
    setError(null);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        setError("Telefone inválido (mín. 10 dígitos)");
        setLoadingProfile(false);
        return;
      }
      const res = await fetch(getApiUrl(`/users/${userId}/profile`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, rankingSocialLink: socialLink.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      onUpdated({ rankingSocialLink: socialLink.trim() || undefined });
      setSuccess("Perfil atualizado!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoadingProfile(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#1a1a1a",
    border: `1.5px solid ${G.border}`,
    borderRadius: 10, padding: "10px 12px",
    color: "#fff", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };

  const sectionLabel: React.CSSProperties = {
    color: G.gold, fontSize: 12, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, overflowY: "auto",
    }}>
      <div style={{
        background: "linear-gradient(160deg, #111 0%, #1c1500 100%)",
        border: `1.5px solid ${G.border}`,
        borderRadius: 20, padding: "28px 24px",
        width: "100%", maxWidth: 360,
        position: "relative",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", background: "transparent", border: "none",
          color: "#666", fontSize: 22, cursor: "pointer", right: 20, top: 16,
        }}>✕</button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>👤</div>
          <div style={{ color: G.gold, fontSize: 20, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>
            EDITAR PERFIL
          </div>
        </div>

        {/* ── FOTO ── */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid rgba(255,200,0,0.12)" }}>
          <div style={sectionLabel}>📷 Foto</div>
          <div style={{
            width: 90, height: 90, borderRadius: "50%",
            border: `2px solid ${G.gold}`, overflow: "hidden",
            background: "#1a1a1a", margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {preview
              ? <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
              : <span style={{ fontSize: 32, color: "#555" }}>👤</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", background: "rgba(255,200,0,0.10)",
            color: G.gold, border: `1.5px solid ${G.border}`,
            borderRadius: 10, padding: "10px", fontSize: 13,
            fontWeight: 700, cursor: "pointer", marginBottom: 10,
          }}>
            📁 ESCOLHER FOTO
          </button>
          <button onClick={handleSavePhoto} disabled={!preview || loadingPhoto} style={{
            width: "100%",
            background: preview && !loadingPhoto ? "linear-gradient(135deg, #FFD700, #FF8C00)" : "rgba(255,255,255,0.07)",
            color: preview && !loadingPhoto ? "#000" : "#555",
            border: "none", borderRadius: 10, padding: "11px",
            fontSize: 14, fontWeight: 900,
            cursor: preview && !loadingPhoto ? "pointer" : "default",
            opacity: preview && !loadingPhoto ? 1 : 0.5,
          }}>
            {loadingPhoto ? "SALVANDO..." : "💾 SALVAR FOTO"}
          </button>
        </div>

        {/* ── LINK REDE SOCIAL ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>🔗 Link da Rede Social</div>
          <input
            type="url"
            value={socialLink}
            onChange={e => setSocialLink(e.target.value)}
            placeholder="https://instagram.com/seu_perfil"
            style={inputStyle}
          />
          <div style={{ color: G.muted, fontSize: 11, marginTop: 4 }}>
            Usado no Campeão de Performance e no Ranking
          </div>
        </div>

        {/* ── TELEFONE ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={sectionLabel}>📱 Número de Telefone</div>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            style={inputStyle}
          />
        </div>

        {/* ── SALVAR LINK + TELEFONE ── */}
        <button onClick={handleSaveProfile} disabled={loadingProfile} style={{
          width: "100%",
          background: loadingProfile ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg, #FFD700, #FF8C00)",
          color: loadingProfile ? "#555" : "#000",
          border: "none", borderRadius: 12, padding: "14px",
          fontSize: 15, fontWeight: 900,
          cursor: loadingProfile ? "default" : "pointer",
          marginBottom: 24,
        }}>
          {loadingProfile ? "SALVANDO..." : "💾 SALVAR LINK E TELEFONE"}
        </button>

        {/* ── RANKING ── */}
        {ranking && userData && (
          <div style={{
            background: "rgba(255,215,0,0.04)",
            border: "1px solid rgba(255,200,0,0.18)",
            borderRadius: 14, padding: "16px 18px",
          }}>
            <div style={{ ...sectionLabel, marginBottom: 14 }}>🏆 Sua Posição no Ranking</div>
            {[
              { label: `🏙️ Cidade (${userData.cidade})`, rank: ranking.cidadeRank },
              { label: `🗺️ Estado (${userData.estado})`, rank: ranking.estadoRank },
              { label: "🇧🇷 Brasil", rank: ranking.brasilRank },
            ].map(({ label, rank }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 12,
              }}>
                <span style={{ color: "#ccc", fontSize: 13 }}>{label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: G.gold, fontWeight: 900, fontSize: 15 }}>#{rank}</span>
                  {rank > 1
                    ? <div style={{ color: G.muted, fontSize: 11 }}>{rank - 1} à sua frente</div>
                    : <div style={{ color: G.success, fontSize: 11 }}>Líder! 🥇</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ color: G.error, fontSize: 13, textAlign: "center", marginTop: 14 }}>{error}</div>}
        {success && <div style={{ color: G.success, fontSize: 13, textAlign: "center", marginTop: 14 }}>✅ {success}</div>}
      </div>
    </div>
  );
}
