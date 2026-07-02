import { Router, Request } from "express";
import { db, usersTable, referralsTable, rankingFollowsTable } from "@workspace/db";
import { eq, and, sql, gte, desc, notInArray } from "drizzle-orm";
import { sendEvent, broadcastEvent } from "../app";

const router = Router();

const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,
  21,22,24,27,28,
  31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,
  51,53,54,55,
  61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,
  81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99,
]);

function isValidBrazilianPhone(digits: string): boolean {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return false;
  const numberPart = digits.slice(2);
  if (new Set(numberPart).size === 1) return false;
  if (digits.length === 11) {
    if (digits[2] !== "9") return false;
    if (parseInt(digits[3]) < 6) return false;
  }
  if (digits.length === 10) {
    const third = parseInt(digits[2]);
    if (third < 2 || third > 5) return false;
  }
  return true;
}

function generateReferralCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Helper: Get client IP ───────────────────────────────────────────────────
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket.remoteAddress || "127.0.0.1";
}

// ── Register ────────────────────────────────────────────────────────────────

router.post("/register", async (req, res) => {
  const { name, phone, cidade, estado, fotoBase64, referralCode } = req.body as {
    name: string;
    phone: string;
    cidade: string;
    estado: string;
    fotoBase64?: string;
    referralCode?: string;
  };

  if (!name || !phone || !cidade || !estado) {
    res.status(400).json({ error: "Nome, telefone, cidade e estado são obrigatórios." });
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (!isValidBrazilianPhone(cleanPhone)) {
    res.status(400).json({ error: "Número de telefone inválido. Use um celular brasileiro com DDD. Ex: 11987654321" });
    return;
  }

  const existingPhone = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, cleanPhone));
  if (existingPhone.length > 0) {
    res.status(409).json({ error: "Este telefone já está cadastrado. Use 'Já tenho conta'." });
    return;
  }

  const clientIp = getClientIp(req);
  const myCode = generateReferralCode();

  let referredById: number | null = null;
  if (referralCode) {
    const referrer = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (referrer.length > 0) {
      referredById = referrer[0].id;
    }
  }

  const [user] = await db.insert(usersTable).values({
    name,
    phone: cleanPhone,
    cidade,
    estado: estado.toUpperCase(),
    fotoBase64: fotoBase64 || null,
    ipAddress: clientIp,
    referralCode: myCode,
    referredById: referredById ?? undefined,
    playsRemaining: 10,
  }).returning();

  if (referredById) {
    await db.insert(referralsTable).values({
      referrerId: referredById,
      referredId: user.id,
      rewarded: false,
    });
  }

  res.json({ user });
});

router.get("/by-phone/:phone", async (req, res) => {
  const { phone } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ user });
});

router.get("/online", async (_req, res) => {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, cidade: usersTable.cidade, fotoBase64: usersTable.fotoBase64 })
    .from(usersTable)
    .where(gte(usersTable.ultimoLogin, since))
    .orderBy(desc(usersTable.ultimoLogin))
    .limit(50);
  res.json({ users });
});

router.post("/heartbeat/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({ ultimoLogin: new Date() }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// ── Localização dos usuários por cidade/estado (mapa) ───────────────────
router.get("/locations", async (_req, res) => {
  try {
    const users = await db
      .select({ name: usersTable.name, cidade: usersTable.cidade, estado: usersTable.estado })
      .from(usersTable)
      .where(sql`${usersTable.estado} IS NOT NULL AND ${usersTable.estado} != '' AND ${usersTable.cidade} IS NOT NULL AND ${usersTable.cidade} != ''`);

    const cidadesMap: Record<string, { estado: string; cidade: string; nomes: string[] }> = {};
    for (const u of users) {
      const key = `${u.estado}-${u.cidade}`;
      if (!cidadesMap[key]) cidadesMap[key] = { estado: u.estado, cidade: u.cidade, nomes: [] };
      cidadesMap[key].nomes.push(u.name);
    }

    const cidades = Object.values(cidadesMap);

    // Também retornar totais por estado
    const estadosMap: Record<string, { estado: string; count: number }> = {};
    for (const u of users) {
      if (!estadosMap[u.estado]) estadosMap[u.estado] = { estado: u.estado, count: 0 };
      estadosMap[u.estado].count++;
    }

    res.json({ cidades, estados: Object.values(estadosMap) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar localizações" });
  }
});

// ── Posições pirata (multiplayer) — deve vir ANTES de /:id ─────────────────
router.get("/pirate-positions", async (_req, res) => {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      fotoBase64: usersTable.fotoBase64,
      piratePos: usersTable.piratePos,
      lastPirateMove: usersTable.lastPirateMove,
    })
    .from(usersTable)
    .where(gte(usersTable.ultimoLogin, since));
  res.json({ users });
});

router.patch("/:id/pirate-pos", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { pos } = req.body as { pos: number };
  if (typeof pos !== "number" || pos < 0) { res.status(400).json({ error: "Invalid pos" }); return; }
  const [updated] = await db.update(usersTable)
    .set({ piratePos: pos, lastPirateMove: new Date() })
    .where(eq(usersTable.id, id))
    .returning({ piratePos: usersTable.piratePos });
  // Notifica o jogador em tempo real se ele foi derrubado (pos 0)
  if (pos === 0) {
    sendEvent(id, { type: "knockback", data: { pos: 0, message: "Você foi derrubado e voltou para o início!" } });
  }
  // Notifica todos os jogadores sobre mudança de posição no tabuleiro pirata
  broadcastEvent({ type: "pirate_moved", data: { userId: id, piratePos: updated?.piratePos ?? pos } });
  res.json({ ok: true, piratePos: updated?.piratePos ?? pos });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json({ user });
});

router.post("/:id/use-play", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select({ playsRemaining: usersTable.playsRemaining, freePlaysTotalUsed: usersTable.freePlaysTotalUsed, referralUnlocked: usersTable.referralUnlocked }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const plays = Math.max(0, (user.playsRemaining ?? 0) - 1);
  let freePlaysTotalUsed = user.freePlaysTotalUsed ?? 0;
  const referralUnlocked = user.referralUnlocked ?? false;
  if ((user.playsRemaining ?? 0) > 0 && freePlaysTotalUsed < 10) {
    freePlaysTotalUsed += 1;
  }
  const [updated] = await db.update(usersTable).set({ playsRemaining: plays, freePlaysTotalUsed, referralUnlocked }).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

router.post("/:id/credit-plays", async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body as { amount?: number };
  if (!id || isNaN(id) || typeof amount !== "number") { res.status(400).json({ error: "Invalid id or amount" }); return; }
  const [user] = await db.select({ playsRemaining: usersTable.playsRemaining }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const newPlays = Math.max(0, (user.playsRemaining ?? 0) + amount);
  const [updated] = await db.update(usersTable).set({ playsRemaining: newPlays }).where(eq(usersTable.id, id)).returning();
  sendEvent(id, { type: "plays_updated", data: { playsRemaining: newPlays } });
  res.json({ user: updated });
});

router.post("/:id/credit-ranking-points", async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body as { amount?: number };
  if (!id || isNaN(id) || typeof amount !== "number") { res.status(400).json({ error: "Invalid id or amount" }); return; }
  const [user] = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const newPoints = Math.max(0, (user.rankingPoints ?? 0) + amount);
  const [updated] = await db.update(usersTable).set({ rankingPoints: newPoints }).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

router.post("/:id/purchase", async (req, res) => {
  const id = parseInt(req.params.id);
  const { planId } = req.body as { planId?: string };
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select({ playsRemaining: usersTable.playsRemaining, paidPlaysUsed: usersTable.paidPlaysUsed, hasPaid: usersTable.hasPaid, cidade: usersTable.cidade, estado: usersTable.estado }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const plans: Record<string, number> = { plan1: 1, plan2: 3, plan3: 5, plan5: 10, plan10: 20, plan20: 50 };
  const plays = plans[planId ?? ""] ?? 5;
  const newPlays = (user.playsRemaining ?? 0) + plays;
  const newPaidPlaysUsed = (user.paidPlaysUsed ?? 0) + plays;
  const [updated] = await db.update(usersTable).set({ playsRemaining: newPlays, paidPlaysUsed: newPaidPlaysUsed, hasPaid: true }).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

router.post("/:id/claim-bonus", async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body as { amount?: number };
  if (!id || isNaN(id) || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Invalid id or amount" }); return;
  }
  const [user] = await db.select({ saldo: usersTable.saldo }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  const newSaldo = (user.saldo ?? 0) + amount;
  const [updated] = await db.update(usersTable).set({ saldo: newSaldo }).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

// ── Referral info ──────────────────────────────────────────────────────────

router.get("/:id/referral-info", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select({
    referralCode: usersTable.referralCode,
    referralUnlocked: usersTable.referralUnlocked,
  }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const allReferrals = await db
    .select({ id: referralsTable.id, rewarded: referralsTable.rewarded })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, id));

  const totalFriends = allReferrals.length;
  const rewardedFriends = allReferrals.filter(r => r.rewarded).length;
  const pendingFriends = totalFriends - rewardedFriends;
  const totalBonusPlays = rewardedFriends * 5;

  res.json({
    referralCode: user.referralCode,
    referralUnlocked: user.referralUnlocked ?? false,
    totalFriends,
    rewardedFriends,
    pendingFriends,
    totalBonusPlays,
  });
});

// ── Referral reward (credit plays) ──────────────────────────────────────────

router.post("/:id/referral-reward", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select({ playsRemaining: usersTable.playsRemaining, referralUnlocked: usersTable.referralUnlocked }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  const referrals = await db
    .select({ id: referralsTable.id, rewarded: referralsTable.rewarded })
    .from(referralsTable)
    .where(and(eq(referralsTable.referrerId, id), eq(referralsTable.rewarded, false)));

  if (referrals.length === 0) {
    res.json({ user, newReferrals: 0 });
    return;
  }

  const bonusPerReferral = 5;
  const totalBonus = referrals.length * bonusPerReferral;
  const newPlays = (user.playsRemaining ?? 0) + totalBonus;

  const [referrerUser] = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(eq(usersTable.id, id));
  const newRankingPoints = (referrerUser?.rankingPoints ?? 0) + referrals.length * 10;

  const [updated] = await db.update(usersTable)
    .set({ playsRemaining: newPlays, referralUnlocked: true, rankingPoints: newRankingPoints })
    .where(eq(usersTable.id, id))
    .returning();

  await db.update(referralsTable)
    .set({ rewarded: true })
    .where(eq(referralsTable.referrerId, id));

  res.json({ user: updated, newReferrals: referrals.length, addedPoints: referrals.length * 10 });
});

// ── RANKING SYSTEM ──

// Adicionar pontos ao jogador (vitória, indicação, online)
router.post("/:id/add-points", async (req, res) => {
  const id = parseInt(req.params.id);
  const { type, amount } = req.body as { type?: string; amount?: number };
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const pointsMap: Record<string, number> = { win: 50, referral: 5, online: 1, follow_champion: 5, follow_ranking: 5 };
  const addPoints = amount ?? pointsMap[type ?? ""] ?? 0;
  if (addPoints <= 0) { res.status(400).json({ error: "Invalid type or amount" }); return; }

  const [user] = await db.select({ rankingPoints: usersTable.rankingPoints, cidade: usersTable.cidade, estado: usersTable.estado }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const newPoints = (user.rankingPoints ?? 0) + addPoints;
  const [updated] = await db.update(usersTable).set({ rankingPoints: newPoints }).where(eq(usersTable.id, id)).returning();

  // Notifica o usuário sobre atualização de pontos
  sendEvent(id, { type: "points_updated", data: { rankingPoints: newPoints, added: addPoints } });

  // Verificar se SUPEROU um LÍDER EXISTENTE (com pontos > 0) em algum escopo
  let enteredRanking: string | null = null;
  const oldPoints = user.rankingPoints ?? 0;
  // Brasil — líder atual (exceto eu)
  const brasilTop = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(sql`${usersTable.id} != ${id}`).orderBy(desc(usersTable.rankingPoints)).limit(1);
  const brasilLeaderPoints = brasilTop[0]?.rankingPoints ?? 0;
  if (brasilLeaderPoints > 0 && oldPoints <= brasilLeaderPoints && newPoints > brasilLeaderPoints) {
    enteredRanking = "brasil";
  } else if (user.estado) {
    // Estado — líder atual do estado (exceto eu)
    const estadoTop = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(and(eq(usersTable.estado, user.estado), sql`${usersTable.id} != ${id}`)).orderBy(desc(usersTable.rankingPoints)).limit(1);
    const estadoLeaderPoints = estadoTop[0]?.rankingPoints ?? 0;
    if (estadoLeaderPoints > 0 && oldPoints <= estadoLeaderPoints && newPoints > estadoLeaderPoints) {
      enteredRanking = "estado";
    } else if (user.cidade) {
      // Cidade — líder atual da cidade (exceto eu)
      const cidadeTop = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(and(eq(usersTable.cidade, user.cidade), sql`${usersTable.id} != ${id}`)).orderBy(desc(usersTable.rankingPoints)).limit(1);
      const cidadeLeaderPoints = cidadeTop[0]?.rankingPoints ?? 0;
      if (cidadeLeaderPoints > 0 && oldPoints <= cidadeLeaderPoints && newPoints > cidadeLeaderPoints) {
        enteredRanking = "cidade";
      }
    }
  }

  // Sempre notifica TODOS os clientes para atualizarem o ranking em tempo real
  broadcastEvent({ type: "ranking_changed", data: { scope: enteredRanking ?? "update", userId: id } });

  res.json({ user: updated, added: addPoints, total: newPoints, enteredRanking });
});

// Atualizar link social do ranking
router.put("/:id/ranking-social-link", async (req, res) => {
  const id = parseInt(req.params.id);
  const { link } = req.body as { link?: string };
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db.update(usersTable).set({ rankingSocialLink: link || null }).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

// ── Atualizar perfil (telefone + link social) ────────────────────────────────
router.put("/:id/profile", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { phone, rankingSocialLink } = req.body as { phone?: string; rankingSocialLink?: string | null };

  const updateData: Partial<typeof usersTable.$inferInsert> = {};

  if (phone !== undefined) {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      res.status(400).json({ error: "Telefone inválido." });
      return;
    }
    // Verifica se o telefone já está em uso por outro usuário
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, cleanPhone));
    if (existing.length > 0 && existing[0].id !== id) {
      res.status(409).json({ error: "Este telefone já está em uso por outro jogador." });
      return;
    }
    updateData.phone = cleanPhone;
  }

  if (rankingSocialLink !== undefined) {
    updateData.rankingSocialLink = rankingSocialLink || null;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar." });
    return;
  }

  const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  res.json({ user: updated });
});

// —— Ranking público com EXCLUSIVIDADE HIERÁRQUICA ——
// Regra: um jogador ocupa apenas 1 ranking (Brasil > Estado > Cidade).
// Se uma pessoa já está no Brasil, ela não ocupa a vaga do Estado/Cidade.
// A próxima pessoa da fila assume essa vaga.

async function getRankings() {
  const allUsers = await db
    .select({ id: usersTable.id, name: usersTable.name, cidade: usersTable.cidade, estado: usersTable.estado, fotoBase64: usersTable.fotoBase64, rankingPoints: usersTable.rankingPoints, rankingSocialLink: usersTable.rankingSocialLink })
    .from(usersTable)
    .orderBy(desc(usersTable.rankingPoints));

  const sorted = [...allUsers].sort((a, b) => (b.rankingPoints ?? 0) - (a.rankingPoints ?? 0));

  // Brasil: 1 campeão
  const brasil = sorted.slice(0, 1);
  const brasilIds = new Set(brasil.map(u => u.id));

  // Estado: 1 campeão de cada estado, excluindo quem já está no Brasil
  const estadoMap = new Map<string, typeof allUsers[0][]>([]);
  for (const u of sorted) {
    if (brasilIds.has(u.id)) continue;
    if (!estadoMap.has(u.estado)) estadoMap.set(u.estado, []);
    estadoMap.get(u.estado)!.push(u);
  }
  const estados: Record<string, typeof allUsers[0][]> = {};
  for (const [est, list] of estadoMap) { estados[est] = list.slice(0, 1); }
  const estadoIds = new Set(Object.values(estados).flat().map(u => u.id));

  // Cidade: 1 campeão de cada cidade, excluindo quem já está no Brasil ou no Estado
  const cidadeMap = new Map<string, typeof allUsers[0][]>([]);
  for (const u of sorted) {
    if (brasilIds.has(u.id) || estadoIds.has(u.id)) continue;
    if (!cidadeMap.has(u.cidade)) cidadeMap.set(u.cidade, []);
    cidadeMap.get(u.cidade)!.push(u);
  }
  const cidades: Record<string, typeof allUsers[0][]> = {};
  for (const [cid, list] of cidadeMap) { cidades[cid] = list.slice(0, 1); }

  return { brasil, estados, cidades };
}

// Ranking por cidade
router.get("/ranking/cidade/:cidade", async (req, res) => {
  const cidade = decodeURIComponent(req.params.cidade);
  if (!cidade) { res.status(400).json({ error: "Missing cidade" }); return; }
  const result = await getRankings();
  const users = result.cidades[cidade] || [];
  res.json({ cidade, users });
});

// Ranking por estado
router.get("/ranking/estado/:estado", async (req, res) => {
  const estado = decodeURIComponent(req.params.estado);
  if (!estado) { res.status(400).json({ error: "Missing estado" }); return; }
  const result = await getRankings();
  const users = result.estados[estado] || [];
  res.json({ estado, users });
});

// Ranking do Brasil (top 3)
router.get("/ranking/brasil", async (_req, res) => {
  const result = await getRankings();
  res.json({ users: result.brasil });
});

// ── Top 10 por escopo com regra de exclusividade (Brasil > Estado > Cidade) ──

const TOP10_FIELDS = {
  id: usersTable.id,
  name: usersTable.name,
  cidade: usersTable.cidade,
  estado: usersTable.estado,
  fotoBase64: usersTable.fotoBase64,
  rankingPoints: usersTable.rankingPoints,
};

// Brasil: top 10 global sem exclusão (é a prioridade máxima)
router.get("/top10/brasil", async (_req, res) => {
  const users = await db
    .select(TOP10_FIELDS)
    .from(usersTable)
    .orderBy(desc(usersTable.rankingPoints))
    .limit(10);
  res.json({ users });
});

// Estado: top 10 do estado, excluindo quem lidera o Brasil
router.get("/top10/estado/:estado", async (req, res) => {
  const estado = decodeURIComponent(req.params.estado);
  if (!estado) { res.status(400).json({ error: "Missing estado" }); return; }

  // Líder do Brasil (representa Brasil, não Estado)
  const [brasilLider] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .orderBy(desc(usersTable.rankingPoints))
    .limit(1);

  const excludeIds = brasilLider ? [brasilLider.id] : [];

  const users = await db
    .select(TOP10_FIELDS)
    .from(usersTable)
    .where(
      excludeIds.length > 0
        ? and(eq(usersTable.estado, estado), notInArray(usersTable.id, excludeIds))
        : eq(usersTable.estado, estado)
    )
    .orderBy(desc(usersTable.rankingPoints))
    .limit(10);
  res.json({ users });
});

// Cidade: top 10 da cidade, excluindo quem lidera o Estado daquela cidade
router.get("/top10/cidade/:cidade", async (req, res) => {
  const cidade = decodeURIComponent(req.params.cidade);
  if (!cidade) { res.status(400).json({ error: "Missing cidade" }); return; }

  // Descobre o estado da cidade pelo usuário mais bem colocado dela
  const [topDaCidade] = await db
    .select({ estado: usersTable.estado })
    .from(usersTable)
    .where(eq(usersTable.cidade, cidade))
    .orderBy(desc(usersTable.rankingPoints))
    .limit(1);

  const excludeIds: number[] = [];

  if (topDaCidade?.estado) {
    // Líder do Estado daquela cidade (representa Estado, não Cidade)
    const [estadoLider] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.estado, topDaCidade.estado))
      .orderBy(desc(usersTable.rankingPoints))
      .limit(1);
    if (estadoLider) excludeIds.push(estadoLider.id);
  }

  const users = await db
    .select(TOP10_FIELDS)
    .from(usersTable)
    .where(
      excludeIds.length > 0
        ? and(eq(usersTable.cidade, cidade), notInArray(usersTable.id, excludeIds))
        : eq(usersTable.cidade, cidade)
    )
    .orderBy(desc(usersTable.rankingPoints))
    .limit(10);
  res.json({ users });
});

// Posição do usuário no ranking
router.get("/:id/ranking", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, cidade: usersTable.cidade, estado: usersTable.estado, rankingPoints: usersTable.rankingPoints, rankingSocialLink: usersTable.rankingSocialLink }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const cidadeRank = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(and(eq(usersTable.cidade, user.cidade), gte(usersTable.rankingPoints, user.rankingPoints ?? 0)));
  const estadoRank = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(and(eq(usersTable.estado, user.estado), gte(usersTable.rankingPoints, user.rankingPoints ?? 0)));
  const brasilRank = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable).where(gte(usersTable.rankingPoints, user.rankingPoints ?? 0));

  res.json({
    user,
    cidadeRank: cidadeRank[0]?.count ?? 0,
    estadoRank: estadoRank[0]?.count ?? 0,
    brasilRank: brasilRank[0]?.count ?? 0,
  });
});

// — Atualizar foto do usuário —
router.post("/:id/photo", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { fotoBase64 } = req.body as { fotoBase64?: string };
  if (!fotoBase64) { res.status(400).json({ error: "fotoBase64 required" }); return; }

  const [updated] = await db
    .update(usersTable)
    .set({ fotoBase64: fotoBase64 })
    .where(eq(usersTable.id, id))
    .returning();

  res.json({ ok: true, user: updated });
});

// ── SEGUIR CAMPEÃO ──
router.post("/:id/seguir-campeao", async (req, res) => {
  const id = parseInt(req.params.id);
  const { campeonUserId } = req.body as { campeonUserId?: number };
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!campeonUserId || isNaN(campeonUserId)) { res.status(400).json({ error: "campeonUserId required" }); return; }
  if (id === campeonUserId) { res.status(400).json({ error: "Não pode seguir a si mesmo" }); return; }

  const existing = await db.select().from(rankingFollowsTable)
    .where(and(eq(rankingFollowsTable.targetUserId, campeonUserId), eq(rankingFollowsTable.followerUserId, id)))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Você já resgatou esse bônus" });
    return;
  }

  await db.insert(rankingFollowsTable).values({ targetUserId: campeonUserId, followerUserId: id });

  // +5 pontos no ranking
  const [user] = await db.select({ rankingPoints: usersTable.rankingPoints, playsRemaining: usersTable.playsRemaining }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const newPoints = (user.rankingPoints ?? 0) + 5;
  const newPlays = (user.playsRemaining ?? 0) + 3;
  const [updated] = await db.update(usersTable)
    .set({ rankingPoints: newPoints, playsRemaining: newPlays })
    .where(eq(usersTable.id, id))
    .returning();

  // Notifica o seguidor e atualiza ranking para todos
  sendEvent(id, { type: "follow_reward", data: { addedPoints: 5, addedPlays: 3 } });
  broadcastEvent({ type: "ranking_changed", data: { scope: "update" } });
  res.json({ user: updated, addedPoints: 5, addedPlays: 3 });
});

// ── SEGUIR JOGADOR DO RANKING ──
router.post("/:id/seguir-ranking", async (req, res) => {
  const id = parseInt(req.params.id);
  const { targetUserId } = req.body as { targetUserId?: number };
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!targetUserId || isNaN(targetUserId)) { res.status(400).json({ error: "targetUserId required" }); return; }
  if (id === targetUserId) { res.status(400).json({ error: "Não pode seguir a si mesmo" }); return; }

  const existing = await db.select().from(rankingFollowsTable)
    .where(and(eq(rankingFollowsTable.targetUserId, targetUserId), eq(rankingFollowsTable.followerUserId, id)))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Você já seguiu este jogador" });
    return;
  }

  await db.insert(rankingFollowsTable).values({ targetUserId, followerUserId: id });

  const [user] = await db.select({ rankingPoints: usersTable.rankingPoints, playsRemaining: usersTable.playsRemaining }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const newPoints = (user.rankingPoints ?? 0) + 5;
  const newPlays = (user.playsRemaining ?? 0) + 3;
  const [updated] = await db.update(usersTable)
    .set({ rankingPoints: newPoints, playsRemaining: newPlays })
    .where(eq(usersTable.id, id))
    .returning();

  // Notifica o seguidor e atualiza ranking para todos
  sendEvent(id, { type: "follow_reward", data: { addedPoints: 5, addedPlays: 3 } });
  broadcastEvent({ type: "ranking_changed", data: { scope: "update" } });
  res.json({ user: updated, addedPoints: 5, addedPlays: 3 });
});

// ── Verificar se já seguiu um jogador ──
router.get("/:id/seguidos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const follows = await db.select({ targetUserId: rankingFollowsTable.targetUserId }).from(rankingFollowsTable)
    .where(eq(rankingFollowsTable.followerUserId, id));

  res.json({ seguidos: follows.map(f => f.targetUserId) });
});

export default router;
