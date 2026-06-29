interface Props {
  userInfo: {
    name: string;
    cidade: string;
    estado: string;
    fotoBase64?: string | null;
  } | null;
  points: number;
  playsRemaining: number;
  cidadeRank: number | null;
  estadoRank: number | null;
  brasilRank: number | null;
  onClose: () => void;
  onTrocarFoto: () => void;
}

const G = {
  bg: "rgba(0,0,0,0.92)",
  gold: "#FFD700",
  card: "linear-gradient(160deg, #111 0%, #1c1500 100%)",
  border: "rgba(255,200,0,0.25)",
  text: "#ffffff",
  muted: "#888888",
};

export default function MeusPontosModal({
  userInfo,
  points,
  playsRemaining,
  cidadeRank,
  estadoRank,
  brasilRank,
  onClose,
  onTrocarFoto,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: G.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: G.card,
          border: `1.5px solid ${G.border}`,
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 360,
          position: "relative",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            background: "transparent",
            border: "none",
            color: "#666",
            fontSize: 22,
            cursor: "pointer",
            right: 20,
            top: 16,
          }}
        >
          ✕
        </button>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              border: `3px solid ${G.gold}`,
              overflow: "hidden",
              background: userInfo?.fotoBase64 ? "#1a1a1a" : "linear-gradient(135deg, #333 0%, #111 100%)",
              margin: "0 auto 12px",
              boxShadow: "0 0 16px rgba(255,215,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {userInfo?.fotoBase64 ? (
              <img
                src={userInfo.fotoBase64}
                alt="Foto"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
            ) : (
              <span style={{ fontSize: 40 }}>👤</span>
            )}
          </div>
          <div
            style={{
              color: G.gold,
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1,
              textShadow: "0 0 10px rgba(255,215,0,0.4)",
            }}
          >
            {userInfo?.name || "Jogador"}
          </div>
          <div style={{ color: G.muted, fontSize: 13, marginTop: 4 }}>
            {userInfo?.cidade ? `${userInfo.cidade} - ${userInfo.estado}` : ""}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,200,0,0.08)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 16,
            border: `1px solid ${G.border}`,
          }}
        >
          <div style={{ color: G.gold, fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>
            ⚡ MEUS PONTOS
          </div>
          <div style={{ color: G.text, fontSize: 36, fontWeight: 900, textShadow: "0 0 12px rgba(255,215,0,0.3)" }}>
            {points}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: "rgba(255,200,0,0.06)",
              borderRadius: 10,
              padding: "10px 6px",
              border: `1px solid ${G.border}`,
            }}
          >
            <div style={{ color: G.muted, fontSize: 10, fontWeight: 700 }}>CIDADE</div>
            <div style={{ color: G.gold, fontSize: 18, fontWeight: 900 }}>
              {cidadeRank ? `#${cidadeRank}` : "—"}
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,200,0,0.06)",
              borderRadius: 10,
              padding: "10px 6px",
              border: `1px solid ${G.border}`,
            }}
          >
            <div style={{ color: G.muted, fontSize: 10, fontWeight: 700 }}>ESTADO</div>
            <div style={{ color: G.gold, fontSize: 18, fontWeight: 900 }}>
              {estadoRank ? `#${estadoRank}` : "—"}
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,200,0,0.06)",
              borderRadius: 10,
              padding: "10px 6px",
              border: `1px solid ${G.border}`,
            }}
          >
            <div style={{ color: G.muted, fontSize: 10, fontWeight: 700 }}>BRASIL</div>
            <div style={{ color: G.gold, fontSize: 18, fontWeight: 900 }}>
              {brasilRank ? `#${brasilRank}` : "—"}
            </div>
          </div>
        </div>

        <div style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
          🎮 Jogadas restantes: <span style={{ color: G.gold, fontWeight: 900 }}>{playsRemaining}</span>
        </div>

        <button
          onClick={onTrocarFoto}
          style={{
            width: "100%",
            background: "rgba(255,200,0,0.12)",
            color: G.gold,
            border: `1.5px solid ${G.border}`,
            borderRadius: 12,
            padding: "12px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          📷 TROCAR FOTO
        </button>
      </div>
    </div>
  );
}
