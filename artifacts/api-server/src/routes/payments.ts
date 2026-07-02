import { Router } from "express";
import { db, paymentsTable, usersTable, referralsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendEvent, broadcastEvent } from "../app";

const router = Router();

const PACKAGES: Record<number, number> = { 5: 500, 15: 1000, 30: 2000 };

const OPENPIX_BASE = "https://api.woovi.com/api/v1";

function getOpenPixHeaders() {
  const appId = process.env.OPENPIX_APP_ID ?? "";
  if (!appId) throw new Error("OPENPIX_APP_ID não configurado.");
  return {
    "Content-Type": "application/json",
    "Authorization": appId,
  };
}

// ── Criar cobrança PIX via OpenPix ────────────────────────────────────────────

router.post("/create", async (req, res) => {
  const { userId, plays } = req.body as { userId: number; plays: number };

  const amountCents = PACKAGES[plays];
  if (!amountCents) {
    res.status(400).json({ error: "Pacote inválido." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  if (!process.env.OPENPIX_APP_ID) {
    res.status(503).json({ error: "Pagamento não configurado. Fale com o administrador." });
    return;
  }

  const txId = `GOL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  try {
    const response = await fetch(`${OPENPIX_BASE}/charge`, {
      method: "POST",
      headers: getOpenPixHeaders(),
      body: JSON.stringify({
        correlationID: txId,
        value: amountCents,
        comment: `Gol da Sorte - ${plays} jogadas`,
        expiresIn: 3600,
      }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok || !data.charge) {
      console.error("OpenPix create error:", JSON.stringify(data));
      res.status(502).json({ error: "Erro ao criar cobrança PIX.", detail: data });
      return;
    }

    const charge = data.charge as Record<string, unknown>;
    const brCode = charge.brCode as string ?? null;
    const qrCodeImage = charge.qrCodeImage as string ?? null;

    await db.insert(paymentsTable).values({
      userId,
      plays,
      amountCents,
      txId,
      mpPaymentId: txId,
      status: "pending",
    });

    res.json({
      txId,
      amount: (amountCents / 100).toFixed(2),
      plays,
      pixPayload: brCode,
      qrCode: qrCodeImage,
    });
  } catch (err: unknown) {
    console.error("OpenPix create error:", err);
    res.status(502).json({ error: "Erro ao criar cobrança PIX.", detail: String(err) });
  }
});

// ── Poll status ───────────────────────────────────────────────────────────────

router.get("/:txId/status", async (req, res) => {
  const { txId } = req.params;
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.txId, txId));
  if (!payment) {
    res.status(404).json({ error: "Pagamento não encontrado." });
    return;
  }

  if (payment.status === "confirmed") {
    res.json({ status: "confirmed", plays: payment.plays });
    return;
  }

  if (process.env.OPENPIX_APP_ID) {
    try {
      const response = await fetch(`${OPENPIX_BASE}/charge/${txId}`, {
        headers: getOpenPixHeaders(),
      });
      const data = await response.json() as Record<string, unknown>;
      const charge = data.charge as Record<string, unknown> | undefined;

      if (charge?.status === "COMPLETED") {
        await confirmPayment(txId);
        res.json({ status: "confirmed", plays: payment.plays });
        return;
      }
    } catch (err) {
      console.error("OpenPix status check error:", err);
    }
  }

  res.json({ status: payment.status, plays: payment.plays });
});

// ── Webhook OpenPix ───────────────────────────────────────────────────────────

router.post("/webhook", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  try {
    const event = body.event as string | undefined;

    if (event === "OPENPIX:CHARGE_COMPLETED") {
      const charge = body.charge as Record<string, unknown> | undefined;
      const correlationID = charge?.correlationID as string | undefined;
      if (correlationID) {
        await confirmPayment(correlationID);
      }
      res.json({ ok: true });
      return;
    }

    const txId =
      (body.txId as string) ||
      (body.correlationID as string) ||
      (body.external_reference as string);

    if (txId) {
      await confirmPayment(txId);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Erro interno no webhook." });
  }
});

// ── Confirmação manual pelo admin ─────────────────────────────────────────────

router.post("/admin/confirm/:txId", async (req, res) => {
  const { txId } = req.params;
  const result = await confirmPayment(txId);
  if (!result) {
    res.status(404).json({ error: "Pagamento não encontrado ou já confirmado." });
    return;
  }
  res.json({ ok: true, playsAdded: result.plays });
});

// ── Lógica de confirmação ─────────────────────────────────────────────────────

async function confirmPayment(txId: string) {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.txId, txId));
  if (!payment || payment.status !== "pending") return null;

  await db.update(paymentsTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(paymentsTable.txId, txId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId));
  if (user) {
    const isFirstPayment = !user.hasPaid;

    await db.update(usersTable)
      .set({
        playsRemaining: user.playsRemaining + payment.plays,
        hasPaid: true,
        referralUnlocked: isFirstPayment ? true : user.referralUnlocked,
      })
      .where(eq(usersTable.id, payment.userId));

    sendEvent(payment.userId, { type: "plays_updated", data: { playsRemaining: user.playsRemaining + payment.plays, hasPaid: true } });

    if (isFirstPayment && user.referredById) {
      const [referrer] = await db
        .select({ rankingPoints: usersTable.rankingPoints, playsRemaining: usersTable.playsRemaining, referredById: usersTable.referredById })
        .from(usersTable)
        .where(eq(usersTable.id, user.referredById));

      if (referrer) {
        await db.update(usersTable)
          .set({
            rankingPoints: (referrer.rankingPoints ?? 0) + 10,
            playsRemaining: (referrer.playsRemaining ?? 0) + 5,
          })
          .where(eq(usersTable.id, user.referredById));

        sendEvent(user.referredById, { type: "referral_reward", data: { addedPlays: 5, addedPoints: 10 } });

        await db.update(referralsTable)
          .set({ rewarded: true })
          .where(
            and(
              eq(referralsTable.referrerId, user.referredById),
              eq(referralsTable.referredId, user.id),
            )
          );

        if (referrer.referredById) {
          const [grandReferrer] = await db
            .select({ rankingPoints: usersTable.rankingPoints, playsRemaining: usersTable.playsRemaining })
            .from(usersTable)
            .where(eq(usersTable.id, referrer.referredById));

          if (grandReferrer) {
            await db.update(usersTable)
              .set({
                rankingPoints: (grandReferrer.rankingPoints ?? 0) + 3,
                playsRemaining: (grandReferrer.playsRemaining ?? 0) + 3,
              })
              .where(eq(usersTable.id, referrer.referredById));

            sendEvent(referrer.referredById, { type: "referral_reward", data: { addedPlays: 3, addedPoints: 3 } });
          }
        }
      }
    }
  }

  broadcastEvent({ type: "payment_confirmed", data: { userId: payment.userId, plays: payment.plays, amountCents: payment.amountCents } });
  return payment;
}

export default router;
