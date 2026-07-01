import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: number;
  user_id: number;
  user_name: string;
  user_foto?: string | null;
  message: string;
  created_at: string;
}

interface Props {
  userId: number;
  userName: string;
  userFoto?: string | null;
  onClose: () => void;
}

export default function ChatRoom({ userId, userName, userFoto, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = async () => {
    try {
      const r = await fetch("/api/chat");
      if (r.ok) {
        const data = await r.json();
        setMessages(data.messages ?? []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    // Escuta mensagens em tempo real via SSE do App.tsx
    const onSseMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail as ChatMessage;
      if (detail && detail.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === detail.id)) return prev;
          return [...prev, detail];
        });
      }
    };
    window.addEventListener("sse-chat-message", onSseMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sse-chat-message", onSseMessage);
    };
  }, []);

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, userFoto, message: text }),
      });
      await fetchMessages();
    } catch {}
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0a00, #3d1800)",
        borderBottom: "2px solid #8B4513",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0,
      }}>
        <img
          src="/sala-banner.jpeg"
          style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "2px solid #8B4513" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>
            🎙️ SALA DE BATE-PAPO
          </div>
          <div style={{ color: "#cd853f", fontSize: 11, fontWeight: 600 }}>
            ONDE A CONVERSA ACONTECE
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, color: "#fff", fontSize: 18, width: 36, height: 36,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >✕</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 12px 4px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ color: "#555", textAlign: "center", marginTop: 40, fontSize: 14 }}>
            Nenhuma mensagem ainda. Seja o primeiro a falar! 💬
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.user_id === userId;
          const initials = m.user_name.slice(0, 2).toUpperCase();
          return (
            <div key={m.id} style={{
              display: "flex", flexDirection: isMe ? "row-reverse" : "row",
              alignItems: "flex-end", gap: 8,
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                border: "2px solid #8B4513", overflow: "hidden",
                background: "linear-gradient(135deg, #8B4513, #5c2c0a)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {m.user_foto
                  ? <img src={m.user_foto} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ color: "#FFD700", fontSize: 11, fontWeight: 900 }}>{initials}</span>
                }
              </div>
              {/* Bubble */}
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 2, alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && (
                  <span style={{ color: "#cd853f", fontSize: 10, fontWeight: 700, paddingLeft: 4 }}>
                    {m.user_name.split(" ")[0]}
                  </span>
                )}
                <div style={{
                  background: isMe
                    ? "linear-gradient(135deg, #7c3d00, #5c2c00)"
                    : "rgba(255,255,255,0.07)",
                  border: isMe ? "1px solid #cd853f" : "1px solid rgba(255,255,255,0.10)",
                  borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  padding: "8px 12px",
                  color: "#fff", fontSize: 13, lineHeight: 1.45,
                  wordBreak: "break-word",
                }}>
                  {m.message}
                </div>
                <span style={{ color: "#444", fontSize: 9, paddingInline: 4 }}>
                  {formatTime(m.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "8px 12px 10px",
        background: "rgba(0,0,0,0.85)",
        borderTop: "2px solid #5c2c0a",
        display: "flex", flexDirection: "column", gap: 8,
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escreva sua mensagem aqui..."
          rows={2}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid #8B4513",
            borderRadius: 10,
            color: "#fff",
            fontSize: 14,
            padding: "10px 12px",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onTouchEnd={(e) => { e.preventDefault(); handleSend(); }}
          onClick={handleSend}
          disabled={sending}
          style={{
            background: input.trim() && !sending
              ? "linear-gradient(135deg, #8B4513, #cd853f)"
              : "#333",
            border: "none", borderRadius: 10,
            color: "#fff", fontSize: 15, fontWeight: 900,
            height: 46, width: "100%",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, letterSpacing: 1, textTransform: "uppercase",
            transition: "background 0.2s",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {sending ? "⏳ Enviando..." : "➤ ENVIAR MENSAGEM"}
        </button>
      </div>
    </div>
  );
}
