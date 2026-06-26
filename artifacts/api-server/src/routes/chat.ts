import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT id, user_id, user_name, user_foto, message, created_at
    FROM chat_messages
    ORDER BY created_at DESC
    LIMIT 80
  `);
  const messages = [...(rows.rows as any[])].reverse();
  res.json({ messages });
});

router.post("/", async (req, res) => {
  const { userId, userName, userFoto, message } = req.body as {
    userId: number;
    userName: string;
    userFoto?: string;
    message: string;
  };

  if (!userId || !userName || !message?.trim()) {
    res.status(400).json({ error: "Dados incompletos" });
    return;
  }

  const text = message.trim().slice(0, 300);

  const rows = await db.execute(sql`
    INSERT INTO chat_messages (user_id, user_name, user_foto, message)
    VALUES (${userId}, ${userName}, ${userFoto ?? null}, ${text})
    RETURNING id, user_id, user_name, user_foto, message, created_at
  `);

  res.json({ message: rows.rows[0] });
});

router.delete("/:id", async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin2025";
  const auth = req.headers.authorization?.replace("Bearer ", "").trim();
  if (auth !== adminPassword) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }
  await db.execute(sql`DELETE FROM chat_messages WHERE id = ${Number(req.params.id)}`);
  res.json({ ok: true });
});

export default router;
