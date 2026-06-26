import { useState, useEffect, useRef } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "")
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

const PACKAGES = [
  { plays: 5,  price: "R$ 5,00",  label: "STARTER",  highlight: false },
  { plays: 15, price: "R$ 10,00", label: "POPULAR",   highlight: true  },
  { plays: 30, price: "R$ 20,00", label: "PRO",       highlight: false },
];

interface Props {
  userId: number;
  onPurchased: (newPlays: number) => void;
  onClose: () => void;
}

interface PixData {
  txId: string;
  pixKey: string;
  pixName: string;
  amount: string;
  plays: number;
  pixPayload: string;
  qrCode: string;
}

export default function PurchaseModal({ userId, onPurchased, onClose }: Props) {
  const [selected, setSelected] = useState<number>(15);
  const [step, setStep]         = useState<"choose" | "pix" | "waiting" | "done">("choose");
  const [pixData, setPixData]   = useState<PixData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll payment status while waiting
  useEffect(() => {
    if (step !== "waiting" || !pixData) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/payments/${pixData.txId}/status`));
        const data = await res.json();
        if (data.status === "confirmed") {
          clearInterval(pollRef.current!);
          // Fetch updated play count
          const userRes = await fetch(getApiUrl(`/users/${userId}`));
          const userData = await userRes.json();
          if (userData?.user) {
            onPurchased(userData.user.playsRemaining);
            setStep("done");
          }
        }
      } catch {}
    }, 4000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, pixData, userId, onPurchased]);

  const handleGeneratePix = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl("/payments/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plays: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao gerar PIX."); return; }
      setPixData(data);
      setStep("pix");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.pixKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const copyPayload = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.pixPayload).then(() => {
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 2500);
    });
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,200,0,0.25)",
    borderRadius: 8, color: "#fff", fontSize: 13,
    padding: "10px 12px", width: "100%", boxSizing: "border-box",
    userSelect: "all", wordBreak: "break-all", fontFamily: "monospace",
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
        border: "1.5px solid rgba(255,200,0,0.35)",
        borderRadius: 20, padding: 24, width: "100%", maxWidth: 360,
        maxHeight: "90vh", overflowY: "auto",
      }}>

        {/* ── STEP 1: Escolher pacote ── */}
        {step === "choose" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>⚽</div>
              <div style={{ color: "#FFD700", fontSize: 19, fontWeight: 900, letterSpacing: 1 }}>
                COMPRAR JOGADAS
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                Escolha um pacote e pague via PIX
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {PACKAGES.map(pkg => (
                <div
                  key={pkg.plays}
                  onClick={() => setSelected(pkg.plays)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                    border: selected === pkg.plays ? "2px solid #FFD700" : "1.5px solid rgba(255,255,255,0.1)",
                    background: selected === pkg.plays ? "rgba(255,200,0,0.12)" : pkg.highlight ? "rgba(255,255,255,0.04)" : "transparent",
                    position: "relative",
                  }}
                >
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                      {pkg.plays} jogadas
                    </div>
                    {pkg.highlight && (
                      <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 700 }}>MAIS POPULAR</div>
                    )}
                  </div>
                  <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 17 }}>{pkg.price}</div>
                  {selected === pkg.plays && (
                    <div style={{
                      position: "absolute", right: -8, top: -8,
                      background: "#FFD700", color: "#000", borderRadius: "50%",
                      width: 20, height: 20, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 11, fontWeight: 900,
                    }}>✓</div>
                  )}
                </div>
              ))}
            </div>

            {error && <div style={{ color: "#ff6060", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{error}</div>}

            <button
              onClick={handleGeneratePix}
              disabled={loading}
              style={{
                width: "100%", background: loading ? "#444" : "linear-gradient(135deg, #00c853, #00e676)",
                color: "#000", border: "none", borderRadius: 12, padding: "15px",
                fontSize: 15, fontWeight: 900, cursor: loading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? "GERANDO PIX..." : <><span style={{ fontSize: 20 }}>💳</span> PAGAR COM PIX</>}
            </button>

            <button onClick={onClose} style={{ width: "100%", background: "transparent", color: "#666", border: "none", fontSize: 13, cursor: "pointer", padding: "12px 0 0" }}>
              Agora não
            </button>
          </>
        )}

        {/* ── STEP 2: PIX QR Code + chave ── */}
        {step === "pix" && pixData && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ color: "#FFD700", fontSize: 17, fontWeight: 900 }}>
                💳 PAGUE COM PIX
              </div>
              <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                {pixData.plays} jogadas por <strong style={{ color: "#fff" }}>R$ {pixData.amount}</strong>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{
                background: "#fff", padding: 10, borderRadius: 12,
                display: "inline-block", boxShadow: "0 0 30px rgba(255,200,0,0.3)",
              }}>
                <img src={pixData.qrCode} alt="PIX QR Code" style={{ display: "block", width: 200, height: 200 }} />
              </div>
            </div>

            {/* Payload copiável (QR code em texto) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#aaa", fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
                PIX COPIA E COLA
              </div>
              <div style={inputStyle}>
                {pixData.pixPayload.slice(0, 60)}...
              </div>
              <button
                onClick={copyPayload}
                style={{
                  width: "100%", marginTop: 6,
                  background: copiedQr ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${copiedQr ? "#00c853" : "rgba(255,200,0,0.3)"}`,
                  borderRadius: 8, color: copiedQr ? "#00e676" : "#FFD700",
                  fontSize: 13, fontWeight: 700, padding: "8px", cursor: "pointer",
                }}
              >
                {copiedQr ? "✅ COPIADO!" : "📋 COPIAR PIX COPIA E COLA"}
              </button>
            </div>

            {/* Chave PIX */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#aaa", fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
                CHAVE PIX
              </div>
              <div style={inputStyle}>{pixData.pixKey}</div>
              <button
                onClick={copyKey}
                style={{
                  width: "100%", marginTop: 6,
                  background: copied ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${copied ? "#00c853" : "rgba(255,200,0,0.3)"}`,
                  borderRadius: 8, color: copied ? "#00e676" : "#FFD700",
                  fontSize: 13, fontWeight: 700, padding: "8px", cursor: "pointer",
                }}
              >
                {copied ? "✅ COPIADO!" : "📋 COPIAR CHAVE PIX"}
              </button>
            </div>

            <div style={{
              background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              color: "#bbb", fontSize: 12, lineHeight: 1.5,
            }}>
              ⚡ Após pagar, suas jogadas serão liberadas <strong style={{ color: "#FFD700" }}>automaticamente</strong> em até 1 minuto.
            </div>

            <button
              onClick={() => setStep("waiting")}
              style={{
                width: "100%", background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                color: "#000", border: "none", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 900, cursor: "pointer",
              }}
            >
              JÁ PAGUEI — AGUARDAR CONFIRMAÇÃO
            </button>

            <button onClick={() => setStep("choose")} style={{ width: "100%", background: "transparent", color: "#666", border: "none", fontSize: 13, cursor: "pointer", padding: "10px 0 0" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ── STEP 3: Aguardando confirmação ── */}
        {step === "waiting" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>⏳</div>
            <div style={{ color: "#FFD700", fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
              AGUARDANDO PAGAMENTO
            </div>
            <div style={{ color: "#888", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Verificando o pagamento a cada 4 segundos.<br />
              Assim que confirmado, suas jogadas aparecerão automaticamente!
            </div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 24 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%", background: "#FFD700",
                  animation: `pulse 1.2s ${i * 0.4}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <button
              onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep("pix"); }}
              style={{ background: "transparent", color: "#666", border: "none", fontSize: 13, cursor: "pointer" }}
            >
              ← Ver QR Code novamente
            </button>
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
              }
            `}</style>
          </div>
        )}

        {/* ── STEP 4: Confirmado! ── */}
        {step === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
            <div style={{ color: "#00e676", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
              PAGAMENTO CONFIRMADO!
            </div>
            <div style={{ color: "#aaa", fontSize: 14, marginBottom: 20 }}>
              Suas jogadas foram liberadas.<br />
              Boa sorte! ⚽
            </div>
            <button
              onClick={onClose}
              style={{
                background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                color: "#000", border: "none", borderRadius: 12, padding: "14px 32px",
                fontSize: 16, fontWeight: 900, cursor: "pointer",
              }}
            >
              JOGAR AGORA!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
