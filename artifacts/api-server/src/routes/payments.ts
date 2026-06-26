import { Router } from "express";
import { db, paymentsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { MercadoPagoConfig, Payment } from "mercadopago";

const router = Router();

const PACKAGES: Record<number, number> = { 5: 500, 15: 1000, 30: 2000 };

function getMpClient() {
  const token = process.env.MP_ACCESS_TOKEN ?? "";
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado.");
  return new MercadoPagoConfig({ accessToken: token });
}

// ── Criar pagamento PIX via Mercado Pago ──────────────────────────────────────

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

  if (!process.env.MP_ACCESS_TOKEN) {
    res.status(503).json({ error: "Pagamento não configurado. Fale com o administrador." });
    return;
  }

  const txId = `GOL${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const amount = amountCents / 100;

  try {
    const client = getMpClient();
    const paymentClient = new Payment(client);

    const mpPayment = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: `Gol da Sorte - ${plays} jogadas`,
        payment_method_id: "pix",
        payer: {
          email: `jogador${userId}@goldaorte.app`,
          first_name: user.name.split(" ")[0] ?? "Jogador",
          last_name: user.name.split(" ").slice(1).join(" ") || "GolDaSorte",
        },
        external_reference: txId,
        notification_url: `${
          process.env.API_PUBLIC_URL
          ?? (process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.PORT ?? "8081"}-${process.env.REPLIT_DEV_DOMAIN}`
            : process.env.APP_URL ?? "")
        }/api/payments/webhook`,
      },
    });

    if (!mpPayment.id) {
      res.status(502).json({ error: "Erro ao criar pagamento no Mercado Pago." });
      return;
    }

    const pixData = mpPayment.point_of_interaction?.transaction_data;
    const qrCodeBase64 = pixData?.qr_code_base64
      ? `data:image/png;base64,${pixData.qr_code_base64}`
      : null;
    const qrCodeText = pixData?.qr_code ?? null;

    await db.insert(paymentsTable).values({
      userId,
      plays,
      amountCents,
      txId,
      mpPaymentId: String(mpPayment.id),
      status: "pending",
    });

    res.json({
      txId,
      mpPaymentId: String(mpPayment.id),
      amount: amount.toFixed(2),
      plays,
      pixPayload: qrCodeText,
      qrCode: qrCodeBase64,
    });
  } catch (err: unknown) {
    console.error("MP create error:", JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    const mpErr = err as Record<string, unknown>;
    const detail = mpErr?.cause ?? mpErr?.message ?? String(err);
    res.status(502).json({ error: "Erro ao criar pagamento.", detail });
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

  // Se já confirmado no banco, retorna direto
  if (payment.status === "confirmed") {
    res.json({ status: "confirmed", plays: payment.plays });
    return;
  }

  // Consulta o Mercado Pago para status atualizado
  if (payment.mpPaymentId && process.env.MP_ACCESS_TOKEN) {
    try {
      const client = getMpClient();
      const paymentClient = new Payment(client);
      const mpPayment = await paymentClient.get({ id: Number(payment.mpPaymentId) });

      if (mpPayment.status === "approved") {
        await confirmPayment(txId);
        res.json({ status: "confirmed", plays: payment.plays });
        return;
      }
    } catch (err) {
      console.error("MP status check error:", err);
    }
  }

  res.json({ status: payment.status, plays: payment.plays });
});

// ── Webhook Mercado Pago ──────────────────────────────────────────────────────

router.post("/webhook", async (req, res) => {
  // Mercado Pago envia: { type: "payment", data: { id: "123456" } }
  const body = req.body as Record<string, unknown>;

  try {
    // Formato novo (notifications v2)
    if (body.type === "payment" && body.data) {
      const mpId = (body.data as Record<string, unknown>).id;
      if (mpId && process.env.MP_ACCESS_TOKEN) {
        const client = getMpClient();
        const paymentClient = new Payment(client);
        const mpPayment = await paymentClient.get({ id: Number(mpId) });

        if (mpPayment.status === "approved" && mpPayment.external_reference) {
          await confirmPayment(mpPayment.external_reference);
        }
      }
      res.json({ ok: true });
      return;
    }

    // Formato legado — txId direto no body
    const txId =
      (body.txId as string) ||
      (body.referenceLabel as string) ||
      (body.reference as string) ||
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
    await db.update(usersTable)
      .set({ playsRemaining: user.playsRemaining + payment.plays, hasPaid: true })
      .where(eq(usersTable.id, payment.userId));
  }
  return payment;
}

export default router;
