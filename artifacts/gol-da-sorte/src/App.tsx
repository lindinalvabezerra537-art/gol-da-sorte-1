import { useState, useEffect, useCallback, useRef } from "react";
import golDaSorteImg from "@assets/IMG_7715_1780523556282.jpeg";
import RegisterScreen from "./components/RegisterScreen";
import PurchaseModal from "./components/PurchaseModal";
import InviteScreen from "./components/InviteScreen";
import InstallPrompt from "./components/InstallPrompt";
import AdminPanel from "./components/AdminPanel";
import ChatRoom from "./components/ChatRoom";
import BoardEditor from "./components/BoardEditor";
import MapaBrasil from "./components/MapaBrasil";
import EditPhotoModal from "./components/EditPhotoModal";
import RankingPodium from "./components/RankingPodium";
import { playZoneSound, playHorrorScream, playChampionFanfare } from "./sounds";

// ── Image dimensions ──
const GOL_W = 1125, GOL_H = 2175;   // Gol da Sorte image
const PIRATA_W = 694, PIRATA_H = 1280; // Fantasy board image
const NAT_W = GOL_W;
const NAT_H = GOL_H;
const NAT_RATIO = NAT_W / NAT_H;

const DEBUG = false;
const TOUCH_CALIB = false;

// ── Calibrated UI positions (pixel scan confirmed) ──
// JOGADAS number "12":   x=786-881 (xF=0.699-0.783), y=240-274 (yF=0.110-0.126)
// CONVIDAR AGORA button: x=764-1000 (xF=0.679-0.889), y=1286-1310 (yF=0.591-0.602)
const UI = {
  jogadasNum:   { x: 0.675, y: 0.188, w: 0.130, h: 0.048 },  // real counter overlay
  jogadasPlus:  { x: 0.795, y: 0.188, w: 0.080, h: 0.048 },  // "+" buy button
  convidar:     { x: 0.608, y: 0.569, w: 0.272, h: 0.052 },  // CONVIDAR AGORA button
};

type RowDef = { y: [number, number]; x: [number, number][]; label: string };

interface WinnerCard { nome: string; cidadeEstado: string; valor: string; foto: string; }

function WinnerCell({ w, onClick }: { w: WinnerCard; onClick: () => void }) {
  const firstName = (w.nome || "").split(" ")[0] || "—";
  return (
    <div
      onClick={onClick}
      style={{ width: "50%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 2px", gap: 2, boxSizing: "border-box", cursor: "pointer" }}
    >
      <div style={{ width: 36, height: 48, borderRadius: 4, overflow: "hidden", border: "1.5px solid rgba(255,215,0,0.7)", flexShrink: 0, background: "#1a1a30", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {w.foto
          ? <img src={w.foto} style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }} />
          : <span style={{ fontSize: 13, lineHeight: 1 }}>👤</span>}
      </div>
      <span style={{ color: "#fff", fontSize: 9, fontWeight: 800, lineHeight: 1.1, textAlign: "center", width: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{firstName}</span>
      <span style={{ color: "#FFD700", fontSize: 8, fontWeight: 700, lineHeight: 1, textAlign: "center" }}>R${w.valor || "—"}</span>
    </div>
  );
}

const ROWS: RowDef[] = [
  { label: "R0", y: [0.771, 0.855], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R1", y: [0.661, 0.745], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R2", y: [0.551, 0.635], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
  { label: "R3", y: [0.434, 0.518], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R4", y: [0.324, 0.408], x: [[0.183, 0.330], [0.327, 0.434], [0.435, 0.544]] },
  { label: "R5", y: [0.220, 0.304], x: [[0.086, 0.191], [0.200, 0.304], [0.313, 0.415]] },
];

const DEFAULT_ROW_WRONG_COUNT = [1, 1, 2, 2, 2, 1];
const ROW_COLORS = ["#ff0", "#0ff", "#0f0", "#f80", "#f0f", "#fff"];
const TOTAL_ROWS = ROWS.length;

// ── Caminho do tabuleiro pirata ──────────────────────────────────────────────
// Coordenadas do CENTRO de cada casa, normalizadas (0-1), imagem 713×1280px.
// Traçado a partir da análise visual da imagem: INÍCIO (0) → TOP VIRAL (53).
const N_TILES = 81;
const PIRATE_PATH_DEFAULT: { x: number; y: number; label?: number }[] = Array.from({ length: N_TILES }, (_, i) => ({
  x: 0.02 + (i / (N_TILES - 1)) * 0.96,
  y: 0.5,
}));


function randomWrongBalls(counts = DEFAULT_ROW_WRONG_COUNT): number[][] {
  return counts.map(wrongCount => {
    const pool = [0, 1, 2];
    const wrong: number[] = [];
    const clampedCount = Math.min(wrongCount, 2);
    for (let i = 0; i < clampedCount; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      wrong.push(pool.splice(idx, 1)[0]);
    }
    return wrong;
  });
}

function generateR5PrizeBalls(wrongBalls: number[][], prizeBallCount: number): number[] {
  const r5Bombs = wrongBalls[5] || [];
  const safeBalls = [0, 1, 2].filter(b => !r5Bombs.includes(b));
  const count = Math.min(Math.max(0, prizeBallCount), safeBalls.length);
  const shuffled = [...safeBalls].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

type Bounds = { x: number; y: number; w: number; h: number };

function calcBounds(natW = NAT_W, natH = NAT_H): Bounds {
  const ratio = natW / natH;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const conRatio = vw / vh;
  let w: number, h: number, x: number, y: number;
  if (conRatio > ratio) {
    h = vh; w = h * ratio; x = (vw - w) / 2; y = 0;
  } else {
    w = vw; h = w / ratio; x = 0; y = (vh - h) / 2;
  }
  return { x, y, w, h };
}

function getAudioCtx() {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function playClickSound() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(); osc.stop(ctx.currentTime + 0.12);
}

function playCorrectSound() {
  const ctx = getAudioCtx();
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
    g.gain.setValueAtTime(1.0, ctx.currentTime + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.15);
    osc.start(ctx.currentTime + i * 0.09);
    osc.stop(ctx.currentTime + i * 0.09 + 0.15);
  });
}

function playBombSound() {
  const ctx = getAudioCtx();
  const sr = ctx.sampleRate; const dur = 0.7;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.5);
  }
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(600, ctx.currentTime);
  lpf.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + dur);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(3.5, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  noise.connect(lpf); lpf.connect(noiseGain); noiseGain.connect(ctx.destination);
  noise.start(); noise.stop(ctx.currentTime + dur);
  const sub = ctx.createOscillator(); const subGain = ctx.createGain();
  sub.connect(subGain); subGain.connect(ctx.destination); sub.type = "sine";
  sub.frequency.setValueAtTime(120, ctx.currentTime);
  sub.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.5);
  subGain.gain.setValueAtTime(3.0, ctx.currentTime);
  subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
  sub.start(); sub.stop(ctx.currentTime + 0.55);
  const crack = ctx.createOscillator(); const crackGain = ctx.createGain();
  crack.connect(crackGain); crackGain.connect(ctx.destination); crack.type = "sawtooth";
  crack.frequency.setValueAtTime(300, ctx.currentTime);
  crack.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.06);
  crackGain.gain.setValueAtTime(2.5, ctx.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  crack.start(); crack.stop(ctx.currentTime + 0.06);
}

function playFanfareSound(big: boolean) {
  const ctx = getAudioCtx();
  const notes = big
    ? [392, 523, 659, 784, 1047]
    : [392, 523, 659, 784];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc.type = "sawtooth"; osc2.type = "square";
    const t = ctx.currentTime + i * 0.18;
    osc.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 0.5, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.3);
    osc2.start(t); osc2.stop(t + 0.28);
  });
  if (big) {
    const sr = ctx.sampleRate; const dur = 0.25;
    const buf = ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const snareG = ctx.createGain();
    snareG.gain.setValueAtTime(0.8, ctx.currentTime + notes.length * 0.18);
    noise.connect(snareG); snareG.connect(ctx.destination);
    noise.start(ctx.currentTime + notes.length * 0.18);
  }
}

function playMegaFanfare() {
  const ctx = getAudioCtx();
  // Epic trumpet fanfare: two rising phrases + final chord
  const phrase = [
    { freq: 523, t: 0.00, dur: 0.18 },
    { freq: 659, t: 0.20, dur: 0.18 },
    { freq: 784, t: 0.40, dur: 0.18 },
    { freq: 1047, t: 0.60, dur: 0.35 },
    { freq: 784, t: 1.05, dur: 0.12 },
    { freq: 880, t: 1.20, dur: 0.12 },
    { freq: 988, t: 1.35, dur: 0.12 },
    { freq: 1175, t: 1.50, dur: 0.55 },
  ];
  phrase.forEach(({ freq, t, dur }) => {
    ["sawtooth", "square"].forEach((type, j) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq * (j === 1 ? 0.5 : 1), ctx.currentTime + t);
      const vol = j === 0 ? 0.45 : 0.15;
      g.gain.setValueAtTime(0, ctx.currentTime + t);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur + 0.05);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + dur + 0.1);
    });
  });
  // Final chord at 2.2s
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + 2.2);
    g.gain.setValueAtTime(0.3 - i * 0.05, ctx.currentTime + 2.2);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.2);
    osc.start(ctx.currentTime + 2.2);
    osc.stop(ctx.currentTime + 3.3);
  });
  // Snare rolls
  [0.0, 0.6, 1.5, 2.2].forEach(t => {
    const sr = ctx.sampleRate; const dur = 0.18;
    const buf = ctx.createBuffer(1, sr * dur, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const g = ctx.createGain(); g.gain.setValueAtTime(1.2, ctx.currentTime + t);
    n.connect(g); g.connect(ctx.destination);
    n.start(ctx.currentTime + t); n.stop(ctx.currentTime + t + dur);
  });
}

function getFemaleVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const female = voices.find(v =>
    v.lang.toLowerCase().startsWith("pt") &&
    (/female|feminina|maria|luciana|francisca|helena/i.test(v.name) || /google.*pt/i.test(v.name))
  );
  return female || voices.find(v => v.lang.toLowerCase().startsWith("pt")) || null;
}

function estadoNome(sigla: string): string {
  const map: Record<string, string> = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
    CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
    MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
    PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
    RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
    RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
    SE: "Sergipe", TO: "Tocantins",
  };
  const s = sigla.trim().toUpperCase();
  return map[s] || sigla;
}

function speakMessage(text: string, delayMs = 1400) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = getFemaleVoice();
  if (voice) utter.voice = voice;
  utter.lang = "pt-BR";
  utter.rate = 0.88;
  utter.pitch = 1.1;
  utter.volume = 1.0;
  if (delayMs > 0) {
    setTimeout(() => window.speechSynthesis.speak(utter), delayMs);
  } else {
    window.speechSynthesis.speak(utter);
  }
}

async function apiCall(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getReferralCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("ref");
}

export default function App() {
  const [showGolDaSorte, setShowGolDaSorte] = useState(true);
  const showGolDaSorteRef = useRef(false);
  const [bounds, setBounds] = useState<Bounds>(() => calcBounds(PIRATA_W, PIRATA_H));
  const [gameActive, setGameActive] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [wrongBalls, setWrongBalls] = useState<number[][]>(randomWrongBalls);
  const [errorBall, setErrorBall] = useState<{ row: number; ball: number } | null>(null);
  const [justOkBall, setJustOkBall] = useState<{ row: number; ball: number } | null>(null);
  const [correctPicks, setCorrectPicks] = useState<{ row: number; ball: number }[]>([]);
  const [jogarLit, setJogarLit] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [calibTaps, setCalibTaps] = useState<{ xF: string; yF: string }[]>([]);

  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem("golUserId");
    return stored ? parseInt(stored) : null;
  });
  const [playsRemaining, setPlaysRemaining] = useState<number>(0);
  const playsRemainingRef = useRef<number>(0);
  const [jogadasPop, setJogadasPop] = useState(false);
  const prevPlaysRef = useRef<number | null>(null);
  const emptyWinner: WinnerCard = { nome: "", cidadeEstado: "", valor: "", foto: "" };
  const [ganhadores, setGanhadores] = useState<WinnerCard[]>([emptyWinner, emptyWinner, emptyWinner, emptyWinner]);
  const [selectedWinner, setSelectedWinner] = useState<WinnerCard | null>(null);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [rankingData, setRankingData] = useState<{ cidade?: any[]; estado?: any[]; brasil?: any[]; myCity?: string; myState?: string } | null>(null);
  const [rankingMyPosition, setRankingMyPosition] = useState<{ cidadeRank: number; estadoRank: number; brasilRank: number; points: number } | null>(null);
  const [seguindoRanking, setSeguindoRanking] = useState<{ cidade: boolean; estado: boolean; brasil: boolean }>({ cidade: false, estado: false, brasil: false });
  const [showRankingEntryModal, setShowRankingEntryModal] = useState(false);
  const [rankingEntryScope, setRankingEntryScope] = useState<"cidade" | "estado" | "brasil" | null>(null);
  const [rankingLinkInput, setRankingLinkInput] = useState("");
  const [referralUnlocked, setReferralUnlocked] = useState(false);
  const [totalFriends, setTotalFriends] = useState<number>(0);
  const [valorAcumulado, setValorAcumulado] = useState<string>("0,00");
  const [showAdmin, setShowAdmin] = useState(() =>
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash === "#admin"
  );
  const [piratePath, setPiratePath] = useState(() => PIRATE_PATH_DEFAULT);
  const [pirateChampionIdx, setPirateChampionIdx] = useState(PIRATE_PATH_DEFAULT.length - 1);
  const [piratePathLoaded, setPiratePathLoaded] = useState(false);
  const [isPhoneAdmin, setIsPhoneAdmin] = useState(false);
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ultimoGanhador, setUltimoGanhador] = useState<{
    nome: string; cidadeEstado: string; valor: string; foto: string;
  } | null>(null);
  const [atualCampeao, setAtualCampeao] = useState<{
    nome: string; cidadeEstado: string; foto: string; linkSocial: string; userId: string;
  } | null>(null);
  const prevCampeaoUserId = useRef<string>("");
  const announcingCampeaoRef = useRef<string>("");
  const [showChampionModal, setShowChampionModal] = useState(false);
  const [championLinkInput, setChampionLinkInput] = useState("");
  const [showChampionFollowModal, setShowChampionFollowModal] = useState(false);
  const [hasClickedChampionLink, setHasClickedChampionLink] = useState(false);
  const [championFollowClaimed, setChampionFollowClaimed] = useState(
    () => localStorage.getItem("claimedChampionUserId") || ""
  );
  const [userInfo, setUserInfo] = useState<{ name: string; cidade: string; estado: string; fotoBase64?: string | null; rankingSocialLink?: string | null } | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showInviteScreen, setShowInviteScreen] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bonusCelebration, setBonusCelebration] = useState<{ amount: number; big: boolean } | null>(null);
  const [broadcastModal, setBroadcastModal] = useState<string | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showEditPhoto, setShowEditPhoto] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promoConfig, setPromoConfig] = useState({
    ativa: true,
    titulo: "GANHE 100 JOGADAS GRÁTIS",
    meta1Indicacoes: "20",
    meta1Jogadas: "50",
    meta2Indicacoes: "30",
    meta2Dias: "30",
    meta2Jogadas: "100",
    bonusPorIndicacao: "3",
  });

  const rowWrongCountsRef = useRef<number[]>([...DEFAULT_ROW_WRONG_COUNT]);
  const gameConfigRef = useRef({
    r5PrizeType: "jogadas" as "jogadas" | "brinde",
    r5PrizeValue: "50",
    r5PrizeBallCount: 2,
    bonusRow3: 1,
    bonusRow4: 5,
    bonusRow5: 50,
  });
  const r5PrizeBallsRef = useRef<number[]>([]);
  const [showBrindeModal, setShowBrindeModal] = useState(false);
  const [brindeText, setBrindeText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<{ id: number; name: string; cidade: string; fotoBase64?: string | null }[]>([]);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [chatMsgCount, setChatMsgCount] = useState(0);

  // ── Par de dados — tabuleiro pirata ────────────────────────────────────────
  const [piratePos, setPiratePos] = useState(0);
  const [pirateTargetPos, setPirateTargetPos] = useState<number | null>(null);
  const [pirateAnimPos, setPirateAnimPos] = useState<number | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<{ id: number; name: string; fotoBase64: string | null; piratePos: number }[]>([]);
  const [diceValues, setDiceValues] = useState<[number, number] | null>(null);
  const [dicePhase, setDicePhase] = useState<"idle" | "rolling" | "choosing" | "moving">("idle");
  const [diceAnim, setDiceAnim] = useState<[number, number]>([1, 1]);

  const referralCodeFromUrl = getReferralCodeFromUrl();
  // Só mostra o botão Admin para quem acessou com ?admin=1 na URL
  const isAdminMode = useRef(
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.location.hash === "#admin"
  ).current;

  const [showBoardEditor, setShowBoardEditor] = useState(
    () => new URLSearchParams(window.location.search).get("editor") === "1"
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Lógica dos dados ────────────────────────────────────────────────────────
  const handleRollDice = () => {
    if (dicePhase !== "idle") return;
    setDicePhase("rolling");
    // Animação de sorteio rápido
    let ticks = 0;
    const iv = setInterval(() => {
      setDiceAnim([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
      ticks++;
      if (ticks >= 10) {
        clearInterval(iv);
        const d1 = Math.ceil(Math.random() * 6) as 1|2|3|4|5|6;
        const d2 = Math.ceil(Math.random() * 6) as 1|2|3|4|5|6;
        setDiceValues([d1, d2]);
        setDiceAnim([d1, d2]);
        setDicePhase("choosing");
      }
    }, 80);
  };

  const handleChooseDie = (value: number) => {
    if (dicePhase !== "choosing") return;
    setDicePhase("moving");
    const newPos = Math.min(piratePos + value, pirateChampionIdx);
    setDiceValues(null);
    setPirateTargetPos(newPos);
    setPirateAnimPos(piratePos);

    // Animação passo a passo: o peão anda casa por casa
    let currentStep = piratePos;
    const stepInterval = setInterval(() => {
      currentStep += 1;
      if (currentStep >= newPos) {
        clearInterval(stepInterval);
        setPirateAnimPos(newPos);
        finishMove(newPos);
      } else {
        setPirateAnimPos(currentStep);
        // Som de passo
        try { playZoneSound(currentStep); } catch {}
      }
    }, 400);
  };

  const finishMove = (newPos: number) => {
    // Som da zona final
    try { playZoneSound(newPos); } catch {}

    // Knockback: se outro jogador estiver na mesma casa,
    // o jogador que JÁ ESTAVA lá é derrubado para o início
    const otherAtDest = otherPlayers.find(p => p.piratePos === newPos);
    if (otherAtDest) {
      try { playHorrorScream(); } catch {}
      showToast("💀 Você derrubou um jogador da casa!");
      // Derruba o jogador que já estava na casa
      setOtherPlayers(prev =>
        prev.map(p =>
          p.id === otherAtDest.id ? { ...p, piratePos: 0 } : p
        )
      );
      fetch(`/api/users/${otherAtDest.id}/pirate-pos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos: 0 }),
      }).catch(() => {});
      // Envia mensagem no chat para todos verem
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || 0,
          userName: userInfo?.name || "Sistema",
          message: `💀 ${otherAtDest.name} foi derrubado da casa ${newPos + 1} e voltou para o início!`,
        }),
      }).catch(() => {});
    }

    setPiratePos(newPos);
    setPirateAnimPos(null);
    setPirateTargetPos(null);

    // Salvar posição no servidor
    if (userId) {
      fetch(`/api/users/${userId}/pirate-pos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pos: newPos }),
      }).catch(() => {});
    }

    if (newPos >= pirateChampionIdx) {
      try { playChampionFanfare(); } catch {}
      setTimeout(() => {
        showToast("👑 Você chegou à coroa! Campeão!");
        setPiratePos(0);
        if (userId) {
          fetch(`/api/users/${userId}/pirate-pos`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pos: 0 }),
          }).catch(() => {});
        }
        setDicePhase("idle");
      }, 1200);
    } else {
      setTimeout(() => setDicePhase("idle"), 600);
    }
  };

  const triggerBonus = useCallback(async (amount: number) => {
    const big = amount >= 5;
    playFanfareSound(big);
    setBonusCelebration({ amount, big });
    // Update counter immediately (optimistic)
    setPlaysRemaining(prev => prev + amount);
    if (userId) {
      const data = await apiCall(`/users/${userId}/credit-plays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      // Confirm with server value
      if (data?.user) setPlaysRemaining(data.user.playsRemaining);
    }
    setTimeout(() => setBonusCelebration(null), 3500);
  }, [userId]);

  const triggerMegaBonus = useCallback(async () => {
    const cfg = gameConfigRef.current;
    const isJogadas = cfg.r5PrizeType !== "brinde";
    const plays = isJogadas ? (cfg.bonusRow5 || 50) : 0;
    playMegaFanfare();
    if (isJogadas) {
      speakMessage("Parabéns! Você acaba de ganhar 50 jogadas e 50 pontos para o ranking!");
      showToast("🎉 +50 jogadas e +50 pts no ranking!");
    } else {
      speakMessage("Parabéns! Você acabou de ganhar um brinde incrível!");
      setBrindeText(cfg.r5PrizeValue);
      setShowBrindeModal(true);
    }
    if (plays > 0) {
      setPlaysRemaining(prev => prev + plays);
      if (userId) {
        const [playData, rankingData] = await Promise.all([
          apiCall(`/users/${userId}/credit-plays`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: plays }),
          }),
          apiCall(`/users/${userId}/credit-ranking-points`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: 50 }),
          }),
        ]);
        if (playData?.user) setPlaysRemaining(playData.user.playsRemaining);
        if (rankingData?.user?.rankingPoints !== undefined) {
          setRankingMyPosition(prev => prev ? { ...prev, points: rankingData.user.rankingPoints } : prev);
        }
      }
    }
    setTimeout(async () => {
      const link = userInfo?.rankingSocialLink || "";
      if (link && userId && userInfo) {
        await apiCall("/settings/atual-campeao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: userInfo.name,
            cidadeEstado: `${userInfo.cidade} - ${userInfo.estado}`,
            foto: userInfo.fotoBase64 || "",
            linkSocial: link,
            userId: String(userId),
          }),
        });
        setAtualCampeao({
          nome: userInfo.name,
          cidadeEstado: `${userInfo.cidade} - ${userInfo.estado}`,
          foto: userInfo.fotoBase64 || "",
          linkSocial: link,
          userId: String(userId),
        });
        setChampionFollowClaimed(String(userId));
        localStorage.setItem("claimedChampionUserId", String(userId));
        showToast("🏆 Você agora é o Atual Campeão!");
        // Espera "Parabéns!" terminar (~7.5s) + 1s de pausa antes de anunciar
        const localTTS = `cidade de ${userInfo.cidade}, estado de ${estadoNome(userInfo.estado)}`;
        speakMessage(`Atenção! Nova performance! ${userInfo.name}, ${localTTS}. Siga o novo campeão e ganhe 3 jogadas e 5 pontos para o ranking!`);
        // Marca como anunciado para evitar duplo no polling
        prevCampeaoUserId.current = String(userId);
        announcingCampeaoRef.current = String(userId);
      } else {
        setShowChampionModal(true);
      }
    }, 9000);
  }, [userId, championLinkInput, userInfo]);

  const reCalc = useCallback(() => {
    const mode = showGolDaSorteRef.current;
    setBounds(calcBounds(mode ? GOL_W : PIRATA_W, mode ? GOL_H : PIRATA_H));
  }, []);
  useEffect(() => {
    showGolDaSorteRef.current = showGolDaSorte;
    reCalc();
  }, [showGolDaSorte, reCalc]);

  useEffect(() => {
    window.addEventListener("resize", reCalc);
    window.visualViewport?.addEventListener("resize", reCalc);
    return () => {
      window.removeEventListener("resize", reCalc);
      window.visualViewport?.removeEventListener("resize", reCalc);
    };
  }, [reCalc]);

  const fetchSettings = useCallback(() => {
    Promise.all([
      apiCall("/settings/valor-acumulado"),
      apiCall("/settings/ultimo-ganhador"),
      apiCall("/settings/broadcast"),
      apiCall("/settings/promocao"),
      apiCall("/settings/ultimos-ganhadores"),
      apiCall("/settings/atual-campeao"),
      apiCall("/settings/game-config"),
      apiCall("/settings/pirate-path"),
    ]).then(([valorData, ugData, broadcastData, promoData, ganhadoresData, campeaoData, gameConfigData, piratePathData]) => {
      if (valorData?.valor) {
        const num = parseFloat(valorData.valor.replace(",", "."));
        if (!isNaN(num)) {
          setValorAcumulado(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
      if (ugData) {
        setUltimoGanhador({
          nome: ugData.nome ?? "",
          cidadeEstado: ugData.cidadeEstado ?? "",
          valor: ugData.valor ?? "",
          foto: ugData.foto ?? "",
        });
      }
      if (broadcastData?.broadcastId && broadcastData.message) {
        const seen = localStorage.getItem("seenBroadcastId");
        if (seen !== broadcastData.broadcastId) {
          setBroadcastModal(broadcastData.message);
        }
      }
      if (promoData) {
        setPromoConfig({
          ativa: promoData.ativa !== false,
          titulo: promoData.titulo || "GANHE 100 JOGADAS GRÁTIS",
          meta1Indicacoes: promoData.meta1Indicacoes || "20",
          meta1Jogadas: promoData.meta1Jogadas || "50",
          meta2Indicacoes: promoData.meta2Indicacoes || "30",
          meta2Dias: promoData.meta2Dias || "30",
          meta2Jogadas: promoData.meta2Jogadas || "100",
          bonusPorIndicacao: promoData.bonusPorIndicacao || "3",
        });
      }
      if (Array.isArray(ganhadoresData) && ganhadoresData.length === 4) {
        setGanhadores(ganhadoresData);
      }
      if (campeaoData) {
        const newUserId = campeaoData.userId ?? "";
        const newNome = campeaoData.nome ?? "";
        const newCidadeEstado = campeaoData.cidadeEstado ?? "";
        setAtualCampeao({
          nome: newNome,
          cidadeEstado: newCidadeEstado,
          foto: campeaoData.foto ?? "",
          linkSocial: campeaoData.linkSocial ?? "",
          userId: newUserId,
        });
        if (newUserId && newNome && prevCampeaoUserId.current !== newUserId && announcingCampeaoRef.current !== newUserId) {
          announcingCampeaoRef.current = newUserId;
          const partsTTS = newCidadeEstado.split(/[-/]/).map((s: string) => s.trim());
          const cidadeTTS = partsTTS[0] ?? "";
          const estadoTTS = partsTTS[1] ?? "";
          const localTTS = cidadeTTS && estadoTTS
            ? `cidade de ${cidadeTTS}, estado de ${estadoNome(estadoTTS)}`
            : newCidadeEstado;
          speakMessage(`Atenção! Nova performance! ${newNome}, ${localTTS}. Siga o novo campeão e ganhe 3 jogadas e 5 pontos para o ranking!`, 0);
        }
        prevCampeaoUserId.current = newUserId;
      }
      if (gameConfigData) {
        if (Array.isArray(gameConfigData.rowWrongCounts) && gameConfigData.rowWrongCounts.length === 6) {
          rowWrongCountsRef.current = gameConfigData.rowWrongCounts;
        }
        gameConfigRef.current = {
          r5PrizeType: gameConfigData.r5PrizeType || "jogadas",
          r5PrizeValue: "50",
          r5PrizeBallCount: gameConfigData.r5PrizeBallCount ?? 2,
          bonusRow3: gameConfigData.bonusRow3 ?? 1,
          bonusRow4: gameConfigData.bonusRow4 ?? 5,
          bonusRow5: 50,
        };
      }
      if (Array.isArray(piratePathData?.path) && piratePathData.path.length > 0) {
        const loaded = piratePathData.path;
        // O campeão fica sempre na última tile REAL salva pelo servidor
        setPirateChampionIdx(loaded.length - 1);
        let finalPath: { x: number; y: number }[];
        if (loaded.length >= N_TILES) {
          finalPath = loaded.slice(0, N_TILES);
        } else {
          const lastPt = loaded[loaded.length - 1] ?? { x: 0.5, y: 0.5 };
          const extra = Array.from({ length: N_TILES - loaded.length }, (_, i) => ({
            x: Math.min(1, lastPt.x + (i + 1) * 0.015),
            y: lastPt.y,
          }));
          finalPath = [...loaded, ...extra];
        }
        setPiratePath(finalPath);
      }
    });
  }, []);

  // Load pirate path from JSON file (survives project transfers) before server fetch
  useEffect(() => {
    if (piratePathLoaded) return;
    fetch("/pirate_path.json")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPiratePath(data);
          setPirateChampionIdx(data.length - 1);
        }
        setPiratePathLoaded(true);
      })
      .catch(() => setPiratePathLoaded(true));
  }, []);

  useEffect(() => {
    fetchSettings();
    // Polling leve do campeão para anúncio em tempo real a cada 3s
    const pollChamp = setInterval(() => {
      apiCall("/settings/atual-campeao").then((campeaoData: any) => {
        if (campeaoData) {
          const newUserId = campeaoData.userId ?? "";
          const newNome = campeaoData.nome ?? "";
          const newCidadeEstado = campeaoData.cidadeEstado ?? "";
          setAtualCampeao({
            nome: newNome,
            cidadeEstado: newCidadeEstado,
            foto: campeaoData.foto ?? "",
            linkSocial: campeaoData.linkSocial ?? "",
            userId: newUserId,
          });
          if (newUserId && newNome && prevCampeaoUserId.current !== newUserId && announcingCampeaoRef.current !== newUserId) {
            announcingCampeaoRef.current = newUserId;
            const partsTTS = newCidadeEstado.split(/[-/]/).map((s: string) => s.trim());
            const cidadeTTS = partsTTS[0] ?? "";
            const estadoTTS = partsTTS[1] ?? "";
            const localTTS = cidadeTTS && estadoTTS
              ? `cidade de ${cidadeTTS}, estado de ${estadoNome(estadoTTS)}`
              : newCidadeEstado;
            speakMessage(`Atenção! Nova performance! ${newNome}, ${localTTS}. Siga o novo campeão e ganhe 3 jogadas e 5 pontos para o ranking!`, 0);
          }
          prevCampeaoUserId.current = newUserId;
        }
      });
    }, 3_000);
    return () => clearInterval(pollChamp);
  }, [fetchSettings]);

  useEffect(() => {
    const fetchOnline = () => {
      fetch("/api/users/online")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.users) setOnlineUsers(data.users); })
        .catch(() => {});
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Polling de posições dos outros jogadores (multiplayer) ──────────────────
  useEffect(() => {
    if (!userId) return;
    const fetchPositions = () => {
      fetch("/api/users/pirate-positions")
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.users) {
            const allUsers = data.users as { id: number; name: string; fotoBase64: string | null; piratePos: number }[];
            const me = allUsers.find(u => u.id === userId);
            if (me && me.piratePos === 0 && piratePos !== 0 && !pirateTargetPos) {
              try { playHorrorScream(); } catch {}
              showToast("💀 Você foi derrubado e voltou para o início!");
              setPiratePos(0);
            }
            const others = allUsers.filter(u => u.id !== userId);
            setOtherPlayers(others);
          }
        })
        .catch(() => {});
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 2_000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const beat = () => {
      fetch(`/api/users/heartbeat/${userId}`, { method: "POST" }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 90_000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const fetchChatCount = () => {
      fetch("/api/chat")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.messages) setChatMsgCount(data.messages.length); })
        .catch(() => {});
    };
    fetchChatCount();
    const interval = setInterval(fetchChatCount, 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    playsRemainingRef.current = playsRemaining;
    if (prevPlaysRef.current !== null && prevPlaysRef.current !== playsRemaining) {
      setJogadasPop(true);
      const t = setTimeout(() => setJogadasPop(false), 400);
      prevPlaysRef.current = playsRemaining;
      return () => clearTimeout(t);
    }
    prevPlaysRef.current = playsRemaining;
    return undefined;
  }, [playsRemaining]);

  useEffect(() => {
    if (!userId) { setUserLoaded(true); return; }
    Promise.all([
      apiCall(`/users/${userId}`),
      apiCall(`/users/${userId}/referral-info`),
      apiCall(`/admin/check-admin-phone?userId=${userId}`),
    ]).then(([userData, referralData, adminCheck]) => {
      if (userData?.user) {
        setPlaysRemaining(userData.user.playsRemaining);
        setReferralUnlocked(userData.user.referralUnlocked);
        setUserInfo({ name: userData.user.name, cidade: userData.user.cidade, estado: userData.user.estado, fotoBase64: userData.user.fotoBase64, rankingSocialLink: userData.user.rankingSocialLink });
        // Buscar ranking
        const city = userData.user.cidade;
        const state = userData.user.estado;
        if (city && state) {
          Promise.all([
            apiCall(`/users/ranking/cidade/${encodeURIComponent(city)}`),
            apiCall(`/users/ranking/estado/${encodeURIComponent(state)}`),
            apiCall(`/users/ranking/brasil`),
            apiCall(`/users/${userId}/ranking`),
            apiCall(`/users/${userId}/seguidos`),
          ]).then(([cData, eData, bData, myData, segData]) => {
            setRankingData({
              cidade: cData?.users?.slice(0, 3),
              estado: eData?.users?.slice(0, 3),
              brasil: bData?.users?.slice(0, 3),
              myCity: city,
              myState: state,
            });
            if (myData?.user) {
              setRankingMyPosition({
                cidadeRank: myData.cidadeRank,
                estadoRank: myData.estadoRank,
                brasilRank: myData.brasilRank,
                points: myData.user.rankingPoints,
              });
            }
            const seguidos: number[] = segData?.seguidos || [];
            const cidTop = cData?.users?.[0]?.id;
            const estTop = eData?.users?.[0]?.id;
            const braTop = bData?.users?.[0]?.id;
            setSeguindoRanking({
              cidade: cidTop && seguidos.includes(cidTop),
              estado: estTop && seguidos.includes(estTop),
              brasil: braTop && seguidos.includes(braTop),
            });
          }).catch(() => {});
        }
      } else {
        localStorage.removeItem("golUserId");
        setUserId(null);
      }
      if (referralData?.totalFriends !== undefined) {
        setTotalFriends(referralData.totalFriends);
      }
      if (adminCheck?.isAdmin) {
        setIsPhoneAdmin(true);
      }
      setUserLoaded(true);
    });
  }, [userId]);

  // ── Overlay helper: positions an element over a fraction of the rendered image ──
  const ov = (xF: number, yF: number, wF: number, hF: number): React.CSSProperties => ({
    position: "absolute",
    left: bounds.x + bounds.w * xF,
    top:  bounds.y + bounds.h * yF,
    width:  bounds.w * wF,
    height: bounds.h * hF,
  });

  const handleCalibTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (!TOUCH_CALIB) return;
    let clientX: number, clientY: number;
    if ("changedTouches" in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
    } else if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
    }
    const xF = ((clientX - bounds.x) / bounds.w).toFixed(3);
    const yF = ((clientY - bounds.y) / bounds.h).toFixed(3);
    setCalibTaps(prev => [{ xF, yF }, ...prev].slice(0, 8));
  };

  const handleJogar = async () => {
    if (TOUCH_CALIB || !userId) return;
    if (gameActive) return;
    if (playsRemaining <= 0) { setShowPurchaseModal(true); return; }

    playClickSound();
    setJogarLit(true);
    setTimeout(() => setJogarLit(false), 400);

    const newWrong = randomWrongBalls(rowWrongCountsRef.current);
    setWrongBalls(newWrong);
    const newPrize = generateR5PrizeBalls(newWrong, gameConfigRef.current.r5PrizeBallCount);
    r5PrizeBallsRef.current = newPrize;
    setCurrentRow(0); setErrorBall(null); setJustOkBall(null);
    setCorrectPicks([]); lockedRef.current = false; setLocked(false); setGameActive(true);
  };

  const handleBallClick = async (rowIdx: number, ballIdx: number) => {
    if (!gameActive || rowIdx !== currentRow || lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    if (wrongBalls[rowIdx].includes(ballIdx)) {
      playBombSound();
      setErrorBall({ row: rowIdx, ball: ballIdx });

      // Desconta 1 jogada ao errar
      if (userId) {
        const data = await apiCall(`/users/${userId}/use-play`, { method: "POST" });
        if (data?.user) {
          setPlaysRemaining(data.user.playsRemaining);
          if (data.user.referralUnlocked && !referralUnlocked) {
            setReferralUnlocked(true);
            showToast("🎉 INDIQUE AMIGOS desbloqueado!");
          }
        }
      }

      setTimeout(() => {
        setErrorBall(null); setJustOkBall(null);
        setCorrectPicks([]); setCurrentRow(0);
        const newWrong2 = randomWrongBalls(rowWrongCountsRef.current);
        setWrongBalls(newWrong2);
        r5PrizeBallsRef.current = generateR5PrizeBalls(newWrong2, gameConfigRef.current.r5PrizeBallCount);
        lockedRef.current = false;
        setLocked(false);
        if (playsRemainingRef.current > 0) {
          setGameActive(true);
        } else {
          setGameActive(false);
          setShowPurchaseModal(true);
        }
      }, 1600);
    } else {
      playCorrectSound();
      const pick = { row: rowIdx, ball: ballIdx };
      setCorrectPicks(prev => [...prev, pick]);
      setJustOkBall(pick);
      // +50 pontos por fileira vencida
      if (userId) {
        apiCall(`/users/${userId}/add-points`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "win" }),
        }).catch(() => {});
      }
      setTimeout(() => {
        setJustOkBall(null);
        const next = rowIdx + 1;
        if (rowIdx === 3) {
          triggerBonus(gameConfigRef.current.bonusRow3);
        } else if (rowIdx === 4) {
          triggerBonus(gameConfigRef.current.bonusRow4);
        } else if (rowIdx === 5) {
          if (r5PrizeBallsRef.current.includes(ballIdx)) {
            triggerMegaBonus();
          } else {
            triggerBonus(gameConfigRef.current.bonusRow4);
          }
        }
        if (next >= TOTAL_ROWS) {
          setGameActive(false); setCurrentRow(0);
          setTimeout(() => {
            setCorrectPicks([]);
            lockedRef.current = false;
            setLocked(false);
            if (playsRemainingRef.current > 0) {
              const newWrong3 = randomWrongBalls(rowWrongCountsRef.current);
              setWrongBalls(newWrong3);
              r5PrizeBallsRef.current = generateR5PrizeBalls(newWrong3, gameConfigRef.current.r5PrizeBallCount);
              setCurrentRow(0);
              setGameActive(true);
            }
          }, 5500);
        } else {
          setCurrentRow(next);
          lockedRef.current = false;
          setLocked(false);
        }
      }, 700);
    }
  };

  const refreshReferralCount = useCallback(async (id: number) => {
    const data = await apiCall(`/users/${id}/referral-info`);
    if (data?.totalFriends !== undefined) setTotalFriends(data.totalFriends);
  }, []);

  const handleRegistered = (id: number) => {
    setUserId(id);
    localStorage.setItem("golUserId", String(id));
    apiCall(`/users/${id}`).then(data => {
      if (data?.user) {
        setPlaysRemaining(data.user.playsRemaining);
        setReferralUnlocked(data.user.referralUnlocked);
        setUserInfo({ name: data.user.name, cidade: data.user.cidade, estado: data.user.estado, fotoBase64: data.user.fotoBase64, rankingSocialLink: data.user.rankingSocialLink });
      }
      setUserLoaded(true);
    });
  };

  const handleSeguirRanking = useCallback(async (scope: "cidade" | "estado" | "brasil") => {
    if (!userId || !rankingData) return;
    const topPlayer = rankingData[scope]?.[0];
    if (!topPlayer || !topPlayer.id) return;
    if (topPlayer.id === userId) { showToast("Você é o líder! Não precisa seguir a si mesmo."); return; }

    // Abrir link social do jogador em nova aba
    const link = topPlayer.rankingSocialLink || topPlayer.linkSocial || topPlayer.ranking_social_link;
    if (link) {
      window.open(link, "_blank");
    } else {
      showToast("📞 Este jogador ainda não cadastrou seu link social.");
    }

    // Chamar API para seguir e ganhar pontos
    const data = await apiCall(`/users/${userId}/seguir-ranking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: topPlayer.id }),
    });
    if (data?.error) {
      showToast(data.error);
      return;
    }
    if (data?.user) {
      setSeguindoRanking(prev => ({ ...prev, [scope]: true }));
      showToast(`🎉 +5 pts! Você seguiu ${topPlayer.name || "o líder"}!`);
    }
  }, [userId, rankingData]);

  const handlePurchased = (newPlays: number) => {
    setPlaysRemaining(newPlays);
    setShowPurchaseModal(false);
    showToast(`✅ Compra realizada! ${newPlays} jogadas disponíveis.`);
  };

  if (showAdmin) return <AdminPanel onClose={() => { setShowAdmin(false); window.history.replaceState({}, "", window.location.pathname + window.location.search); fetchSettings(); }} skipAuth={isAdminMode || isPhoneAdmin} />;

  if (showBoardEditor) return (
    <BoardEditor
      onClose={(finalPath) => {
        setShowBoardEditor(false);
        window.history.replaceState({}, "", window.location.pathname);
        if (Array.isArray(finalPath) && finalPath.length > 0) {
          setPiratePath(finalPath);
          setPirateChampionIdx(finalPath.length - 1);
        }
        fetchSettings();
      }}
    />
  );

  if (!userLoaded) return (
    <div style={{ position: "fixed", inset: 0, background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#FFD700", fontSize: 32 }}>⚽</div>
    </div>
  );
  if (!userId) {
    return (
      <>
        <RegisterScreen referralCode={referralCodeFromUrl || undefined} onRegistered={handleRegistered} />
        {isAdminMode && (
          <button
            onClick={() => setShowAdmin(true)}
            style={{
              position: "fixed", bottom: 16, right: 16, zIndex: 2147483638,
              background: "#1a1a1a", border: "2px solid gold",
              borderRadius: 10, color: "gold", fontSize: 14, fontWeight: "bold",
              padding: "8px 14px", cursor: "pointer", boxShadow: "0 0 12px rgba(255,215,0,0.4)",
            }}
          >⚙️ ADMIN</button>
        )}
      </>
    );
  }

  // Derived font size based on image render width
  const numFontSize = Math.max(bounds.w * 0.040, 13);
  const smallFontSize = Math.max(bounds.w * 0.022, 9);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}
      onClick={TOUCH_CALIB ? handleCalibTap : undefined}
      onTouchEnd={TOUCH_CALIB ? handleCalibTap : undefined}
    >
      {/* Background image — pirata ou Gol da Sorte */}
      <img
        src={showGolDaSorte ? golDaSorteImg : "/pirata.jpg"}
        alt={showGolDaSorte ? "Gol da Sorte" : "Pirata da Sorte"}
        draggable={false}
        style={{
          position: "absolute",
          left: bounds.x,
          top: bounds.y,
          width: bounds.w,
          height: bounds.h,
          objectFit: "fill",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />


      {/* ─── Avatar do usuário — canto superior esquerdo, sempre visível quando logado ─── */}
      {userId && (
        <div
          style={{
            position: "fixed",
            left: 8,
            top: 8,
            zIndex: 99999,
            cursor: "pointer",
            width: 52,
            height: 52,
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log("[Avatar] clicado!");
            setShowEditPhoto(true);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            console.log("[Avatar] touch!");
            setShowEditPhoto(true);
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "2.5px solid #FFD700",
            overflow: "hidden",
            background: userInfo?.fotoBase64 ? "#1a1a1a" : "linear-gradient(135deg, #333 0%, #111 100%)",
            boxShadow: "0 0 12px rgba(255,215,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {userInfo?.fotoBase64 ? (
              <img
                src={userInfo.fotoBase64}
                alt="Foto"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
              />
            ) : (
              <span style={{ fontSize: 20 }}>👤</span>
            )}
          </div>
          <div style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FFD700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            border: "1.5px solid #000",
          }}>
            <span style={{ fontSize: 10, color: "#000" }}>✏</span>
          </div>
        </div>
      )}

      {/* ─── HUD COMPACTO — modo pirata (absolute dentro dos bounds) ─── */}
      {!showGolDaSorte && (
        <div style={{
          position: "absolute",
          right: bounds.x + 2,
          top: bounds.y + 4,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: "center",
          pointerEvents: "auto",
          width: Math.max(bounds.w * 0.13, 54),
        }}>

          {/* Jogadas badge */}
          <div
            onClick={() => setShowPurchaseModal(true)}
            style={{ width: "100%", cursor: "pointer", padding: "4px 2px", borderRadius: 7, background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,215,0,0.35)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
          >
            <span style={{ fontSize: Math.max(bounds.w * 0.030, 11), color: playsRemaining <= 0 ? "#ff4422" : "#FFD700", fontWeight: 900, textShadow: "0 1px 4px #000", lineHeight: 1 }}>{playsRemaining}</span>
            <span style={{ fontSize: Math.max(bounds.w * 0.014, 6), color: "#ccc", textShadow: "0 1px 3px #000", lineHeight: 1, textTransform: "uppercase", letterSpacing: 0.3 }}>jogadas</span>
          </div>

          {/* Promoção */}
          {promoConfig.ativa && (
            <div onClick={() => setShowPromoModal(true)} style={{ width: "100%", cursor: "pointer", padding: "4px 2px", borderRadius: 7, background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,100,0,0.45)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: Math.max(bounds.w * 0.040, 15), lineHeight: 1 }}>🎁</span>
              <span style={{ fontSize: Math.max(bounds.w * 0.014, 6), color: "#FFD700", fontWeight: 900, textShadow: "0 1px 3px #000", lineHeight: 1 }}>Promo</span>
            </div>
          )}

          {/* Amigos / Indicar */}
          <div
            onClick={() => { if (userId) setShowInviteScreen(true); }}
            style={{ width: "100%", cursor: userId ? "pointer" : "default", padding: "4px 2px", borderRadius: 7, background: "rgba(0,80,0,0.60)", backdropFilter: "blur(6px)", border: "1px solid rgba(80,255,80,0.45)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
          >
            <span style={{ fontSize: Math.max(bounds.w * 0.040, 15), lineHeight: 1 }}>📲</span>
            <span style={{ fontSize: Math.max(bounds.w * 0.014, 6), color: "#80ff80", fontWeight: 900, textShadow: "0 1px 3px #000", lineHeight: 1, whiteSpace: "nowrap" }}>Whatsapp</span>
          </div>


          {/* ── Participantes online — círculos de foto ── */}
          {onlineUsers.length > 0 && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3, alignItems: "center", marginTop: 2 }}>
              <div style={{ width: "80%", height: 1, background: "rgba(255,215,0,0.20)", margin: "2px 0" }} />
              {onlineUsers.slice(0, 8).map(u => {
                const avatarSize = Math.max(bounds.w * 0.080, 28);
                const isMe = u.id === userId;
                return (
                  <div key={u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <div style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: "50%",
                      border: isMe ? "2px solid #FFD700" : "1.5px solid rgba(255,215,0,0.40)",
                      overflow: "hidden",
                      background: "#1a1a1a",
                      flexShrink: 0,
                    }}>
                      {u.fotoBase64 ? (
                        <img src={u.fotoBase64} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
                      ) : (
                        <svg viewBox="0 0 100 110" style={{ width: "100%", height: "100%" }} fill={isMe ? "#FFD700" : "#555"}>
                          <circle cx="50" cy="28" r="22" />
                          <ellipse cx="50" cy="95" rx="38" ry="30" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: Math.max(bounds.w * 0.012, 5), color: isMe ? "#FFD700" : "#ccc", fontWeight: isMe ? 900 : 600, textShadow: "0 1px 2px #000", maxWidth: avatarSize + 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", lineHeight: 1 }}>
                      {u.name.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Botão Editor — canto superior esquerdo da área do tabuleiro, acima da imagem */}
      {!showGolDaSorte && (
        <div
          onClick={() => setShowBoardEditor(true)}
          style={{
            position: "absolute",
            left: bounds.x + 4,
            top: bounds.y + 4,
            zIndex: 200,
            cursor: "pointer",
            padding: "4px 2px",
            borderRadius: 7,
            background: "rgba(0,0,0,0.60)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,215,0,0.45)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            width: Math.max(bounds.w * 0.13, 54),
          }}
        >
          <span style={{ fontSize: Math.max(bounds.w * 0.040, 15), lineHeight: 1 }}>🎨</span>
          <span style={{ fontSize: Math.max(bounds.w * 0.014, 6), color: "#FFD700", fontWeight: 900, textShadow: "0 1px 3px #000", lineHeight: 1, whiteSpace: "nowrap" }}>Editor</span>
        </div>
      )}

      {/* ── CASAS DO TABULEIRO PIRATA — rotacionadas para seguir o caminho ── */}
      {!showGolDaSorte && (() => {
        const tileW = Math.max(bounds.w * 0.090, 33);
        const tileH = Math.max(bounds.w * 0.070, 25);
        return piratePath.map((pos, i) => {
          if (i > pirateChampionIdx) return null;
          const isStart = i === 0;
          const isLast = i === pirateChampionIdx;
          const displayPos = pirateAnimPos !== null ? pirateAnimPos : piratePos;
          const isMyTile = i === displayPos && !!userInfo?.fotoBase64;
          const cx = bounds.x + pos.x * bounds.w;
          const cy = bounds.y + pos.y * bounds.h;
          return (
            <div
              key={`sq-${i}`}
              style={{
                position: "absolute",
                left: cx - tileW / 2,
                top:  cy - tileH / 2,
                width: tileW,
                height: tileH,
                borderRadius: tileH * 0.28,
                border: isMyTile
                  ? "2.5px solid #FFD700"
                  : isStart
                  ? "2.5px solid rgba(80,255,80,0.90)"
                  : isLast
                  ? "2px solid rgba(255,215,0,0.85)"
                  : "2px solid rgba(255,215,0,0.60)",
                background: isStart
                  ? "rgba(0,70,10,0.90)"
                  : isLast
                  ? "rgba(60,40,0,0.92)"
                  : "rgba(12,10,30,0.90)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                zIndex: isMyTile ? 10 : 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                pointerEvents: "none",
                boxShadow: isMyTile
                  ? "0 0 14px 4px rgba(255,215,0,0.70)"
                  : isStart
                  ? "0 0 8px 2px rgba(60,255,60,0.40)"
                  : "none",
              }}
            >
              {isMyTile ? (
                <img
                  src={userInfo!.fotoBase64!}
                  alt="você"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", pointerEvents: "none" }}
                />
              ) : (
                <span style={{
                  fontSize: Math.max(tileH * 0.40, 8),
                  color: isStart ? "#90ffA0" : "rgba(255,215,0,0.85)",
                  fontWeight: 900,
                  textShadow: "0 1px 3px #000",
                  lineHeight: 1,
                  userSelect: "none",
                }}>
                  {isStart ? "🏁" : isLast ? "👑" : i}
                </span>
              )}
            </div>
          );
        });
      })()}

      {/* ── OUTROS JOGADORES no tabuleiro ── */}
      {!showGolDaSorte && otherPlayers.map(op => {
        if (op.piratePos < 0 || op.piratePos >= piratePath.length) return null;
        const pos = piratePath[op.piratePos];
        if (!pos) return null;
        const tileW = Math.max(bounds.w * 0.090, 33);
        const tileH = Math.max(bounds.w * 0.070, 25);
        const cx = bounds.x + pos.x * bounds.w;
        const cy = bounds.y + pos.y * bounds.h;
        const offset = (op.id % 3 - 1) * 8;
        return (
          <div
            key={`op-${op.id}`}
            title={op.name}
            style={{
              position: "absolute",
              left: cx - tileW / 2 + offset,
              top: cy - tileH / 2 - 4,
              width: tileW,
              height: tileH,
              borderRadius: tileH * 0.28,
              border: "2px solid rgba(120,200,255,0.85)",
              background: "rgba(0,30,80,0.88)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 7,
              overflow: "hidden",
              pointerEvents: "none",
              boxShadow: "0 0 10px 3px rgba(80,160,255,0.50)",
            }}
          >
            {op.fotoBase64 ? (
              <img src={op.fotoBase64} alt={op.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
            ) : (
              <span style={{ fontSize: Math.max(tileH * 0.40, 8), color: "#8af", fontWeight: 900, lineHeight: 1, userSelect: "none" }}>👤</span>
            )}
          </div>
        );
      })}

      {/* ── CARD DO CAMPEÃO — posicionado sobre a coroa no tabuleiro ── */}
      {!showGolDaSorte && (() => {
        const crownPos = piratePath[pirateChampionIdx];
        if (!crownPos) return null;
        const cW = Math.max(bounds.w * 0.22, 70);
        const cH = Math.max(bounds.w * 0.30, 90);
        const cx = bounds.x + crownPos.x * bounds.w;
        const cy = bounds.y + crownPos.y * bounds.h;
        const fotoH = Math.round(cH * 0.62);
        const infoH = cH - fotoH;
        const fs = Math.max(cW * 0.13, 9);
        const nomeTxt = atualCampeao?.nome ?? "CAMPEÃO";
        const cidadeEstado = atualCampeao?.cidadeEstado ?? "";
        const parts = cidadeEstado.split(/[-/]/).map((s: string) => s.trim());
        const cidade = parts[0] ?? "";
        const estado = parts[1] ?? "";
        return (
          <div
            onClick={atualCampeao?.nome && userId && String(userId) !== atualCampeao.userId
              ? () => { setHasClickedChampionLink(false); setShowChampionFollowModal(true); }
              : undefined}
            style={{
              position: "absolute",
              left: cx - cW / 2,
              top: cy - cH / 2,
              width: cW,
              height: cH,
              borderRadius: 7,
              border: "2.5px solid #FFD700",
              background: "rgba(8,5,0,0.97)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 50,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              pointerEvents: "auto",
              cursor: atualCampeao?.nome && userId && String(userId) !== atualCampeao.userId ? "pointer" : "default",
              boxShadow: "0 0 16px 5px rgba(255,200,0,0.65), 0 0 32px 8px rgba(255,170,0,0.25)",
            }}
          >
            {/* Foto — preenche toda a área superior */}
            <div style={{ width: "100%", height: fotoH, flexShrink: 0, overflow: "hidden", background: "#111" }}>
              {atualCampeao?.foto ? (
                <img
                  src={atualCampeao.foto}
                  alt={nomeTxt}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block", pointerEvents: "none" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#1a1000,#0a0800)" }}>
                  <span style={{ fontSize: Math.max(fotoH * 0.50, 24), lineHeight: 1 }}>👑</span>
                </div>
              )}
            </div>
            {/* Nome + Cidade • UF */}
            <div style={{
              width: "100%",
              height: infoH,
              flexShrink: 0,
              background: "rgba(70,48,0,0.98)",
              borderTop: "1.5px solid rgba(255,215,0,0.50)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 4px",
              gap: 1,
              overflow: "hidden",
            }}>
              <span style={{
                fontSize: fs,
                fontWeight: 900,
                color: "#FFD700",
                textShadow: "0 1px 4px #000",
                lineHeight: 1.15,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: "100%",
                userSelect: "none",
              }}>{nomeTxt}</span>
              {(cidade || estado) && (
                <span style={{
                  fontSize: Math.max(fs * 0.80, 7),
                  color: "rgba(255,220,120,0.92)",
                  textShadow: "0 1px 2px #000",
                  lineHeight: 1.15,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  userSelect: "none",
                }}>{cidade}{cidade && estado ? ` • ${estado}` : estado}</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── PAR DE DADOS — modo pirata ───────────────────────────────────────── */}
      {!showGolDaSorte && (() => {
        // Pontos do dado por face
        const dotPos: Record<number, [number, number][]> = {
          1: [[50, 50]],
          2: [[25, 25], [75, 75]],
          3: [[25, 25], [50, 50], [75, 75]],
          4: [[25, 25], [75, 25], [25, 75], [75, 75]],
          5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
          6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
        };
        const DiceFace = ({ value, onClick, glow }: { value: number; onClick?: () => void; glow?: boolean }) => {
          const ds = Math.max(bounds.w * 0.18, 60);
          const dots = dotPos[value] ?? dotPos[1];
          const dotR = ds * 0.10;
          return (
            <div
              onClick={onClick}
              style={{
                width: ds, height: ds,
                borderRadius: ds * 0.18,
                background: "linear-gradient(135deg, #fff 70%, #e8e0cc)",
                border: glow ? "3px solid #FFD700" : "2px solid #bbb",
                boxShadow: glow
                  ? "0 0 18px 6px rgba(255,215,0,0.8), 0 4px 16px #000"
                  : "0 4px 14px rgba(0,0,0,0.7)",
                position: "relative",
                cursor: onClick ? "pointer" : "default",
                transition: "transform 0.15s, box-shadow 0.15s",
                transform: glow ? "scale(1.10)" : "scale(1)",
                flexShrink: 0,
              }}
            >
              {dots.map(([cx, cy], di) => (
                <div key={di} style={{
                  position: "absolute",
                  width: dotR * 2, height: dotR * 2,
                  borderRadius: "50%",
                  background: "#222",
                  left: `calc(${cx}% - ${dotR}px)`,
                  top: `calc(${cy}% - ${dotR}px)`,
                }} />
              ))}
            </div>
          );
        };

        // Dados no canto inferior direito, dentro dos bounds
        const btnW = 56;
        const btnH = 72;
        const btnX = bounds.x + bounds.w - btnW - 6;
        const btnY = bounds.y + bounds.h - btnH - 6;

        return (
          <>
            {/* Botão Rolar Dados — canto inferior direito */}
            {dicePhase === "idle" && (
              <>
                <div style={{
                  position: "absolute",
                  left: btnX + 2,
                  top: btnY - 20,
                  width: btnW - 4,
                  textAlign: "center",
                  color: "#FFD700",
                  fontSize: 9,
                  fontWeight: 900,
                  textShadow: "0 1px 4px #000",
                  pointerEvents: "none",
                  zIndex: 60,
                }}>
                  Casa {piratePos + 1}/{pirateChampionIdx + 1}
                </div>
                <button
                  onClick={handleRollDice}
                  style={{
                    position: "absolute",
                    left: btnX,
                    top: btnY,
                    width: btnW,
                    height: btnH,
                    background: "linear-gradient(180deg, #2a1a00 0%, #1a0d00 100%)",
                    border: "2px solid #FFD700",
                    borderRadius: 14,
                    color: "#FFD700",
                    fontSize: 26,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                    cursor: "pointer",
                    zIndex: 60,
                    pointerEvents: "auto",
                    boxShadow: "0 0 16px 5px rgba(255,215,0,0.40)",
                    touchAction: "none",
                  }}
                >
                  🎲
                  <span style={{ fontSize: 9, fontWeight: 900, color: "#FFD700", lineHeight: 1 }}>ROLAR</span>
                </button>
              </>
            )}

            {/* Overlay escolha dos dados — ancora no canto inferior direito */}
            {(dicePhase === "rolling" || dicePhase === "choosing") && (
              <div style={{
                position: "absolute",
                right: bounds.x + 6,
                bottom: 6,
                zIndex: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
                pointerEvents: dicePhase === "choosing" ? "auto" : "none",
              }}>
                <div style={{
                  background: "rgba(0,0,0,0.88)",
                  borderRadius: 16,
                  border: "1.5px solid rgba(255,215,0,0.55)",
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                }}>
                  <span style={{ color: "#FFD700", fontWeight: 900, fontSize: Math.max(bounds.w * 0.036, 13), textShadow: "0 1px 4px #000", letterSpacing: 0.5 }}>
                    {dicePhase === "rolling" ? "🎲 Sorteando..." : "🎲 Escolha um dado!"}
                  </span>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <DiceFace
                      value={diceAnim[0]}
                      onClick={dicePhase === "choosing" ? () => handleChooseDie(diceValues![0]) : undefined}
                      glow={dicePhase === "choosing"}
                    />
                    <span style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>×</span>
                    <DiceFace
                      value={diceAnim[1]}
                      onClick={dicePhase === "choosing" ? () => handleChooseDie(diceValues![1]) : undefined}
                      glow={dicePhase === "choosing"}
                    />
                  </div>
                  {dicePhase === "choosing" && (
                    <span style={{ color: "#ccc", fontSize: Math.max(bounds.w * 0.026, 9), textAlign: "center" }}>
                      Toque no dado que deseja usar para avançar
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {showGolDaSorte && (<>
      {/* ══════════════════════════════════════════════
          JOGADAS — botão contador + comprar mais
          Cobre jogadasNum + jogadasPlus (x: 0.675→0.875)
          ══════════════════════════════════════════════ */}
      <div
        onClick={() => setShowPurchaseModal(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowPurchaseModal(true); }}
        style={{
          ...ov(UI.jogadasNum.x, UI.jogadasNum.y, UI.jogadasNum.w + UI.jogadasPlus.w, UI.jogadasNum.h),
          left: `calc(${bounds.x + bounds.w * UI.jogadasNum.x}px - 4mm)`,
          width: `calc(${bounds.w * (UI.jogadasNum.w + UI.jogadasPlus.w)}px + 9mm)`,
          top: `calc(${bounds.y + bounds.h * UI.jogadasNum.y}px - 2mm)`,
          animation: jogadasPop ? "jogadasPop 0.38s cubic-bezier(0.36,0.07,0.19,0.97)" : "none",
          zIndex: 30,
          cursor: "pointer",
          background: playsRemaining <= 0
            ? "linear-gradient(135deg, #3a0000, #1a0000)"
            : "linear-gradient(135deg, #0a1a00, #0d2800)",
          border: playsRemaining <= 0
            ? "1.5px solid rgba(255,60,0,0.7)"
            : "1.5px solid rgba(100,220,0,0.6)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          boxShadow: playsRemaining <= 0
            ? "0 0 10px rgba(255,40,0,0.3)"
            : "0 0 10px rgba(80,200,0,0.25)",
        }}
      >
        <span style={{
          color: playsRemaining <= 0 ? "rgba(255,120,60,0.9)" : "rgba(120,220,80,0.9)",
          fontWeight: 800,
          fontSize: Math.max(bounds.w * 0.018, 7),
          lineHeight: 1,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}>
          JOGADAS
        </span>
        <span style={{
          color: playsRemaining <= 0 ? "#ff4422" : "#FFD700",
          fontWeight: 900,
          fontSize: numFontSize,
          lineHeight: 1.1,
          textShadow: playsRemaining <= 0
            ? "0 0 8px rgba(255,60,0,0.7)"
            : "0 0 8px rgba(255,200,0,0.6)",
          letterSpacing: 1,
        }}>
          {playsRemaining}
        </span>
      </div>

      {/* ── VIDEO PROMO — autoplay, mudo, expande ao clicar ── */}
      <div
        style={{
          ...ov(0.618, 0.005, 0.352, 0.163),
          zIndex: 30,
          borderRadius: 8,
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={() => {
          if (videoExpandTimer.current) clearTimeout(videoExpandTimer.current);
          setVideoExpanded(true);
          videoExpandTimer.current = setTimeout(() => setVideoExpanded(false), 15000);
        }}
      >
        <video
          ref={videoRef}
          loop
          muted
          autoPlay
          playsInline
          src="/video-promo.mp4"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top",
            display: "block",
          }}
        />
      </div>

      {/* ── VIDEO EXPANDIDO (overlay ao clicar) ── */}
      {videoExpanded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => {
            if (videoExpandTimer.current) clearTimeout(videoExpandTimer.current);
            setVideoExpanded(false);
          }}
        >
          <div
            style={{
              width: "88%",
              maxWidth: 340,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              loop
              muted
              autoPlay
              playsInline
              src="/video-promo.mp4"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          ATUAL CAMPEÃO — siga e ganhe 3 jogadas
          (cobre onde era VALOR ACUMULADO + área própria)
          ══════════════════════════════════════════════ */}
      <div
        style={{
          ...ov(0.608, 0.237, 0.362, 0.265),
          zIndex: 30,
          background: "#0a0a0a",
          borderRadius: 5,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          cursor: atualCampeao?.nome && userId && String(userId) !== atualCampeao.userId ? "pointer" : "default",
        }}
      >
        {/* 52% — Foto */}
        <div style={{
          flex: "0 0 52%",
          position: "relative",
          overflow: "hidden",
          background: "#111",
        }}>
          {atualCampeao?.foto ? (
            <img
              src={atualCampeao.foto}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              background: "linear-gradient(180deg, #1c1c1c, #111)",
              overflow: "hidden",
            }}>
              <svg viewBox="0 0 100 110" style={{ width: "55%", opacity: 0.35 }} fill="#aaa">
                <circle cx="50" cy="28" r="22" />
                <ellipse cx="50" cy="95" rx="38" ry="30" />
              </svg>
            </div>
          )}
        </div>

        {/* 48% — Nome, cidade e botão SEGUIR */}
        <div style={{
          flex: "0 0 48%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          background: "#0d0d0d",
          borderTop: "2px solid rgba(255,215,0,0.45)",
          overflow: "hidden",
          padding: `4px ${Math.max(bounds.w * 0.012, 3)}px 4px`,
          gap: 2,
        }}>
          {/* 1 — Nome em destaque dourado (topo, junto à foto) */}
          <div style={{
            background: "rgba(255,215,0,0.12)",
            borderRadius: 5,
            padding: `2px ${Math.max(bounds.w * 0.010, 3)}px`,
            textAlign: "center",
          }}>
            <div style={{
              color: "#FFD700",
              fontWeight: 900,
              fontSize: Math.max(bounds.w * 0.030, 9),
              lineHeight: 1.25,
              textShadow: "0 0 8px rgba(255,215,0,0.5)",
              letterSpacing: 0.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {atualCampeao?.nome || "ATUAL CAMPEÃO"}
            </div>
          </div>

          {/* 2 — Cidade / Estado (meio) */}
          <div style={{
            color: "#bbb",
            fontWeight: 600,
            fontSize: Math.max(bounds.w * 0.021, 7),
            textAlign: "center",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: atualCampeao?.cidadeEstado ? 1 : 0,
          }}>
            📍 {atualCampeao?.cidadeEstado || ""}
          </div>

          {/* 3 — "SIGA E GANHE 3 JOGADAS" — texto destacado, sem fundo */}
          <div style={{
            color: "#FF8C00",
            fontWeight: 900,
            fontSize: Math.max(bounds.w * 0.023, 8),
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: 0.4,
            textShadow: "0 0 10px rgba(255,120,0,0.7)",
          }}>
            SIGA E GANHE 3 JOGADAS
          </div>

          {/* 4 — Botão SEGUIR / SEGUINDO */}
          <button
            onClick={e => {
              e.stopPropagation();
              if (!userId) { showToast("Faça login para seguir o campeão!"); return; }
              if (atualCampeao?.linkSocial) {
                window.open(atualCampeao.linkSocial, "_blank");
                setHasClickedChampionLink(true);
              }
              if (atualCampeao?.nome) {
                setHasClickedChampionLink(false);
                setShowChampionFollowModal(true);
              }
            }}
            style={{
              marginTop: "auto",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: `${Math.max(bounds.h * 0.006, 3)}px 4px`,
              background: !atualCampeao?.nome
                ? "linear-gradient(180deg, #1e1e1e, #141414)"
                : (atualCampeao?.userId && championFollowClaimed === atualCampeao?.userId)
                  ? "linear-gradient(180deg, #1a5c1a, #0f3a0f)"
                  : "linear-gradient(180deg, #00e676, #00c853)",
              color: !atualCampeao?.nome
                ? "#333"
                : (atualCampeao?.userId && championFollowClaimed === atualCampeao?.userId) ? "#5dff5d" : "#003300",
              fontWeight: 900,
              fontSize: Math.max(bounds.w * 0.028, 9),
              whiteSpace: "nowrap",
              border: !atualCampeao?.nome
                ? "1px solid #2a2a2a"
                : (atualCampeao?.userId && championFollowClaimed === atualCampeao?.userId)
                  ? "1px solid #2d7a2d"
                  : "1px solid #00ff7f",
              borderRadius: 6,
              cursor: atualCampeao?.nome ? "pointer" : "default",
              letterSpacing: 1,
              textTransform: "uppercase",
              boxShadow: !atualCampeao?.nome
                ? "none"
                : (atualCampeao?.userId && championFollowClaimed === atualCampeao?.userId)
                  ? "0 2px 8px rgba(0,200,0,0.2)"
                  : "0 2px 0 #007a30, 0 3px 10px rgba(0,230,120,0.4)",
            }}
          >
            {(atualCampeao?.userId && championFollowClaimed === atualCampeao?.userId) ? "SEGUINDO" : "SEGUIR"}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CONVIDAR AGORA button overlay
          Pixel scan: x=764-1000 (xF≈0.679-0.889), y=1286-1310 (yF≈0.591-0.602)
          Expanded slightly for easier tapping
          ══════════════════════════════════════════════ */}
      <div
        onClick={() => setShowInviteScreen(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowInviteScreen(true); }}
        style={{
          ...ov(UI.convidar.x, UI.convidar.y, UI.convidar.w, UI.convidar.h),
          zIndex: 30,
          cursor: "pointer",
          background: DEBUG ? "rgba(128,0,255,0.4)" : "transparent",
          border: DEBUG ? "2px solid violet" : "none",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
      </div>

      {/* ══════════════════════════════════════════════
          JOGAR button overlay — só ativo no modo Gol da Sorte
          ══════════════════════════════════════════════ */}
      <div
        onClick={showGolDaSorte ? handleJogar : undefined}
        style={{
          ...ov(0.086, 0.862, 0.448, 0.0416),
          zIndex: 10,
          cursor: showGolDaSorte ? "pointer" : "default",
          borderRadius: 8,
          background: DEBUG ? "rgba(255,0,0,0.4)"
            : !showGolDaSorte ? "transparent"
            : playsRemaining <= 0 ? "rgba(255,40,0,0.18)"
            : jogarLit ? "rgba(255,200,50,0.45)" : "transparent",
          boxShadow: !DEBUG && jogarLit && showGolDaSorte ? "0 0 24px 8px rgba(255,180,0,0.7)" : "none",
          border: DEBUG ? "2px solid red" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showGolDaSorte && playsRemaining <= 0 && !DEBUG && (
          <span style={{
            color: "#FF6B35", fontWeight: 900,
            fontSize: Math.max(bounds.w * 0.025, 9),
            textShadow: "0 0 4px rgba(0,0,0,0.9)",
            pointerEvents: "none",
          }}>
            SEM JOGADAS — TOQUE PARA COMPRAR
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          USUARIOS ONLINE — ticker abaixo do JOGAR
          ══════════════════════════════════════════════ */}
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      {/* Tarja preta atrás — mesma posição e tamanho, zIndex abaixo */}
      <div style={{
        ...ov(0.030, 0.914, 0.560, 0.082),
        zIndex: 29,
        background: "rgba(0,0,0,0.82)",
        borderRadius: 6,
        border: "1px solid rgba(0,200,80,0.25)",
        boxSizing: "border-box",
        pointerEvents: "none",
      }} />
      {/* Conteúdo do ticker na frente — sem overflow hidden para não cortar os ícones */}
      <div style={{
        ...ov(0.030, 0.914, 0.560, 0.082),
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        background: "transparent",
        borderRadius: 6,
        boxSizing: "border-box",
        padding: `${bounds.h * 0.005}px ${bounds.w * 0.008}px`,
        gap: bounds.h * 0.004,
      }}>
        <span style={{
          color: "#00c850",
          fontSize: Math.max(bounds.w * 0.012, 7),
          fontWeight: 800,
          letterSpacing: 0.8,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          lineHeight: 1,
          flexShrink: 0,
        }}>
          🟢 USUÁRIOS ONLINE
        </span>
        <div style={{ flex: 1, overflow: "hidden", width: "100%", display: "flex", alignItems: "center" }}>
          <div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: bounds.w * 0.018,
            animation: onlineUsers.length > 4 ? `tickerScroll ${Math.max(onlineUsers.length * 3, 14)}s linear infinite` : "none",
            width: "auto",
          }}>
            {onlineUsers.length === 0 ? (
              <span style={{ color: "#555", fontSize: Math.max(bounds.w * 0.013, 7), fontWeight: 600, whiteSpace: "nowrap" }}>
                nenhum usuário ativo agora
              </span>
            ) : (
              <>
                {[...onlineUsers, ...(onlineUsers.length > 4 ? onlineUsers : [])].map((u, i) => {
                  const firstName = u.name.split(" ")[0] || u.name;
                  const initials = firstName.slice(0, 2).toUpperCase();
                  const avatarSize = Math.max(bounds.h * 0.042, 24);
                  return (
                    <div key={`${u.id}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: bounds.h * 0.004, flexShrink: 0 }}>
                      <div style={{
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: "50%",
                        background: u.fotoBase64 ? "transparent" : "linear-gradient(135deg, #00c850 0%, #00802f 100%)",
                        border: "2px solid rgba(0,255,100,0.8)",
                        boxShadow: "0 0 8px rgba(0,200,80,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}>
                        {u.fotoBase64 ? (
                          <img src={u.fotoBase64} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#fff", fontSize: Math.max(avatarSize * 0.38, 8), fontWeight: 900, lineHeight: 1, userSelect: "none" }}>
                            {initials}
                          </span>
                        )}
                      </div>
                      <span style={{ color: "#cfffdf", fontSize: Math.max(bounds.w * 0.013, 7), fontWeight: 700, whiteSpace: "nowrap", lineHeight: 1, textAlign: "center" }}>
                        {firstName}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          LINK SOCIAL — campo no rodapé abaixo do JOGAR
          ══════════════════════════════════════════════ */}
      <div style={{
        ...ov(0.030, 0.916, 0.560, 0.068),
        zIndex: 30,
        display: "none",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        paddingLeft: bounds.w * 0.010,
        paddingRight: bounds.w * 0.010,
        background: "rgba(0,0,0,0.75)",
        borderRadius: 6,
        border: "1px solid rgba(255,215,0,0.25)",
      }}>
        <span style={{
          color: "#888",
          fontSize: Math.max(bounds.w * 0.014, 6),
          fontWeight: 700,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}>
          Seu link social (para se tornar campeão)
        </span>
        <input
          type="url"
          placeholder="https://instagram.com/seu_perfil"
          value={championLinkInput}
          onChange={e => setChampionLinkInput(e.target.value)}
          onFocus={e => e.target.select()}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${championLinkInput.trim() ? "rgba(255,215,0,0.6)" : "rgba(255,255,255,0.2)"}`,
            color: championLinkInput.trim() ? "#FFD700" : "#aaa",
            fontSize: Math.max(bounds.w * 0.018, 7),
            fontWeight: 600,
            outline: "none",
            padding: "2px 4px",
            textAlign: "center",
          }}
        />
      </div>
      </>)}

      {/* ══════════════════════════════════════════════
          Ball overlays — só no modo Gol da Sorte
          ══════════════════════════════════════════════ */}
      {showGolDaSorte && ROWS.map((row, rowIdx) => {
        const [yS, yE] = row.y;
        const rowH = yE - yS;
        const isActive = gameActive && rowIdx === currentRow;
        const col = ROW_COLORS[rowIdx];

        return row.x.map(([xS, xE], ballIdx) => {
          const xW = xE - xS;
          const isErr = errorBall?.row === rowIdx && errorBall?.ball === ballIdx;
          const isJustOk = justOkBall?.row === rowIdx && justOkBall?.ball === ballIdx;
          const isCorrect = correctPicks.some(p => p.row === rowIdx && p.ball === ballIdx);
          const showCircle = isActive || isCorrect || isErr;

          return (
            <div
              key={`${rowIdx}-${ballIdx}`}
              onClick={() => handleBallClick(rowIdx, ballIdx)}
              onTouchEnd={(e) => { e.preventDefault(); handleBallClick(rowIdx, ballIdx); }}
              style={{
                ...ov(xS, yS, xW, rowH),
                borderRadius: "50%", zIndex: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isActive ? "pointer" : "default",
                background: DEBUG ? `${col}44` : "transparent",
                outline: DEBUG ? `2px solid ${col}` : "none",
                pointerEvents: (isActive && !TOUCH_CALIB) ? "auto" : "none",
              }}
            >
              {DEBUG && <span style={{ fontSize: 8, color: "#fff", fontWeight: 900, textShadow: "0 0 3px #000" }}>{row.label}B{ballIdx}</span>}
              {!DEBUG && showCircle && (
                <div style={{
                  width: "62%", height: "62%", borderRadius: "50%",
                  background: isErr ? "rgba(180,20,20,0.25)" : isCorrect ? (isJustOk ? "rgba(60,255,80,0.45)" : "rgba(60,220,80,0.28)") : "rgba(255,220,50,0.08)",
                  outline: isErr ? "2px solid rgba(255,60,60,0.60)" : isCorrect ? "2.5px solid rgba(60,255,100,0.80)" : "2px solid rgba(255,220,50,0.50)",
                  boxShadow: isErr ? "0 0 18px 6px rgba(255,30,0,0.55)" : isCorrect ? (isJustOk ? "0 0 22px 8px rgba(50,255,80,0.75)" : "0 0 12px 4px rgba(50,220,80,0.50)") : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none", transition: "box-shadow 0.3s ease",
                }}>
                  {isErr && <span style={{ fontSize: Math.max(bounds.w * xW * 0.50, 14), lineHeight: 1, userSelect: "none", filter: "drop-shadow(0 0 8px rgba(255,80,0,0.9))" }}>💣</span>}
                  {isCorrect && !isErr && <span style={{ fontSize: Math.max(bounds.w * xW * 0.38, 10), color: isJustOk ? "#afffb0" : "#70ff90", fontWeight: 900, lineHeight: 1, userSelect: "none", textShadow: "0 0 6px rgba(80,255,100,0.7)" }}>✓</span>}
                </div>
              )}
            </div>
          );
        });
      })}

      {/* ── CALIBRATION OVERLAY ── */}
      {TOUCH_CALIB && (
        <>
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", zIndex: 200, pointerEvents: "none" }}>
            <span style={{ background: "rgba(0,0,0,0.85)", color: "#FFD700", fontSize: 13, fontWeight: 900, padding: "4px 12px", borderRadius: 8 }}>
              MODO CALIBRAÇÃO — Toque em qualquer elemento
            </span>
          </div>
          <div style={{ position: "absolute", top: 40, left: 8, background: "rgba(0,0,0,0.88)", color: "#fff", fontSize: 11, padding: "6px 10px", borderRadius: 8, zIndex: 200, pointerEvents: "none", lineHeight: 1.8, minWidth: 160 }}>
            <div style={{ color: "#FFD700", fontWeight: 900, marginBottom: 2 }}>Últimos toques:</div>
            {calibTaps.length === 0 && <div style={{ color: "#aaa" }}>nenhum ainda</div>}
            {calibTaps.map((t, i) => <div key={i} style={{ color: i === 0 ? "#0f0" : "#ccc" }}>x: {t.xF} &nbsp; <strong>y: {t.yF}</strong></div>)}
          </div>
        </>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.90)", border: "1px solid rgba(255,200,0,0.4)",
          color: "#FFD700", borderRadius: 12, padding: "10px 20px",
          fontSize: 14, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          {toast}
        </div>
      )}

      {/* ── MODALS ── */}
      {showPurchaseModal && userId && (
        <PurchaseModal userId={userId} onPurchased={handlePurchased} onClose={() => setShowPurchaseModal(false)} />
      )}
      {showInviteScreen && userId && (
        <InviteScreen userId={userId} onClose={() => { setShowInviteScreen(false); refreshReferralCount(userId); }} />
      )}
      {showEditPhoto && userId && (
        <EditPhotoModal userId={userId} onClose={() => setShowEditPhoto(false)} onUpdated={() => { window.location.reload(); }} />
      )}
      {/* ── BOTÃO PROMOÇÃO 100 JOGADAS ── */}
      {showGolDaSorte && (<>
      {promoConfig.ativa && (
      <div
        onClick={() => setShowPromoModal(true)}
        onTouchEnd={(e) => { e.preventDefault(); setShowPromoModal(true); }}
        style={{
          ...ov(0.626, 0.632, 0.334, 0.092),
          zIndex: 90,
          cursor: "pointer",
          background: "linear-gradient(135deg, #ff6a00, #ee0979, #ff6a00)",
          border: "2.5px solid #FFD700",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          boxShadow: "0 0 20px 6px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5)",
          animation: "promoPulse 1.6s ease-in-out infinite",
          userSelect: "none",
          padding: 6,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>🎁</span>
        <span style={{
          color: "#FFD700",
          fontWeight: 900,
          fontSize: 8.5,
          letterSpacing: 0.3,
          textShadow: "0 0 8px rgba(255,215,0,0.8), 0 1px 3px rgba(0,0,0,0.9)",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.25,
          position: "relative",
          bottom: "1mm",
        }}>
          {promoConfig.titulo}
        </span>
      </div>
      )}

      {/* ── RANKING PÓDIO — pódio compacto Cidade / Brasil / Estado ── */}
      <div style={{ ...ov(0.614, 0.730, 0.350, 0.270), zIndex: 89 }}>
        <RankingPodium
          cidade={rankingData?.cidade?.[0] ? {
            nome: rankingData.cidade[0].name,
            pontos: rankingData.cidade[0].rankingPoints,
            label: `${rankingData.cidade[0].cidade} - ${rankingData.cidade[0].estado}`,
            foto: rankingData.cidade[0].fotoBase64,
            id: rankingData.cidade[0].id,
          } : { nome: "João Silva", pontos: 0, label: "Sem dados", foto: "https://i.pravatar.cc/150?img=12" }}
          brasil={rankingData?.brasil?.[0] ? {
            nome: rankingData.brasil[0].name,
            pontos: rankingData.brasil[0].rankingPoints,
            label: `${rankingData.brasil[0].cidade} - ${rankingData.brasil[0].estado}`,
            foto: rankingData.brasil[0].fotoBase64,
            id: rankingData.brasil[0].id,
          } : { nome: "Carlos Eduardo", pontos: 0, label: "Sem dados", foto: "https://i.pravatar.cc/150?img=7" }}
          estado={rankingData?.estado?.[0] ? {
            nome: rankingData.estado[0].name,
            pontos: rankingData.estado[0].rankingPoints,
            label: `${rankingData.estado[0].cidade} - ${rankingData.estado[0].estado}`,
            foto: rankingData.estado[0].fotoBase64,
            id: rankingData.estado[0].id,
          } : { nome: "Mateus Lima", pontos: 0, label: "Sem dados", foto: "https://i.pravatar.cc/150?img=33" }}
          onClick={() => setShowRankingModal(true)}
          onSeguir={(scope) => handleSeguirRanking(scope)}
          seguindo={seguindoRanking}
          currentUserId={userId}
        />
      </div>

      {/* ── MAPA DO BRASIL — ao lado direito da última fileira de bolas (R5), mesmo tamanho/formato das tarjas ── */}
      <div
        style={{
          position: "absolute",
          left: bounds.x + bounds.w * 0.4425,
          top: bounds.y + bounds.h * 0.170,
          width: bounds.w * 0.145,
          height: bounds.h * 0.152,
          zIndex: 95,
          borderRadius: 14,
          overflow: "hidden",
          border: "1.5px solid rgba(255,215,0,0.35)",
          boxShadow: "0 0 16px 2px rgba(255,215,0,0.2)",
          background: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ flex: 1, width: "100%", overflow: "hidden" }}>
          <MapaBrasil />
        </div>
        <div
          style={{
            padding: "2px 4px",
            textAlign: "center",
            width: "100%",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: Math.max(bounds.w * 0.007, 6),
              color: "rgba(255,215,0,0.9)",
              fontWeight: 800,
              letterSpacing: 0.3,
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              lineHeight: 1.05,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span>EM TODO</span>
            <span style={{ marginTop: -2 }}>BRASIL</span>
          </span>
        </div>
      </div>

      {/* ── TARJA GANHADORES 1 — ao lado direito, abaixo do ranking ── */}
      <div style={{
        position: "absolute",
        left: bounds.x + bounds.w + 113,
        top: bounds.y + bounds.h * 0.100 + 8,
        width: bounds.w * 0.290,
        height: bounds.h * 0.076,
        zIndex: 89,
        background: "#000", borderRadius: 14,
        display: "flex", overflow: "hidden",
      }}>
        <WinnerCell w={ganhadores[0]} onClick={() => setSelectedWinner(ganhadores[0])} />
        <div style={{ width: 1, background: "#2a2a2a", flexShrink: 0, margin: "6px 0" }} />
        <WinnerCell w={ganhadores[1]} onClick={() => setSelectedWinner(ganhadores[1])} />
      </div>

      {/* ── TARJA GANHADORES 2 — ao lado direito, abaixo da tarja 1 ── */}
      <div style={{
        position: "absolute",
        left: bounds.x + bounds.w + 113,
        top: bounds.y + bounds.h * 0.100 + 8 + bounds.h * 0.076 + 8,
        width: bounds.w * 0.290,
        height: bounds.h * 0.076,
        zIndex: 89,
        background: "#000", borderRadius: 14,
        display: "flex", overflow: "hidden",
      }}>
        <WinnerCell w={ganhadores[2]} onClick={() => setSelectedWinner(ganhadores[2])} />
        <div style={{ width: 1, background: "#2a2a2a", flexShrink: 0, margin: "6px 0" }} />
        <WinnerCell w={ganhadores[3]} onClick={() => setSelectedWinner(ganhadores[3])} />
      </div>
      </>)}

      {/* ── POPUP GANHADOR ── */}
      {selectedWinner && (
        <div
          onClick={() => setSelectedWinner(null)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 180, paddingRight: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0d0d0d, #1a1200)",
              border: "2px solid #FFD700",
              borderRadius: 16,
              padding: "14px 16px",
              width: 200,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 0 30px rgba(255,200,0,0.25)",
              position: "relative",
            }}
          >
            <button onClick={() => setSelectedWinner(null)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "#aaa", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>🏆 Ganhador</div>
            <div style={{ width: 80, height: 80, borderRadius: 6, overflow: "hidden", border: "2.5px solid #FFD700", background: "#1a1a30", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selectedWinner.foto
                ? <img src={selectedWinner.foto} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 28 }}>👤</span>}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>{selectedWinner.nome || "—"}</div>
              <div style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>{selectedWinner.cidadeEstado || ""}</div>
            </div>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 18, textShadow: "0 0 12px rgba(255,200,0,0.5)" }}>
              R$ {selectedWinner.valor || "—"}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RANKING — imagem ampliada ao clicar ── */}
      {showRankingModal && (
        <div
          onClick={() => setShowRankingModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 600,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <button
              onClick={() => setShowRankingModal(false)}
              style={{
                position: "absolute", top: -12, right: -12,
                background: "#222", border: "2px solid #555",
                color: "#fff", borderRadius: "50%", width: 32, height: 32,
                fontSize: 16, cursor: "pointer", zIndex: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
            <img
              src="/ranking_preview.jpeg"
              alt="Ranking"
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                borderRadius: 14,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>
      )}

      {/* ── MODAL ENTRADA NO RANKING ── */}
      {showRankingEntryModal && rankingEntryScope && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483642,
          background: "rgba(0,0,0,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #1a0a00, #0d0d0d, #1a0a00)",
            border: "3px solid #FFD700",
            borderRadius: 24,
            maxWidth: 380, width: "100%",
            padding: "32px 24px",
            textAlign: "center",
            boxShadow: "0 0 80px rgba(255,215,0,0.5)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>🏆🎉</div>
            <div style={{
              color: "#FFD700", fontWeight: 900, fontSize: 20,
              marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase",
              textShadow: "0 0 20px rgba(255,200,0,0.6)",
            }}>
              PARABÉNS!
            </div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Você acaba de entrar no ranking {rankingEntryScope === "brasil" ? "do Brasil" : rankingEntryScope === "estado" ? "do seu Estado" : "da sua Cidade"}!
            </div>
            <div style={{ color: "#ccc", fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Agora você será exibido em destaque. Cole o link da sua rede social para que outros jogadores possam seguir você:
            </div>
            <input
              type="text"
              value={rankingLinkInput}
              onChange={(e) => setRankingLinkInput(e.target.value)}
              placeholder="https://instagram.com/seu_perfil"
              style={{
                width: "100%", padding: "12px 14px",
                background: "#111", border: "2px solid #FFD700",
                borderRadius: 12, color: "#fff", fontSize: 14,
                outline: "none", marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={async () => {
                if (!userId || !rankingLinkInput.trim()) return;
                await apiCall(`/users/${userId}/ranking-social-link`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ link: rankingLinkInput.trim() }),
                });
                setShowRankingEntryModal(false);
                setRankingLinkInput("");
                showToast("🎉 Link salvo! Você está no ranking!");
              }}
              style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                border: "none", borderRadius: 12,
                color: "#000", fontWeight: 900, fontSize: 16,
                cursor: "pointer", textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              💾 SALVAR MEU LINK
            </button>
            <button
              onClick={() => { setShowRankingEntryModal(false); setRankingLinkInput(""); }}
              style={{
                width: "100%", padding: "10px", marginTop: 10,
                background: "none", border: "1px solid #555",
                borderRadius: 12, color: "#888", fontWeight: 700, fontSize: 13,
                cursor: "pointer",
              }}
            >
              Depois
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL PROMOÇÃO 100 JOGADAS ── */}
      {showPromoModal && (
        <div
          onClick={() => setShowPromoModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, #0d0d0d, #1a0a00, #0d0d0d)",
              border: "3px solid #FFD700",
              borderRadius: 24,
              padding: "28px 24px 24px",
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 0 60px 15px rgba(255,140,0,0.35), 0 0 120px 30px rgba(255,0,80,0.15)",
              position: "relative",
            }}
          >
            {/* Fechar */}
            <button
              onClick={() => setShowPromoModal(false)}
              style={{
                position: "absolute", top: 12, right: 14,
                background: "none", border: "none", color: "#aaa",
                fontSize: 22, cursor: "pointer", lineHeight: 1,
              }}
            >✕</button>

            {/* Ícone */}
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🎁🏆🎉</div>

            {/* Título */}
            <div style={{
              color: "#FFD700",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 1,
              textShadow: "0 0 20px rgba(255,200,0,0.6)",
              marginBottom: 18,
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}>
              {promoConfig.titulo}!
            </div>

            {/* Cards das etapas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>

              {/* Etapa 1 – 20 indicações */}
              <div style={{
                background: "linear-gradient(135deg, rgba(0,180,80,0.15), rgba(0,100,40,0.25))",
                border: "1.5px solid rgba(0,220,100,0.5)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>🥈</span>
                  <span style={{ color: "#7FFF00", fontWeight: 900, fontSize: 16 }}>{promoConfig.meta1Indicacoes} INDICAÇÕES</span>
                </div>
                <div style={{ color: "#d4f7d4", fontSize: 13, lineHeight: 1.5 }}>
                  Indique <strong style={{ color: "#7FFF00" }}>{promoConfig.meta1Indicacoes} pessoas válidas</strong> e ganhe<br />
                  <strong style={{ color: "#FFD700", fontSize: 15 }}>+{promoConfig.meta1Jogadas} JOGADAS GRÁTIS</strong> na hora!
                </div>
              </div>

              {/* Etapa 2 */}
              <div style={{
                background: "linear-gradient(135deg, rgba(255,140,0,0.15), rgba(180,60,0,0.25))",
                border: "1.5px solid rgba(255,180,0,0.6)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>🥇</span>
                  <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 16 }}>{promoConfig.meta2Indicacoes} INDICAÇÕES EM {promoConfig.meta2Dias} DIAS</span>
                </div>
                <div style={{ color: "#fff0cc", fontSize: 13, lineHeight: 1.5 }}>
                  Indique <strong style={{ color: "#FFD700" }}>{promoConfig.meta2Indicacoes} pessoas válidas</strong> em até {promoConfig.meta2Dias} dias e ganhe<br />
                  <strong style={{ color: "#FFD700", fontSize: 15 }}>+{promoConfig.meta2Jogadas} JOGADAS GRÁTIS!</strong>
                </div>
              </div>

              {/* Bônus contínuo */}
              <div style={{
                background: "linear-gradient(135deg, rgba(100,0,200,0.15), rgba(60,0,120,0.25))",
                border: "1.5px solid rgba(180,80,255,0.5)",
                borderRadius: 14,
                padding: "12px 16px",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>⭐</span>
                  <span style={{ color: "#cc88ff", fontWeight: 900, fontSize: 15 }}>BÔNUS CONTÍNUO</span>
                </div>
                <div style={{ color: "#e8d4ff", fontSize: 13, lineHeight: 1.5 }}>
                  Além disso, você continua ganhando<br />
                  <strong style={{ color: "#cc88ff", fontSize: 15 }}>+{promoConfig.bonusPorIndicacao} JOGADAS</strong> por cada indicação válida!
                </div>
              </div>
            </div>

            {/* Botão compartilhar */}
            <button
              onClick={() => { setShowPromoModal(false); setShowInviteScreen(true); }}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #ff6a00, #ee0979)",
                border: "2px solid #FFD700",
                borderRadius: 50,
                color: "#FFD700",
                fontWeight: 900,
                fontSize: 15,
                padding: "13px 0",
                cursor: "pointer",
                letterSpacing: 1,
                textTransform: "uppercase",
                boxShadow: "0 0 20px rgba(255,80,0,0.4)",
              }}
            >
              🚀 QUERO PARTICIPAR AGORA!
            </button>
          </div>
        </div>
      )}

      {/* ── BOTÃO VOLTAR — só aparece no modo Gol da Sorte ── */}
      {showGolDaSorte && (
        <button
          onClick={() => { setShowGolDaSorte(false); setGameActive(false); setCorrectPicks([]); setErrorBall(null); setCurrentRow(0); }}
          style={{
            position: "fixed", top: 14, left: 14, zIndex: 2000,
            background: "linear-gradient(135deg, #1a0a00, #3a1a00)",
            border: "2px solid #FFD700",
            borderRadius: 10, color: "#FFD700",
            fontWeight: 900, fontSize: 13,
            padding: "8px 14px", cursor: "pointer",
            boxShadow: "0 0 12px rgba(255,215,0,0.35)",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          🏴‍☠️ ← VOLTAR
        </button>
      )}

      {/* ── PWA INSTALL PROMPT ── */}
      <InstallPrompt />

      {/* ── ACESSO ADMIN — removido para usuários comuns ── */}

      {/* ── CELEBRAÇÃO DE BÔNUS ── */}
      {bonusCelebration && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: bonusCelebration.big
              ? "linear-gradient(135deg,#1a0033,#3d006b,#1a0033)"
              : "linear-gradient(135deg,#1a2a00,#2d5000,#1a2a00)",
            border: `3px solid ${bonusCelebration.big ? "#FFD700" : "#7FFF00"}`,
            borderRadius: 24,
            padding: "28px 40px",
            textAlign: "center",
            boxShadow: `0 0 60px 20px ${bonusCelebration.big ? "rgba(255,180,0,0.6)" : "rgba(80,255,0,0.4)"}`,
            animation: "bonusPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
          }}>
            <div style={{ fontSize: bonusCelebration.big ? 52 : 44, lineHeight: 1, marginBottom: 6 }}>
              {bonusCelebration.big ? "🏆🎺🎉" : "⭐🎺"}
            </div>
            <div style={{
              color: bonusCelebration.big ? "#FFD700" : "#7FFF00",
              fontSize: bonusCelebration.big ? 48 : 40,
              fontWeight: 900,
              lineHeight: 1,
              textShadow: `0 0 20px ${bonusCelebration.big ? "#FFD700" : "#7FFF00"}`,
              letterSpacing: 2,
            }}>
              +{bonusCelebration.amount} JOGADA{bonusCelebration.amount > 1 ? "S" : ""}!
            </div>
            <div style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              marginTop: 8,
              opacity: 0.9,
            }}>
              {bonusCelebration.big ? "INCRÍVEL! Você chegou à 5ª linha!" : "Muito bem! Você chegou à 4ª linha!"}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VOCÊ É O NOVO CAMPEÃO ── */}
      {showChampionModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483641,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "#111",
            border: "2px solid #FFD700",
            borderRadius: 20,
            maxWidth: 340, width: "100%",
            padding: "28px 24px",
            textAlign: "center",
            boxShadow: "0 0 60px rgba(255,215,0,0.4)",
          }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 20, marginBottom: 6 }}>
              VOCÊ É O NOVO CAMPEÃO!
            </div>
            <div style={{ color: "#ccc", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Cole o link do seu perfil nas redes sociais para que os jogadores possam te seguir e ganhar 3 jogadas.
            </div>
            <input
              type="url"
              placeholder="https://instagram.com/seu_perfil"
              value={championLinkInput}
              onChange={e => setChampionLinkInput(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#1a1a1a", border: "1.5px solid #444",
                borderRadius: 10, padding: "10px 12px",
                color: "#fff", fontSize: 14, marginBottom: 16,
                outline: "none",
              }}
            />
            <button
              onClick={async () => {
                const link = championLinkInput.trim();
                if (!link || !userId || !userInfo) return;
                await apiCall("/settings/atual-campeao", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    nome: userInfo.name,
                    cidadeEstado: `${userInfo.cidade} - ${userInfo.estado}`,
                    foto: userInfo.fotoBase64 || "",
                    linkSocial: link,
                    userId: String(userId),
                  }),
                });
                setAtualCampeao({
                  nome: userInfo.name,
                  cidadeEstado: `${userInfo.cidade} - ${userInfo.estado}`,
                  foto: userInfo.fotoBase64 || "",
                  linkSocial: link,
                  userId: String(userId),
                });
                setChampionFollowClaimed(String(userId));
                localStorage.setItem("claimedChampionUserId", String(userId));
                setShowChampionModal(false);
                showToast("🏆 Você agora é o Atual Campeão!");
              }}
              disabled={!championLinkInput.trim()}
              style={{
                width: "100%", padding: "12px",
                background: championLinkInput.trim() ? "#FFD700" : "#333",
                color: championLinkInput.trim() ? "#000" : "#666",
                fontWeight: 800, fontSize: 15,
                border: "none", borderRadius: 12, cursor: championLinkInput.trim() ? "pointer" : "not-allowed",
                marginBottom: 10,
              }}
            >
              CONFIRMAR E VIRAR CAMPEÃO
            </button>
            <button
              onClick={() => setShowChampionModal(false)}
              style={{
                background: "none", border: "none", color: "#666",
                fontSize: 13, cursor: "pointer", textDecoration: "underline",
              }}
            >
              Pular por agora
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: SEGUIR CAMPEÃO ── */}
      {showChampionFollowModal && atualCampeao?.nome && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483641,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "#111",
            border: "2px solid #FFD700",
            borderRadius: 20,
            maxWidth: 340, width: "100%",
            padding: "28px 24px",
            textAlign: "center",
            boxShadow: "0 0 60px rgba(255,215,0,0.4)",
          }}>
            <button
              onClick={() => { setShowChampionFollowModal(false); setHasClickedChampionLink(false); }}
              style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "#666", fontSize: 20, cursor: "pointer" }}
            >✕</button>
            <div style={{ fontSize: 44, marginBottom: 6 }}>🏆</div>
            <div style={{ color: "#FFD700", fontWeight: 900, fontSize: 16, marginBottom: 4 }}>
              ATUAL CAMPEÃO
            </div>
            {atualCampeao.foto ? (
              <img src={atualCampeao.foto} style={{
                width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                border: "2px solid #FFD700", margin: "8px auto 4px",
                display: "block",
              }} />
            ) : (
              <div style={{ fontSize: 48, margin: "8px 0 4px" }}>👤</div>
            )}
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, marginBottom: 2 }}>
              {atualCampeao.nome}
            </div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
              {atualCampeao.cidadeEstado}
            </div>
            <div style={{ color: "#ccc", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Siga o campeão nas redes sociais e ganhe <strong style={{ color: "#FFD700" }}>3 jogadas grátis!</strong>
            </div>

            {/* Etapa 1: abrir link */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (atualCampeao.linkSocial) {
                  window.open(atualCampeao.linkSocial, "_blank");
                  setHasClickedChampionLink(true);
                }
              }}
              style={{
                width: "100%", padding: "12px",
                background: "#1a1a2e", border: "1.5px solid #4a90d9",
                color: "#4a90d9", fontWeight: 700, fontSize: 15,
                borderRadius: 12, cursor: "pointer", marginBottom: 10,
              }}
            >
              📱 Abrir perfil e seguir
            </button>

            {/* Etapa 2: confirmar que seguiu */}
            {(atualCampeao.userId && championFollowClaimed === atualCampeao.userId) ? (
              <div style={{
                background: "rgba(0,200,0,0.1)", border: "1px solid #0c0",
                borderRadius: 12, padding: "12px",
                color: "#0c0", fontWeight: 700, fontSize: 14,
              }}>
                ✅ Bônus já resgatado!
              </div>
            ) : (
              <button
                disabled={!hasClickedChampionLink}
                onClick={async () => {
                  if (!userId || !atualCampeao.userId) return;
                  const data = await apiCall(`/users/${userId}/seguir-campeao`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ campeonUserId: Number(atualCampeao.userId) }),
                  });
                  if (data?.error) {
                    if (data.error.includes("já resgatou")) {
                      setChampionFollowClaimed(atualCampeao.userId);
                      localStorage.setItem("claimedChampionUserId", atualCampeao.userId);
                    }
                    showToast(data.error);
                    return;
                  }
                  if (data?.user) {
                    setPlaysRemaining(data.user.playsRemaining);
                    setChampionFollowClaimed(atualCampeao.userId);
                    localStorage.setItem("claimedChampionUserId", atualCampeao.userId);
                    setShowChampionFollowModal(false);
                    setHasClickedChampionLink(false);
                    showToast("🎉 +3 jogadas! Obrigado por seguir o campeão!");
                  }
                }}
                style={{
                  width: "100%", padding: "12px",
                  background: hasClickedChampionLink ? "#FFD700" : "#333",
                  color: hasClickedChampionLink ? "#000" : "#666",
                  fontWeight: 800, fontSize: 15,
                  border: "none", borderRadius: 12,
                  cursor: hasClickedChampionLink ? "pointer" : "not-allowed",
                }}
              >
                {hasClickedChampionLink ? "✅ Já segui! Quero minhas 3 jogadas" : "① Abra o perfil acima primeiro"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL BRINDE ── */}
      {showBrindeModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483641,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "2px solid #FFD700",
            borderRadius: 20, maxWidth: 340, width: "100%",
            padding: "32px 24px", textAlign: "center",
            boxShadow: "0 0 60px rgba(255,215,0,0.5)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎁</div>
            <div style={{
              color: "#FFD700", fontWeight: 900, fontSize: 22,
              marginBottom: 10, letterSpacing: 1, textTransform: "uppercase",
            }}>
              VOCÊ GANHOU!
            </div>
            <div style={{
              color: "#fff", fontSize: 16, lineHeight: 1.6,
              marginBottom: 8, fontWeight: 700,
            }}>
              🏆 BRINDE ESPECIAL 🏆
            </div>
            <div style={{
              color: "#FFD700", fontSize: 18, fontWeight: 900,
              marginBottom: 24, padding: "12px 16px",
              background: "rgba(255,215,0,0.1)", borderRadius: 12,
              border: "1px solid rgba(255,215,0,0.3)",
            }}>
              {brindeText}
            </div>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 20 }}>
              Entre em contato com o organizador para resgatar seu prêmio!
            </div>
            <button onClick={() => setShowBrindeModal(false)} style={{
              background: "#FFD700", border: "none", borderRadius: 12,
              color: "#000", fontWeight: 900, fontSize: 16,
              padding: "14px 32px", cursor: "pointer", width: "100%",
            }}>
              ENTENDIDO! 🎉
            </button>
          </div>
        </div>
      )}

      {/* ── PAINEL ADMIN ── */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} skipAuth={isAdminMode} />}

      {showChatRoom && userId && (
        <ChatRoom
          userId={userId}
          userName={userInfo?.name ?? "Jogador"}
          userFoto={userInfo?.fotoBase64 ?? null}
          onClose={() => setShowChatRoom(false)}
        />
      )}

      {/* Modal de mensagem broadcast */}
      {broadcastModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483640,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            background: "#1a1a2e", border: "2px solid #f97316",
            borderRadius: 18, maxWidth: 360, width: "100%",
            padding: "28px 24px", textAlign: "center",
            boxShadow: "0 0 40px rgba(249,115,22,0.35)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📢</div>
            <div style={{
              color: "#f97316", fontWeight: 800, fontSize: 16,
              marginBottom: 14, letterSpacing: 0.5,
            }}>
              Aviso do Organizador
            </div>
            <div style={{
              color: "#e5e5e5", fontSize: 14, lineHeight: 1.6,
              marginBottom: 24, whiteSpace: "pre-wrap",
            }}>
              {broadcastModal}
            </div>
            <button
              onClick={() => {
                const seen = localStorage.getItem("seenBroadcastId");
                apiCall("/settings/broadcast").then(data => {
                  if (data?.broadcastId) {
                    localStorage.setItem("seenBroadcastId", data.broadcastId);
                  }
                });
                setBroadcastModal(null);
              }}
              style={{
                background: "#f97316", color: "#fff", border: "none",
                borderRadius: 12, padding: "13px 36px", fontSize: 15,
                fontWeight: 700, cursor: "pointer", width: "100%",
                letterSpacing: 0.4,
              }}
            >
              Entendido ✓
            </button>
          </div>
        </div>
      )}



      {/* Botão Testar Voz — ao lado do admin */}
      <button
        onClick={(e) => { e.stopPropagation(); speakMessage("Atenção! Nova performance! João, cidade de Piranhas, estado de Alagoas. Siga o novo campeão e ganhe 3 jogadas e 5 pontos para o ranking!", 0); }}
        style={{
          position: "fixed", top: 12, right: 56, zIndex: 2147483638,
          background: "rgba(10,10,20,0.9)", border: "1.5px solid rgba(0,230,120,0.6)",
          borderRadius: "50%", color: "#0f0", fontSize: 18,
          width: 40, height: 40, cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}
        title="Testar voz do campeão"
      >🔊</button>

      {/* Botão Admin — canto inferior esquerdo, longe dos elementos do jogo */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowAdmin(true); }}
        style={{
          position: "fixed", bottom: 12, left: 12, zIndex: 2147483639,
          background: "rgba(10,10,20,0.9)", border: "1.5px solid rgba(255,215,0,0.6)",
          borderRadius: "50%", color: "gold", fontSize: 18,
          width: 40, height: 40, cursor: "pointer",
          boxShadow: "0 2px 10px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}
        title="Painel Admin"
      >⚙️</button>

      <style>{`
        @keyframes bonusPop {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes megaPop {
          0%   { transform: scale(0.2) rotate(-6deg); opacity: 0; }
          60%  { transform: scale(1.06) rotate(2deg); opacity: 1; }
          80%  { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes jogadasPop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.18); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes promoPulse {
          0%   { box-shadow: 0 0 18px 5px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5); transform: scale(1); }
          50%  { box-shadow: 0 0 32px 12px rgba(255,30,120,0.75), 0 4px 20px rgba(0,0,0,0.6); transform: scale(1.06); }
          100% { box-shadow: 0 0 18px 5px rgba(255,80,0,0.55), 0 4px 16px rgba(0,0,0,0.5); transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
