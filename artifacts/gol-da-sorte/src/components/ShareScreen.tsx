import { useEffect, useState } from "react";

function apiUrl(path: string) {
  return `/api${path}`;
}

interface ReferralInfo {
  referralCode: string;
  referralUnlocked: boolean;
  totalFriends: number;
  rewardedFriends: number;
  pendingFriends: number;
  totalBonusPlays: number;
}

interface Props {
  userId: number;
  onClose: () => void;
}

export default function ShareScreen({ userId, onClose }: Props) {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/users/${userId}/referral-info`))
      .then(r => r.json())
      .then(d => setInfo(d));
  }, [userId]);

  const inviteLink = info
    ? `${window.location.origin}${window.location.pathname}?ref=${info.referralCode}`
    : "";

  const shareText = `🏆 Jogue o GOL DA SORTE comigo e ganhe 10 jogadas grátis!\n${inviteLink}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "GOL DA SORTE",
          text: "🏆 Jogue o GOL DA SORTE comigo e ganhe 10 jogadas grátis!",
          url: inviteLink,
        });
        onClose();
      } catch {
        // usuário cancelou
      }
    }
  };

  const [fbCopied, setFbCopied] = useState(false);

  const handleFacebook = async () => {
    const text = `🏆 Jogue o GOL DA SORTE comigo e ganhe 10 jogadas grátis!\n${inviteLink}`;
    try {
      await navigator.clipboard.writeText(text);
      setFbCopied(true);
    } catch {}
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`;
    window.open(url, "_blank", "width=600,height=500");
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
    onClose();
  };

  const handleInstagram = () => {
    navigator.clipboard.writeText(shareText).catch(() => {});
    window.open("https://www.instagram.com/", "_blank");
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "linear-gradient(160deg, #111 0%, #1c1500 100%)",
        border: "1.5px solid rgba(255,200,0,0.3)",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 340,
        position: "relative",
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", background: "transparent", border: "none",
            color: "#666", fontSize: 22, cursor: "pointer", right: 16, top: 14,
          }}
        >✕</button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <line x1="7.5" y1="9" x2="16.5" y2="5" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="7.5" y1="15" x2="16.5" y2="19" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="5" cy="12" r="3" fill="#FFD700" stroke="#FFA500" strokeWidth="1"/>
              <circle cx="19" cy="4.5" r="3" fill="#FFD700" stroke="#FFA500" strokeWidth="1"/>
              <circle cx="19" cy="19.5" r="3" fill="#FFD700" stroke="#FFA500" strokeWidth="1"/>
            </svg>
          </div>
          <div style={{ color: "#FFD700", fontSize: 26, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>
            COMPARTILHAR
          </div>
          <div style={{ color: "#ccc", fontSize: 15, marginTop: 8, lineHeight: 1.6 }}>
            Convide amigos e ganhe{" "}
            <span style={{ color: "#FFD700", fontWeight: 800, fontSize: 16 }}>+3 jogadas grátis</span>{" "}
            para cada um que comprar!
          </div>
        </div>

        {!info ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20 }}>Carregando...</div>
        ) : (
          <>
            {/* Compartilhar nativo (celular) — abre Instagram, Facebook, WhatsApp etc */}
            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #FFD700, #FFA500)",
                  color: "#111", border: "none", borderRadius: 12, padding: "14px",
                  fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <line x1="7.5" y1="9" x2="16.5" y2="5" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="7.5" y1="15" x2="16.5" y2="19" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="5" cy="12" r="3" fill="#111"/>
                  <circle cx="19" cy="4.5" r="3" fill="#111"/>
                  <circle cx="19" cy="19.5" r="3" fill="#111"/>
                </svg>
                COMPARTILHAR AGORA
              </button>
            )}

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              style={{
                width: "100%", background: "linear-gradient(135deg, #25D366, #128C7E)",
                color: "#fff", border: "none", borderRadius: 12, padding: "13px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 8,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>💬</span> ENVIAR PELO WHATSAPP
            </button>

            {/* Facebook */}
            <button
              onClick={handleFacebook}
              style={{
                width: "100%", background: "linear-gradient(135deg, #1877F2, #166fe5)",
                color: "#fff", border: "none", borderRadius: 12, padding: "13px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: fbCopied ? 4 : 8,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📘</span> COMPARTILHAR NO FACEBOOK
            </button>
            {fbCopied && (
              <div style={{
                background: "rgba(24,119,242,0.15)",
                border: "1px solid rgba(24,119,242,0.4)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 8,
                color: "#90b8ff", fontSize: 12, textAlign: "center", lineHeight: 1.5,
              }}>
                ✅ Texto copiado! No Facebook, clique em <strong>"No que você está pensando?"</strong> e cole com <strong>Ctrl+V</strong> (ou toque longo → Colar)
              </div>
            )}

            {/* Instagram — copia e abre */}
            <button
              onClick={handleInstagram}
              style={{
                width: "100%", background: "linear-gradient(135deg, #E4405F, #C13584, #833AB4)",
                color: "#fff", border: "none", borderRadius: 12, padding: "13px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📸</span> ABRIR INSTAGRAM
            </button>

            <button
              onClick={handleCopy}
              style={{
                width: "100%", background: "rgba(255,200,0,0.12)",
                color: "#FFD700", border: "1.5px solid rgba(255,200,0,0.3)",
                borderRadius: 12, padding: "12px",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              {copied ? "✓ LINK COPIADO!" : "📋 COPIAR LINK"}
            </button>

            <div style={{
              marginTop: 14, textAlign: "center",
              color: "#555", fontSize: 11, lineHeight: 1.5,
            }}>
              Código de convite:{" "}
              <span style={{ color: "#FFD700", fontWeight: 800, letterSpacing: 2 }}>{info.referralCode}</span>
            </div>

            {!canNativeShare && (
              <div style={{ marginTop: 8, textAlign: "center", color: "#555", fontSize: 11 }}>
                💡 No Instagram: link copiado automaticamente — cole no stories ou bio.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
