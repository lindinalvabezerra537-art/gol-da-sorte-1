import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    if (isIOS()) {
      setTimeout(() => setVisible(true), 2000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setVisible(false); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (installed || !visible) return null;

  // ── iOS Safari ──
  if (isIOS()) {
    return (
      <>
        {/* Seta apontando para o botão do Safari lá embaixo */}
        <div style={{
          position: "fixed", bottom: 60, left: "50%", transform: "translateX(-50%)",
          zIndex: 9001, display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: "#FFD700", color: "#000", fontWeight: 900,
            fontSize: 11, padding: "4px 10px", borderRadius: 20,
            whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(255,200,0,0.5)",
          }}>
            TOQUE AQUI PARA INSTALAR ↓
          </div>
          <div style={{
            width: 2, height: 30, background: "#FFD700",
            boxShadow: "0 0 8px rgba(255,200,0,0.5)",
          }} />
          <div style={{
            width: 0, height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "14px solid #FFD700",
            filter: "drop-shadow(0 2px 4px rgba(255,200,0,0.5))",
          }} />
        </div>

        {/* Banner explicativo */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9000,
          background: "linear-gradient(135deg, #1a1200, #2a1f00)",
          borderTop: "2px solid rgba(255,200,0,0.6)",
          boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
          padding: "10px 16px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>⚽</span>
              <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 13 }}>INSTALAR GOL DA SORTE</span>
            </div>
            <button onClick={() => setVisible(false)} style={{
              background: "transparent", border: "none",
              color: "#666", fontSize: 20, cursor: "pointer", padding: "0 4px",
            }}>✕</button>
          </div>

          {/* Instrução visual */}
          <div style={{
            background: "rgba(255,215,0,0.07)",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 10, padding: "10px 12px",
            color: "#ccc", fontSize: 12, lineHeight: 1.8,
          }}>
            <div style={{ marginBottom: 4, color: "#fff", fontWeight: 700, fontSize: 13 }}>
              Como instalar no iPhone:
            </div>
            {/* Safari share icon mockup */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: "rgba(255,255,255,0.1)",
                border: "1.5px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                  <path d="M8 1v10M4 5l4-4 4 4" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="1" y="8" width="14" height="9" rx="2" stroke="#FFD700" strokeWidth="1.5" fill="none"/>
                </svg>
              </div>
              <span>Toque no botão <strong style={{ color: "#FFD700" }}>Compartilhar</strong> do Safari<br/>
                <span style={{ fontSize: 11, color: "#888" }}>(barra inferior do navegador)</span>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: "rgba(255,255,255,0.1)",
                border: "1.5px solid rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 16,
              }}>➕</div>
              <span>Toque em <strong style={{ color: "#FFD700" }}>"Adicionar à Tela de Início"</strong></span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Android/Chrome ──
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9000,
      background: "linear-gradient(135deg, #1a1200, #2a1f00)",
      borderTop: "2px solid rgba(255,200,0,0.6)",
      boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
      padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 30, flexShrink: 0 }}>⚽</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
          INSTALAR GOL DA SORTE
        </div>
        <div style={{ color: "#aaa", fontSize: 11, marginTop: 1 }}>
          Adicione à tela inicial e jogue sempre!
        </div>
      </div>
      <button onClick={() => setVisible(false)} style={{
        background: "transparent", border: "none",
        color: "#555", fontSize: 18, cursor: "pointer", padding: "4px 8px", flexShrink: 0,
      }}>✕</button>
      <button onClick={handleAndroidInstall} style={{
        background: "linear-gradient(135deg, #FFD700, #FF8C00)",
        border: "none", borderRadius: 10,
        color: "#000", fontSize: 14, fontWeight: 900,
        padding: "10px 18px", cursor: "pointer",
        letterSpacing: 0.5, flexShrink: 0,
        boxShadow: "0 0 16px rgba(255,180,0,0.5)",
      }}>
        INSTALAR
      </button>
    </div>
  );
}
