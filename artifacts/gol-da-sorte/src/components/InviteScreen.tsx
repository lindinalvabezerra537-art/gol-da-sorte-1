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

export default function InviteScreen({ userId, onClose }: Props) {
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

  const handleShare = async () => {
    const text = `🏆 Jogue o GOL DA SORTE comigo e ganhe 10 jogadas grátis!\n${inviteLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Gol da Sorte", text, url: inviteLink });
        onClose();
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onClose();
    } catch {}
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`🏆 Jogue o GOL DA SORTE comigo e ganhe 10 jogadas grátis!\n${inviteLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    onClose();
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
      }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", background: "transparent", border: "none",
            color: "#666", fontSize: 22, cursor: "pointer", right: 24, top: 20,
          }}
        >✕</button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>👥</div>
          <div style={{ color: "#FFD700", fontSize: 28, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 12px rgba(255,215,0,0.5)" }}>
            INDIQUE AMIGOS
          </div>
          <div style={{ color: "#ccc", fontSize: 15, marginTop: 8, lineHeight: 1.6 }}>
            Cada amigo que comprar o 1º pacote<br />
            você ganha <span style={{ color: "#FFD700", fontWeight: 800, fontSize: 16 }}>+3 jogadas grátis</span>!
          </div>
        </div>

        {!info ? (
          <div style={{ textAlign: "center", color: "#666", padding: 20 }}>Carregando...</div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20,
            }}>
              <div style={{
                background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)",
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>{info.totalFriends}</div>
                <div style={{ color: "#888", fontSize: 11 }}>amigos indicados</div>
              </div>
              <div style={{
                background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)",
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>{info.totalBonusPlays}</div>
                <div style={{ color: "#888", fontSize: 11 }}>jogadas bônus ganhas</div>
              </div>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 10,
              padding: "10px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ color: "#888", fontSize: 11 }}>SEU CÓDIGO</div>
                <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 18, letterSpacing: 3 }}>
                  {info.referralCode}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(info.referralCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                  onClose();
                }}
                style={{
                  background: "rgba(255,200,0,0.15)", border: "1px solid rgba(255,200,0,0.3)",
                  borderRadius: 8, padding: "6px 12px", color: "#FFD700",
                  fontSize: 12, cursor: "pointer", fontWeight: 700,
                }}
              >
                {copied ? "COPIADO! ✓" : "COPIAR"}
              </button>
            </div>

            <button
              onClick={handleWhatsApp}
              style={{
                width: "100%", background: "linear-gradient(135deg, #25D366, #128C7E)",
                color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 900, cursor: "pointer", marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>💬</span> CONVIDAR PELO WHATSAPP
            </button>

            <button
              onClick={handleShare}
              style={{
                width: "100%", background: "rgba(255,200,0,0.12)",
                color: "#FFD700", border: "1.5px solid rgba(255,200,0,0.3)",
                borderRadius: 12, padding: "12px",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              {copied ? "✓ LINK COPIADO!" : "📋 COPIAR LINK"}
            </button>

            {info.pendingFriends > 0 && (
              <div style={{
                marginTop: 14, textAlign: "center",
                color: "#888", fontSize: 12, lineHeight: 1.5,
              }}>
                ⏳ {info.pendingFriends} amigo{info.pendingFriends > 1 ? "s" : ""} ainda não compraram o primeiro pacote
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
