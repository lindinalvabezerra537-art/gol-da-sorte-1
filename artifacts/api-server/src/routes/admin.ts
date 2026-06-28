import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, paymentsTable, settingsTable } from "@workspace/db";
import { eq, gte, and, sql, ilike, or, desc } from "drizzle-orm";

const router = Router();

function checkAdmin(req: Request, res: Response): boolean {
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "").trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin2025";
  if (token !== adminPassword) {
    res.status(401).json({ error: "Não autorizado" });
    return false;
  }
  return true;
}

router.post("/login", async (req, res) => {
  const { password } = req.body as { password: string };
  const adminPassword = process.env.ADMIN_PASSWORD || "admin2025";
  if (password === adminPassword) {
    res.json({ ok: true, token: adminPassword });
  } else {
    res.status(401).json({ error: "Senha incorreta" });
  }
});

router.get("/stats", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const onlineSince = new Date(Date.now() - 10 * 60 * 1000);

    const [
      totalCadastrados,
      novosCadastrosHoje,
      usuariosOnline,
      jogadasGeral,
      valorHoje,
      valorMes,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.createdAt, today)),
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.ultimoLogin, onlineSince)),
      db.select({ total: sql<number>`coalesce(sum(paid_plays_used + free_plays_total_used), 0)::int` }).from(usersTable),
      db.select({ total: sql<number>`coalesce(sum(amount_cents), 0)::int` }).from(paymentsTable).where(and(eq(paymentsTable.status, "confirmed"), gte(paymentsTable.confirmedAt!, today))),
      db.select({ total: sql<number>`coalesce(sum(amount_cents), 0)::int` }).from(paymentsTable).where(and(eq(paymentsTable.status, "confirmed"), gte(paymentsTable.confirmedAt!, monthStart))),
    ]);

    const settingsRows = await db.select().from(settingsTable);
    const s = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));

    res.json({
      usuariosOnline: usuariosOnline[0].count,
      totalCadastrados: totalCadastrados[0].count,
      novosCadastrosHoje: novosCadastrosHoje[0].count,
      totalJogadasGeral: jogadasGeral[0].total,
      valorArrecadadoHoje: (valorHoje[0].total / 100).toFixed(2),
      valorArrecadadoMes: (valorMes[0].total / 100).toFixed(2),
      valorPagoPremios: s["valor_pago_premios"] || "0",
      valorAcumulado: s["valor_acumulado"] || "0",
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar stats" });
  }
});

router.get("/users", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const search = (req.query.search as string) || "";
    let users;
    if (search) {
      users = await db.select().from(usersTable).where(
        or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.phone, `%${search}%`))
      ).orderBy(sql`created_at DESC`).limit(100);
    } else {
      users = await db.select().from(usersTable).orderBy(sql`created_at DESC`).limit(100);
    }
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

router.get("/users/:id", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    const payments = await db.select().from(paymentsTable).where(and(eq(paymentsTable.userId, id), eq(paymentsTable.status, "confirmed")));
    const totalDepositado = payments.reduce((s, p) => s + p.amountCents, 0);
    res.json({ user, totalDepositado: (totalDepositado / 100).toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

router.post("/users/:id/block", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  await db.update(usersTable).set({ bloqueado: true }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.post("/users/:id/unblock", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  await db.update(usersTable).set({ bloqueado: false }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.post("/users/:id/plays", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { delta } = req.body as { delta: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    const newPlays = Math.max(0, user.playsRemaining + delta);
    const [updated] = await db.update(usersTable).set({ playsRemaining: newPlays }).where(eq(usersTable.id, id)).returning();
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar jogadas" });
  }
});

router.post("/users/:id/saldo", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { delta } = req.body as { delta: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    const newSaldo = Math.max(0, user.saldo + delta);
    const [updated] = await db.update(usersTable).set({ saldo: newSaldo }).where(eq(usersTable.id, id)).returning();
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar saldo" });
  }
});

router.post("/users/:id/update", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { name, phone } = req.body as { name?: string; phone?: string };
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone.replace(/\D/g, "");
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nada para atualizar" });
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

router.post("/plays-by-phone", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const { phone, delta } = req.body as { phone: string; delta: number };
    const cleanPhone = (phone || "").replace(/\D/g, "");
    if (!cleanPhone) return res.status(400).json({ error: "Telefone inválido" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, cleanPhone));
    if (!user) return res.status(404).json({ error: "Usuário não encontrado com esse telefone" });
    const newPlays = Math.max(0, user.playsRemaining + (delta || 0));
    const [updated] = await db.update(usersTable).set({ playsRemaining: newPlays }).where(eq(usersTable.id, user.id)).returning();
    res.json({ ok: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar jogadas" });
  }
});

router.get("/check-admin-phone", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) return res.json({ isAdmin: false });
    const [adminPhoneSetting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "admin_phone"));
    const adminPhone = (adminPhoneSetting?.value || "").replace(/\D/g, "");
    if (!adminPhone) return res.json({ isAdmin: false });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.json({ isAdmin: false });
    const isAdmin = user.phone.replace(/\D/g, "") === adminPhone;
    res.json({ isAdmin });
  } catch {
    res.json({ isAdmin: false });
  }
});

router.get("/settings", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const rows = await db.select().from(settingsTable);
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ settings: s });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar configurações" });
  }
});

router.post("/settings", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
        target: settingsTable.key,
        set: { value, updatedAt: new Date() },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar configurações" });
  }
});

// ── ADMIN RANKING COM EXCLUSIVIDADE ──
// Regra: um jogador só pode ocupar 1 posição (Brasil > Estado > Cidade)

function computeExclusiveRankings(allUsers: Array<{ id: number; name: string; cidade: string; estado: string; rankingPoints: number | null; fotoBase64: string | null; rankingSocialLink: string | null }>) {
  const sorted = [...allUsers].sort((a, b) => (b.rankingPoints ?? 0) - (a.rankingPoints ?? 0));

  // Brasil: top 3
  const brasil = sorted.slice(0, 3);
  const brasilIds = new Set(brasil.map(u => u.id));

  // Estado: top 3 de cada estado, excluindo já no Brasil
  const estadoMap = new Map<string, Array<typeof allUsers[0]>>();
  for (const u of sorted) {
    if (brasilIds.has(u.id)) continue;
    if (!estadoMap.has(u.estado)) estadoMap.set(u.estado, []);
    estadoMap.get(u.estado)!.push(u);
  }
  const estados: Record<string, typeof allUsers[0][]> = {};
  for (const [est, list] of estadoMap) {
    estados[est] = list.slice(0, 3);
  }
  const estadoIds = new Set(Object.values(estados).flat().map(u => u.id));

  // Cidade: top 3 de cada cidade, excluindo já no Brasil ou Estado
  const cidadeMap = new Map<string, Array<typeof allUsers[0]>>();
  for (const u of sorted) {
    if (brasilIds.has(u.id) || estadoIds.has(u.id)) continue;
    if (!cidadeMap.has(u.cidade)) cidadeMap.set(u.cidade, []);
    cidadeMap.get(u.cidade)!.push(u);
  }
  const cidades: Record<string, typeof allUsers[0][]> = {};
  for (const [cid, list] of cidadeMap) {
    cidades[cid] = list.slice(0, 3);
  }

  return { brasil, estados, cidades };
}

router.get("/ranking", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const allUsers = await db
      .select({ id: usersTable.id, name: usersTable.name, cidade: usersTable.cidade, estado: usersTable.estado, rankingPoints: usersTable.rankingPoints, fotoBase64: usersTable.fotoBase64, rankingSocialLink: usersTable.rankingSocialLink })
      .from(usersTable)
      .orderBy(desc(usersTable.rankingPoints));
    const result = computeExclusiveRankings(allUsers);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar ranking" });
  }
});

// Ajustar pontos de ranking de um usuário (admin)
router.post("/users/:id/points", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { delta } = req.body as { delta: number };
    if (isNaN(id) || typeof delta !== "number") {
      res.status(400).json({ error: "Invalid id or delta" }); return;
    }
    const [user] = await db.select({ rankingPoints: usersTable.rankingPoints }).from(usersTable).where(eq(usersTable.id, id));
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    const newPoints = Math.max(0, (user.rankingPoints ?? 0) + delta);
    const [updated] = await db.update(usersTable).set({ rankingPoints: newPoints }).where(eq(usersTable.id, id)).returning();
    res.json({ user: updated, delta, newPoints });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar pontos" });
  }
});

export default router;
