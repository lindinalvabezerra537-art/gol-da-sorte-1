import { useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
}

function cameViaInvite() {
  return new URLSearchParams(window.location.search).has("ref");
}

export default function InstallPrompt() {
  useEffect(() => {
    if (isStandalone()) return;

    const fromInvite = cameViaInvite();

    const handler = async (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;

      if (fromInvite) {
        await prompt.prompt();
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return null;
}
