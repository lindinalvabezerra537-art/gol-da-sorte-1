import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
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
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (installed || !visible) return null;

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
      display: "flex",
      alignItems: "center",
      gap: 12,
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
        <button
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            color: "#888",
            fontSize: 12,
            padding: "8px 10px",
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
            fontSize: 13,
            fontWeight: 900,
            padding: "8px 14px",
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
