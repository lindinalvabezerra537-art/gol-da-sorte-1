interface PodiumPlayer {
  nome: string;
  pontos: number;
  foto?: string;
  label: string;
  linkSocial?: string;
  userId?: string;
}

interface RankingPodiumProps {
  cidade: PodiumPlayer;
  estado: PodiumPlayer;
  brasil: PodiumPlayer;
  onClick: () => void;
}

const THEMES = {
  silver: {
    border: "#a8a8b3",
    glow: "rgba(168,168,179,0.4)",
    tag: "#c0c0c0",
    tagBg: "rgba(168,168,179,0.15)",
    crown: "🥈",
  },
  gold: {
    border: "#FFD700",
    glow: "rgba(255,215,0,0.5)",
    tag: "#FFD700",
    tagBg: "rgba(255,215,0,0.15)",
    crown: "👑",
  },
  bronze: {
    border: "#cd7f32",
    glow: "rgba(205,127,50,0.4)",
    tag: "#e8a060",
    tagBg: "rgba(205,127,50,0.15)",
    crown: "🥉",
  },
};

function PlayerCard({
  player,
  theme,
  tagLabel,
  big,
}: {
  player: PodiumPlayer;
  theme: typeof THEMES.gold;
  tagLabel: string;
  big?: boolean;
}) {
  const photoSize = big ? 44 : 34;
  const firstName = player.nome.split(" ")[0] || "—";
  const lastName = player.nome.split(" ")[1] || "";

  return (
    <div style={{
      flex: 1,
      height: big ? "100%" : "calc(100% - 12px)",
      marginTop: big ? 0 : 12,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "linear-gradient(180deg, #0e1a0e 0%, #090d0e 100%)",
      border: `1.5px solid ${theme.border}`,
      borderRadius: 8,
      boxShadow: `0 0 10px 2px ${theme.glow}`,
      padding: "5px 3px 4px",
      overflow: "hidden",
      position: "relative",
      boxSizing: "border-box",
    }}>
      <div style={{
        fontSize: 6.5,
        fontWeight: 900,
        letterSpacing: 0.8,
        color: theme.tag,
        background: theme.tagBg,
        borderRadius: 3,
        padding: "1px 4px",
        textTransform: "uppercase",
        marginBottom: 4,
        lineHeight: 1.2,
      }}>{tagLabel}</div>

      <div style={{ position: "relative", marginBottom: 3 }}>
        <div style={{
          width: photoSize,
          height: photoSize,
          borderRadius: 5,
          border: `2px solid ${theme.border}`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a1a",
          fontSize: photoSize * 0.4,
          fontWeight: 800,
          color: "#fff",
          boxShadow: `0 0 8px 2px ${theme.glow}`,
        }}>
          {player.foto
            ? <img src={player.foto} alt={player.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (player.nome.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?")}
        </div>
        <div style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          fontSize: big ? 12 : 10,
          lineHeight: 1,
        }}>{theme.crown}</div>
      </div>

      <div style={{
        fontSize: big ? 8 : 7,
        fontWeight: 900,
        color: "#fff",
        textAlign: "center",
        lineHeight: 1.15,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        paddingInline: 2,
      }}>{firstName}</div>

      {lastName && (
        <div style={{
          fontSize: big ? 7.5 : 6.5,
          fontWeight: 800,
          color: "#ddd",
          textAlign: "center",
          lineHeight: 1.1,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingInline: 2,
        }}>{lastName}</div>
      )}

      <div style={{
        fontSize: big ? 7.5 : 6.5,
        fontWeight: 900,
        color: theme.tag,
        lineHeight: 1,
        marginTop: 2,
      }}>{player.pontos.toLocaleString("pt-BR")} pts</div>

      <div style={{
        marginTop: "auto",
        paddingTop: 3,
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}>
        <div style={{
          background: theme.border,
          color: "#000",
          fontWeight: 900,
          fontSize: big ? 7 : 6,
          borderRadius: 4,
          padding: "2px 6px",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          lineHeight: 1.3,
        }}>SEGUIR</div>
      </div>
    </div>
  );
}

export default function RankingPodium({ cidade, estado, brasil, onClick }: RankingPodiumProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at center top, #0d1a0d 0%, #060a06 100%)",
        borderRadius: 8,
        border: "1px solid rgba(255,215,0,0.2)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 3px 3px",
        overflow: "hidden",
        userSelect: "none",
        boxSizing: "border-box",
        gap: 3,
      }}
    >
      <div style={{
        fontSize: 7.5,
        fontWeight: 900,
        letterSpacing: 1.2,
        color: "#FFD700",
        textTransform: "uppercase",
        lineHeight: 1,
        flexShrink: 0,
      }}>🏆 OS MELHORES</div>

      <div style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 3,
        width: "100%",
        flex: 1,
        minHeight: 0,
      }}>
        <PlayerCard player={cidade} theme={THEMES.silver} tagLabel="🏙 Cidade" />
        <PlayerCard player={brasil} theme={THEMES.gold}   tagLabel="🇧🇷 Brasil" big />
        <PlayerCard player={estado} theme={THEMES.bronze} tagLabel="🗺 Estado" />
      </div>

      <div style={{ fontSize: 6, color: "#333", lineHeight: 1, flexShrink: 0 }}>toque para ver ranking</div>
    </div>
  );
}
