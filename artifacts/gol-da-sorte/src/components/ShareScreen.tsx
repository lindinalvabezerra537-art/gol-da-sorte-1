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

  const shareText = `🏆 Jogue o GOL DA SORTE comigo e ganhe 5 jogadas grátis! ${inviteLink}`;

  const handleFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "width=600,height=400");
    onClose();
  };

  const handleInstagram = () => {
    // Instagram não tem API web de compartilhamento direto.
    // Copia o texto e abre a página do Instagram para o usuário colar manualmente.
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
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
          <div style={{ fontSize: 44, marginBottom: 8 }}>🔗</div>
          <div style={{ color: "#FFD700", fontSize: 26, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>
            COMPARTILHAR
          </div>
          <div style={{ color: "#ccc", fontSize: 15, marginTop: 8, lineHeight: 1.6 }}>
            Convide amigos pelo Facebook ou Instagram<br />
            e ganhe <span style={{ color: "#FFD700", fontWeight: 800, fontSize: 16 }}>+3 jogadas grátis</span> para cada um que comprar!
          </div>
        </div>

        {!info ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20 }}>Carregando...</div>
        ) : (
          <>
            <button
              onClick={handleFacebook}
              style={{
                width: "100%", background: "linear-gradient(135deg, #1877F2, #166fe5)",
                color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📘</span> COMPARTILHAR NO FACEBOOK
            </button>

            <button
              onClick={handleInstagram}
              style={{
                width: "100%", background: "linear-gradient(135deg, #E4405F, #C13584, #833AB4)",
                color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📸</span> COMPARTILHAR NO INSTAGRAM
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
              marginTop: 18, textAlign: "center",
              color: "#666", fontSize: 11, lineHeight: 1.5,
            }}>
              Código de convite: <span style={{ color: "#FFD700", fontWeight: 800, letterSpacing: 2 }}>{info.referralCode}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
