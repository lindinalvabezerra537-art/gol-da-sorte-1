import { Router, Request } from "express";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { sendEvent } from "../app";

const router = Router();

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
  if (cleanPhone.length < 10) {
    res.status(400).json({ error: "Telefone inválido." });
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
    playsRemaining: 5,
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
  let referralUnlocked = user.referralUnlocked ?? false;
  if ((user.playsRemaining ?? 0) > 0 && freePlaysTotalUsed < 5) {
    freePlaysTotalUsed += 1;
  }
  if (!referralUnlocked && freePlaysTotalUsed >= 5) {
    referralUnlocked = true;
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
  const totalBonusPlays = rewardedFriends * 3;

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

  const bonusPerReferral = 3;
  const totalBonus = referrals.length * bonusPerReferral;
  const newPlays = (user.playsRemaining ?? 0) + totalBonus;

  const [updated] = await db.update(usersTable)
    .set({ playsRemaining: newPlays, referralUnlocked: true })
    .where(eq(usersTable.id, id))
    .returning();

  await db.update(referralsTable)
    .set({ rewarded: true })
    .where(eq(referralsTable.referrerId, id));

  res.json({ user: updated, newReferrals: referrals.length });
});

export default router;
