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
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }

    if (isIOS()) {
      if (!sessionStorage.getItem("pwa-ios-dismissed")) {
        setTimeout(() => setShowIOS(true), 2000);
      }
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

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setVisible(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem("pwa-ios-dismissed", "1");
    setShowIOS(false);
    setVisible(false);
  };

  if (installed) return null;

  const banner = (content: React.ReactNode) => (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9000,
      padding: "12px 16px",
      background: "linear-gradient(135deg, #1a1200, #2a1f00)",
      borderTop: "2px solid rgba(255,200,0,0.6)",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 -4px 30px rgba(255,180,0,0.25)",
    }}>{content}</div>
  );

  if (showIOS) return banner(
    <>
      <div style={{ fontSize: 28, flexShrink: 0 }}>⚽</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 13 }}>INSTALAR GOL DA SORTE</div>
        <div style={{ color: "#ccc", fontSize: 11, marginTop: 3 }}>
          Toque em <strong style={{ color: "#fff" }}>⬆️ Compartilhar</strong> → <strong style={{ color: "#fff" }}>Adicionar à Tela de Início</strong>
        </div>
      </div>
      <button onClick={dismiss} style={{
        background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8, color: "#888", fontSize: 11, padding: "7px 10px", cursor: "pointer", flexShrink: 0,
      }}>✕</button>
    </>
  );

  if (!visible) return null;

  return banner(
    <>
      <div style={{ fontSize: 32, flexShrink: 0 }}>⚽</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: 0.5 }}>INSTALAR GOL DA SORTE</div>
        <div style={{ color: "#aaa", fontSize: 11, marginTop: 1 }}>Adicione à tela inicial e jogue sempre!</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={dismiss} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, color: "#888", fontSize: 11, padding: "7px 10px", cursor: "pointer",
        }}>Agora não</button>
        <button onClick={handleInstall} style={{
          background: "linear-gradient(135deg, #FFD700, #FF8C00)", border: "none",
          borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 900,
          padding: "7px 14px", cursor: "pointer", letterSpacing: 0.5,
        }}>INSTALAR</button>
      </div>
    </>
  );
}
