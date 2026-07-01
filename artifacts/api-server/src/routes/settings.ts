import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { readFile, writeFile } from "node:fs/promises";
import { broadcastEvent } from "../app";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIRATE_PATH_FILE = path.resolve(__dirname, "..", "..", "pirate_path.json");

async function getSetting(key: string, fallback = ""): Promise<string> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? fallback;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

async function readPiratePathJson(): Promise<{ x: number; y: number; label?: number }[] | null> {
  try {
    const raw = await readFile(PIRATE_PATH_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writePiratePathJson(path: { x: number; y: number }[]): Promise<void> {
  try {
    await writeFile(PIRATE_PATH_FILE, JSON.stringify(path, null, 2));
  } catch (e) {
    console.error("[PiratePath] Falha ao salvar pirate_path.json:", e);
  }
}

router.get("/valor-acumulado", async (_req, res) => {
  try {
    const valor = await getSetting("valor_acumulado", "0");
    res.json({ valor });
  } catch {
    res.status(500).json({ error: "Erro ao buscar valor acumulado" });
  }
});

router.post("/valor-acumulado", async (req, res) => {
  try {
    const { valor } = req.body as { valor: string };
    if (!valor || isNaN(Number(valor.replace(",", ".")))) {
      res.status(400).json({ error: "Valor inválido" }); return;
    }
    await setSetting("valor_acumulado", valor);
    broadcastEvent({ type: "valor_acumulado", data: { valor } });
    res.json({ ok: true, valor }); return;
  } catch {
    res.status(500).json({ error: "Erro ao atualizar valor acumulado" }); return;
  }
});

router.get("/ultimo-ganhador", async (_req, res) => {
  try {
    const [nome, cidadeEstado, valor, foto] = await Promise.all([
      getSetting("ug_nome", ""),
      getSetting("ug_cidade_estado", ""),
      getSetting("ug_valor", ""),
      getSetting("ug_foto", ""),
    ]);
    res.json({ nome, cidadeEstado, valor, foto });
  } catch {
    res.status(500).json({ error: "Erro ao buscar último ganhador" });
  }
});

router.post("/ultimo-ganhador", async (req, res) => {
  try {
    const { nome, cidadeEstado, valor, foto } = req.body as {
      nome?: string; cidadeEstado?: string; valor?: string; foto?: string;
    };
    await Promise.all([
      nome !== undefined ? setSetting("ug_nome", nome) : Promise.resolve(),
      cidadeEstado !== undefined ? setSetting("ug_cidade_estado", cidadeEstado) : Promise.resolve(),
      valor !== undefined ? setSetting("ug_valor", valor) : Promise.resolve(),
      foto !== undefined ? setSetting("ug_foto", foto) : Promise.resolve(),
    ]);
    broadcastEvent({ type: "ultimo_ganhador", data: { nome, cidadeEstado, valor, foto } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar último ganhador" });
  }
});

// ── Broadcast message (public) ────────────────────────────────────────────────

router.get("/broadcast", async (_req, res) => {
  try {
    const [message, broadcastId] = await Promise.all([
      getSetting("broadcast_message", ""),
      getSetting("broadcast_id", ""),
    ]);
    res.json({ message, broadcastId });
  } catch {
    res.status(500).json({ error: "Erro ao buscar mensagem" });
  }
});

// ── Últimos 4 Ganhadores (public) ────────────────────────────────────────────

router.get("/ultimos-ganhadores", async (_req, res) => {
  try {
    const winners = await Promise.all([1, 2, 3, 4].map(async i => ({
      nome: await getSetting(`gan${i}_nome`, ""),
      cidadeEstado: await getSetting(`gan${i}_cidade_estado`, ""),
      valor: await getSetting(`gan${i}_valor`, ""),
      foto: await getSetting(`gan${i}_foto`, ""),
    })));
    res.json(winners);
  } catch {
    res.status(500).json({ error: "Erro ao buscar ganhadores" });
  }
});

// ── Promoção (public) ─────────────────────────────────────────────────────────

router.get("/promocao", async (_req, res) => {
  try {
    const keys = [
      "promo_ativa",
      "promo_titulo",
      "promo_meta1_indicacoes",
      "promo_meta1_jogadas",
      "promo_meta2_indicacoes",
      "promo_meta2_dias",
      "promo_meta2_jogadas",
      "promo_bonus_por_indicacao",
    ];
    const rows = await Promise.all(keys.map(k => getSetting(k, "")));
    res.json({
      ativa: rows[0] !== "false",
      titulo: rows[1] || "GANHE 100 JOGADAS GRÁTIS",
      meta1Indicacoes: rows[2] || "20",
      meta1Jogadas: rows[3] || "50",
      meta2Indicacoes: rows[4] || "30",
      meta2Dias: rows[5] || "30",
      meta2Jogadas: rows[6] || "100",
      bonusPorIndicacao: rows[7] || "3",
    });
  } catch {
    res.status(500).json({ error: "Erro ao buscar promoção" });
  }
});

// ── Game Config (public) ──────────────────────────────────────────────────────

router.get("/game-config", async (_req, res) => {
  try {
    const keys = [
      "row_wrong_counts",
      "r5_prize_type",
      "r5_prize_value",
      "r5_prize_ball_count",
      "bonus_row3",
      "bonus_row4",
      "bonus_row5",
      "premiacao_ativa",
    ];
    const rows = await Promise.all(keys.map(k => getSetting(k, "")));
    res.json({
      rowWrongCounts: rows[0] ? rows[0].split(",").map(Number) : [2, 2, 2, 2, 2, 2],
      r5PrizeType: rows[1] || "jogadas",
      r5PrizeValue: rows[2] || "15",
      r5PrizeBallCount: parseInt(rows[3] || "1"),
      bonusRow3: parseInt(rows[4] || "1"),
      bonusRow4: parseInt(rows[5] || "5"),
      bonusRow5: parseInt(rows[6] || "50"),
      premiacaoAtiva: rows[7] !== "false",
    });
  } catch {
    res.status(500).json({ error: "Erro ao buscar configurações do jogo" });
  }
});

// ── Pirate Path (tabuleiro) ───────────────────────────────────────────────────

router.get("/pirate-path", async (_req, res) => {
  try {
    const value = await getSetting("pirate_path", "");
    if (value) {
      const path = JSON.parse(value);
      res.json({ path });
      return;
    }
    // Fallback: read from JSON file (persists with code on transfer)
    const jsonPath = await readPiratePathJson();
    if (jsonPath) {
      res.json({ path: jsonPath });
      return;
    }
    res.json({ path: null });
  } catch {
    res.json({ path: null });
  }
});

router.post("/pirate-path", async (req, res) => {
  try {
    const { path } = req.body as { path: { x: number; y: number }[] };
    if (!Array.isArray(path) || path.length === 0) {
      res.status(400).json({ error: "Path inválido" }); return;
    }
    // Save to DB (runtime) and to JSON file (persists with code)
    await setSetting("pirate_path", JSON.stringify(path));
    await writePiratePathJson(path);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao salvar path" });
  }
});

// ── Atual Campeão ─────────────────────────────────────────────────────────────

router.get("/atual-campeao", async (_req, res) => {
  try {
    const [nome, cidadeEstado, foto, linkSocial, userId] = await Promise.all([
      getSetting("campeon_nome", ""),
      getSetting("campeon_cidade_estado", ""),
      getSetting("campeon_foto", ""),
      getSetting("campeon_link_social", ""),
      getSetting("campeon_user_id", ""),
    ]);
    res.json({ nome, cidadeEstado, foto, linkSocial, userId });
  } catch {
    res.status(500).json({ error: "Erro ao buscar campeão" });
  }
});

router.post("/atual-campeao", async (req, res) => {
  try {
    const { nome, cidadeEstado, foto, linkSocial, userId } = req.body as {
      nome?: string; cidadeEstado?: string; foto?: string; linkSocial?: string; userId?: string | number;
    };
    await Promise.all([
      nome !== undefined ? setSetting("campeon_nome", nome) : Promise.resolve(),
      cidadeEstado !== undefined ? setSetting("campeon_cidade_estado", cidadeEstado) : Promise.resolve(),
      foto !== undefined ? setSetting("campeon_foto", foto) : Promise.resolve(),
      linkSocial !== undefined ? setSetting("campeon_link_social", linkSocial) : Promise.resolve(),
      userId !== undefined ? setSetting("campeon_user_id", String(userId)) : Promise.resolve(),
    ]);
    broadcastEvent({ type: "atual_campeao", data: { nome, cidadeEstado, foto, linkSocial, userId: String(userId) } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar campeão" });
  }
});

export default router;
