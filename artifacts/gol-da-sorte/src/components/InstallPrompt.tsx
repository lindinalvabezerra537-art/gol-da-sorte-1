import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
}

function cameViaInvite() {
  return new URLSearchParams(window.location.search).has("ref");
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    const dismissed = localStorage.getItem("installDismissed");
    const fromInvite = cameViaInvite();
    const onIos = isIos();
    setIos(onIos);

    if (fromInvite && !dismissed) {
      setTimeout(() => setShowModal(true), 800);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!fromInvite && !dismissed) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowModal(false);
      setShowBanner(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    }
    setShowModal(false);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("installDismissed", "1");
    setShowModal(false);
    setShowBanner(false);
  };

  if (installed) return null;

  return (
    <>
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "linear-gradient(160deg, #0d0d00 0%, #1c1500 100%)",
            border: "2px solid rgba(255,200,0,0.5)",
            borderRadius: 22, padding: 28, width: "100%", maxWidth: 340,
            textAlign: "center", boxShadow: "0 0 40px rgba(255,180,0,0.2)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>⚽</div>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 6 }}>
              INSTALAR GOL DA SORTE
            </div>
            <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Instale o app na sua tela inicial e jogue a qualquer hora, sem precisar abrir o navegador!
            </div>

            {ios ? (
              <div style={{
                background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)",
                borderRadius: 12, padding: "14px 16px", marginBottom: 20, textAlign: "left",
              }}>
                <div style={{ color: "#FFD700", fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
                  Como instalar no iPhone/iPad:
                </div>
                <div style={{ color: "#ccc", fontSize: 13, lineHeight: 1.8 }}>
                  1️⃣ Toque em <strong style={{ color: "#fff" }}>Compartilhar</strong> <span style={{ fontSize: 15 }}>⎋</span> no Safari<br />
                  2️⃣ Role e toque em <strong style={{ color: "#fff" }}>"Adicionar à Tela de Início"</strong><br />
                  3️⃣ Toque em <strong style={{ color: "#fff" }}>Adicionar</strong>
                </div>
              </div>
            ) : (
              deferredPrompt && (
                <button
                  onClick={handleInstall}
                  style={{
                    width: "100%", marginBottom: 10,
                    background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                    border: "none", borderRadius: 12, color: "#000",
                    fontSize: 16, fontWeight: 900, padding: "14px",
                    cursor: "pointer", letterSpacing: 0.5,
                    boxShadow: "0 0 20px rgba(255,180,0,0.4)",
                  }}
                >
                  ⚡ INSTALAR AGORA
                </button>
              )
            )}

            <button
              onClick={handleDismiss}
              style={{
                width: "100%", background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10, color: "#666", fontSize: 13,
                padding: "10px", cursor: "pointer",
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {showBanner && !showModal && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9000,
          padding: "14px 16px",
          background: "linear-gradient(135deg, #1a1200, #2a1f00)",
          borderTop: "2px solid rgba(255,200,0,0.6)",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
        }}>
          <div style={{ fontSize: 36, flexShrink: 0 }}>⚽</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 14, letterSpacing: 0.5 }}>
              INSTALAR GOL DA SORTE
            </div>
            <div style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>
              Adicione à tela inicial e jogue sempre!
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={handleDismiss} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#888", fontSize: 12, padding: "8px 10px", cursor: "pointer" }}>
              Agora não
            </button>
            <button onClick={handleInstall} style={{ background: "linear-gradient(135deg, #FFD700, #FF8C00)", border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 900, padding: "8px 14px", cursor: "pointer" }}>
              INSTALAR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
