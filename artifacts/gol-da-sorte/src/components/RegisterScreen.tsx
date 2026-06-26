import { useState, useRef } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace(/^\//, "")
  ? `/${import.meta.env.BASE_URL.replace(/^\/|\/$/g, "")}/api`
  : "/api";

function getApiUrl(path: string) {
  return `${window.location.origin}${API_BASE}${path}`;
}

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

interface Props {
  referralCode?: string;
  onRegistered: (userId: number) => void;
}

const G = {
  bg: "linear-gradient(170deg, #050505 0%, #0e0c00 50%, #050505 100%)",
  gold: "#FFD700",
  orange: "#FF8C00",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,200,0,0.25)",
  borderFocus: "rgba(255,200,0,0.7)",
  text: "#ffffff",
  muted: "#888888",
  error: "#ff5555",
  success: "#55ff88",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)",
  border: `1.5px solid ${G.border}`,
  borderRadius: 12,
  padding: "13px 16px",
  color: G.text,
  fontSize: 15,
  outline: "none",
  transition: "border-color 0.2s",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  color: G.muted,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  display: "block",
  marginBottom: 6,
  textTransform: "uppercase",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function formatPhone(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function RegisterScreen({ referralCode, onRegistered }: Props) {
  const [mode, setMode] = useState<"choice" | "register" | "login">("choice");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [maisDe18, setMaisDe18] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const phoneMatch =
    phoneConfirm.length > 0 && phone === phoneConfirm;
  const phoneMismatch =
    phoneConfirm.length > 0 && phone !== phoneConfirm;

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setFotoPreview(result);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 300;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setFotoBase64(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRegister = async () => {
    setError("");
    if (!fotoBase64) { setError("A foto de perfil é obrigatória. Clique no círculo acima para escolher."); return; }
    if (!name.trim()) { setError("Informe seu nome completo."); return; }
    if (phone.replace(/\D/g, "").length < 10) { setError("Telefone incompleto."); return; }
    if (phone !== phoneConfirm) { setError("Os telefones não conferem."); return; }
    if (!cidade.trim()) { setError("Informe sua cidade."); return; }
    if (!estado) { setError("Selecione seu estado."); return; }
    if (!maisDe18) { setError("Você precisa ter mais de 18 anos para jogar."); return; }
    if (!aceitaTermos) { setError("Aceite os termos para continuar."); return; }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/users/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.replace(/\D/g, ""),
          cidade: cidade.trim(),
          estado,
          fotoBase64: fotoBase64 || undefined,
          referralCode: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar.");
        return;
      }
      localStorage.setItem("golUserId", String(data.user.id));
      onRegistered(data.user.id);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Digite seu telefone completo.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(getApiUrl(`/users/by-phone/${phone.replace(/\D/g, "")}`));
      const data = await res.json();
      if (!res.ok) {
        setError("Telefone não encontrado. Cadastre-se primeiro.");
        return;
      }
      localStorage.setItem("golUserId", String(data.user.id));
      onRegistered(data.user.id);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: G.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
        zIndex: 9999,
        padding: "28px 20px 48px",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>⚽</div>
        <div
          style={{
            color: G.gold,
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 3,
            textShadow: "0 0 24px rgba(255,200,0,0.45)",
          }}
        >
          GOL DA SORTE
        </div>
        {referralCode && (
          <div
            style={{
              marginTop: 12,
              background: "rgba(255,200,0,0.12)",
              border: `1px solid rgba(255,200,0,0.35)`,
              borderRadius: 10,
              padding: "8px 16px",
              color: G.gold,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🎁 Você ganhou <strong>5 jogadas grátis</strong>!
          </div>
        )}
      </div>

      {/* ── CHOICE ── */}
      {mode === "choice" && (
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            onClick={() => setMode("register")}
            style={{
              background: `linear-gradient(135deg, ${G.gold}, ${G.orange})`,
              color: "#000",
              border: "none",
              borderRadius: 14,
              padding: "18px",
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              letterSpacing: 1,
              boxShadow: "0 4px 20px rgba(255,180,0,0.3)",
            }}
          >
            ⚽ CRIAR CONTA
          </button>
          <button
            onClick={() => { setMode("login"); setError(""); setPhone(""); }}
            style={{
              background: "transparent",
              color: G.gold,
              border: `2px solid rgba(255,200,0,0.4)`,
              borderRadius: 14,
              padding: "16px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            JÁ TENHO CONTA
          </button>
        </div>
      )}

      {/* ── CADASTRO ── */}
      {mode === "register" && (
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              color: G.gold,
              fontWeight: 900,
              fontSize: 17,
              textAlign: "center",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            CRIAR CONTA
          </div>

          {/* FOTO DA GALERIA */}
          <Field label="📸 Foto de Perfil (OBRIGATÓRIA)">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: fotoPreview ? "transparent" : "rgba(255,200,0,0.08)",
                  border: fotoPreview ? `3px solid ${G.gold}` : `3px dashed rgba(255,200,0,0.75)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxShadow: fotoPreview ? "0 0 16px rgba(255,200,0,0.4)" : "none",
                }}
              >
                {fotoPreview ? (
                  <img
                    src={fotoPreview}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    alt="foto"
                  />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 34 }}>📸</div>
                    <div style={{ fontSize: 9, color: G.gold, fontWeight: 700 }}>TOQUE AQUI</div>
                  </div>
                )}
              </div>
              <span style={{ color: fotoPreview ? G.success : G.gold, fontSize: 12, fontWeight: 700 }}>
                {fotoPreview ? "✓ Foto adicionada — toque para trocar" : "⚠ Sua foto vira seu peão no jogo!"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFotoChange}
              />
            </div>
          </Field>

          {/* NOME */}
          <Field label="Nome Completo">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              style={fieldStyle}
              autoComplete="name"
            />
          </Field>

          {/* TELEFONE */}
          <Field label="Telefone (WhatsApp)">
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={fieldStyle}
              autoComplete="tel"
            />
          </Field>

          {/* CONFIRMAR TELEFONE */}
          <Field label="Confirmar Telefone">
            <input
              value={phoneConfirm}
              onChange={(e) => setPhoneConfirm(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={{
                ...fieldStyle,
                borderColor: phoneMismatch
                  ? "rgba(255,80,80,0.7)"
                  : phoneMatch
                  ? "rgba(80,255,100,0.7)"
                  : G.border,
              }}
            />
            {phoneMismatch && (
              <span style={{ color: G.error, fontSize: 11, marginTop: 4 }}>
                ✗ Os telefones não conferem
              </span>
            )}
            {phoneMatch && (
              <span style={{ color: G.success, fontSize: 11, marginTop: 4 }}>
                ✓ Telefones conferem
              </span>
            )}
          </Field>

          {/* CIDADE + ESTADO */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="Cidade">
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Salvador"
                  style={fieldStyle}
                />
              </Field>
            </div>
            <div style={{ width: 80 }}>
              <Field label="Estado">
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  style={{
                    ...fieldStyle,
                    padding: "13px 8px",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    textAlign: "center",
                  }}
                >
                  <option value="">UF</option>
                  {ESTADOS_BR.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* CHECKBOXES */}
          <div
            style={{
              background: "rgba(255,200,0,0.05)",
              border: `1px solid rgba(255,200,0,0.2)`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={maisDe18}
                onChange={(e) => setMaisDe18(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: G.gold, flexShrink: 0 }}
              />
              <span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.4 }}>
                Declaro que sou <strong style={{ color: G.gold }}>maior de 18 anos</strong>
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={aceitaTermos}
                onChange={(e) => setAceitaTermos(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: G.gold, flexShrink: 0 }}
              />
              <span style={{ color: "#ccc", fontSize: 13, lineHeight: 1.4 }}>
                Li e aceito os <strong style={{ color: G.gold }}>Termos de Uso</strong> e a{" "}
                <strong style={{ color: G.gold }}>Política de Privacidade</strong>
              </span>
            </label>
          </div>

          {/* ERRO */}
          {error && (
            <div
              style={{
                color: G.error,
                fontSize: 13,
                textAlign: "center",
                padding: "10px 14px",
                background: "rgba(255,60,60,0.08)",
                border: "1px solid rgba(255,60,60,0.2)",
                borderRadius: 10,
              }}
            >
              {error}
            </div>
          )}

          {/* BOTÃO CADASTRAR */}
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              background: loading
                ? "#333"
                : `linear-gradient(135deg, ${G.gold}, ${G.orange})`,
              color: loading ? "#666" : "#000",
              border: "none",
              borderRadius: 14,
              padding: "17px",
              fontSize: 16,
              fontWeight: 900,
              cursor: loading ? "default" : "pointer",
              letterSpacing: 1,
              marginTop: 4,
              boxShadow: loading ? "none" : "0 4px 20px rgba(255,180,0,0.25)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "AGUARDE..." : "CADASTRAR E JOGAR ⚽"}
          </button>

          <button
            onClick={() => { setMode("choice"); setError(""); }}
            style={{
              background: "transparent",
              color: G.muted,
              border: "none",
              fontSize: 13,
              cursor: "pointer",
              padding: "8px",
            }}
          >
            ← Voltar
          </button>
        </div>
      )}

      {/* ── LOGIN ── */}
      {mode === "login" && (
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              color: G.gold,
              fontWeight: 900,
              fontSize: 17,
              textAlign: "center",
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            ENTRAR NA CONTA
          </div>

          <Field label="Seu Telefone Cadastrado">
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={fieldStyle}
              autoComplete="tel"
            />
          </Field>

          {error && (
            <div
              style={{
                color: G.error,
                fontSize: 13,
                textAlign: "center",
                padding: "10px 14px",
                background: "rgba(255,60,60,0.08)",
                border: "1px solid rgba(255,60,60,0.2)",
                borderRadius: 10,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              background: loading
                ? "#333"
                : `linear-gradient(135deg, ${G.gold}, ${G.orange})`,
              color: loading ? "#666" : "#000",
              border: "none",
              borderRadius: 14,
              padding: "17px",
              fontSize: 16,
              fontWeight: 900,
              cursor: loading ? "default" : "pointer",
              letterSpacing: 1,
              boxShadow: loading ? "none" : "0 4px 20px rgba(255,180,0,0.25)",
            }}
          >
            {loading ? "AGUARDE..." : "ENTRAR ⚽"}
          </button>

          <button
            onClick={() => { setMode("choice"); setError(""); }}
            style={{
              background: "transparent",
              color: G.muted,
              border: "none",
              fontSize: 13,
              cursor: "pointer",
              padding: "8px",
            }}
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
