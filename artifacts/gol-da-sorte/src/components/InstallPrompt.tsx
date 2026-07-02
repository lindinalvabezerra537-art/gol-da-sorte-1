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
    if (isStandalone() || isIOS()) return;

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

  // ── Android/Chrome only (iOS suprimido) ──
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
