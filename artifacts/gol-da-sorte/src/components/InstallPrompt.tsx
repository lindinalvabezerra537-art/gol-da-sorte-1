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

function isSafari() {
  return /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    // iOS Safari: beforeinstallprompt nunca dispara — mostra guia manual
    if (isIOS() && isSafari()) {
      const dismissed = sessionStorage.getItem("pwa-ios-dismissed");
      if (!dismissed) {
        setTimeout(() => setShowIOSGuide(true), 3000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setVisible(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setVisible(false);
    setDeferredPrompt(null);
  };

  const dismissIOS = () => {
    sessionStorage.setItem("pwa-ios-dismissed", "1");
    setShowIOSGuide(false);
  };

  if (installed) return null;

  // Guia iOS
  if (showIOSGuide) {
    return (
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        padding: "14px 16px",
        background: "linear-gradient(135deg, #1a1200, #2a1f00)",
        borderTop: "2px solid rgba(255,200,0,0.6)",
        boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 32, flexShrink: 0 }}>⚽</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
              INSTALAR GOL DA SORTE
            </div>
            <div style={{ color: "#aaa", fontSize: 11, marginTop: 1 }}>
              Adicione à tela inicial e jogue sempre!
            </div>
          </div>
          <button
            onClick={dismissIOS}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              color: "#888",
              fontSize: 11,
              padding: "7px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Fechar
          </button>
        </div>
        <div style={{
          background: "rgba(255,215,0,0.08)",
          border: "1px solid rgba(255,215,0,0.25)",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 700 }}>Como instalar no iPhone/iPad:</div>
          <div style={{ color: "#ccc", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>1️⃣</span> Toque em <strong style={{ color: "#fff" }}>Compartilhar</strong> <span style={{ fontSize: 14 }}>⬆️</span> na barra do Safari
          </div>
          <div style={{ color: "#ccc", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>2️⃣</span> Role para baixo e toque em <strong style={{ color: "#fff" }}>"Adicionar à Tela de Início"</strong>
          </div>
          <div style={{ color: "#ccc", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>3️⃣</span> Toque em <strong style={{ color: "#fff" }}>"Adicionar"</strong> no canto superior direito
          </div>
        </div>
      </div>
    );
  }

  // Android/Chrome: prompt nativo
  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9000,
      padding: "12px 16px",
      background: "linear-gradient(135deg, #1a1200, #2a1f00)",
      borderTop: "2px solid rgba(255,200,0,0.6)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
    }}>
      <div style={{ fontSize: 32, flexShrink: 0 }}>⚽</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>
          INSTALAR GOL DA SORTE
        </div>
        <div style={{ color: "#aaa", fontSize: 11, marginTop: 1 }}>
          Adicione à tela inicial e jogue sempre!
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            color: "#888",
            fontSize: 11,
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          Agora não
        </button>
        <button
          onClick={handleInstall}
          style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontSize: 12,
            fontWeight: 900,
            padding: "7px 14px",
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          INSTALAR
        </button>
      </div>
    </div>
  );
}
