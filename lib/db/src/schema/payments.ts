import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  plays: integer("plays").notNull(),
  amountCents: integer("amount_cents").notNull(),
  txId: text("tx_id").notNull().unique(),
  mpPaymentId: text("mp_payment_id"),
  status: text("status").notNull().default("pending"), // pending | confirmed | expired
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export type Payment = typeof paymentsTable.$inferSelect;
