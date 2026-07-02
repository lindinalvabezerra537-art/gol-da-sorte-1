import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  cidade: text("cidade").notNull().default(""),
  estado: text("estado").notNull().default(""),
  fotoBase64: text("foto_base64"),
  ipAddress: text("ip_address"),
  referralCode: text("referral_code").notNull().unique(),
  referredById: integer("referred_by_id"),
  playsRemaining: integer("plays_remaining").notNull().default(10),
  freePlaysTotalUsed: integer("free_plays_total_used").notNull().default(0),
  hasPaid: boolean("has_paid").notNull().default(false),
  paidPlaysUsed: integer("paid_plays_used").notNull().default(0),
  referralUnlocked: boolean("referral_unlocked").notNull().default(false),
  bloqueado: boolean("bloqueado").notNull().default(false),
  ultimoLogin: timestamp("ultimo_login"),
  saldo: integer("saldo").notNull().default(0),
  piratePos: integer("pirate_pos").notNull().default(0),
  lastPirateMove: timestamp("last_pirate_move"),
  rankingPoints: integer("ranking_points").notNull().default(0),
  rankingSocialLink: text("ranking_social_link"),
  onlineMinutesToday: integer("online_minutes_today").notNull().default(0),
  lastOnlineDate: timestamp("last_online_date"),
  warnings: integer("warnings").notNull().default(0),
  warningMessage: text("warning_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  referralCode: true,
  playsRemaining: true,
  freePlaysTotalUsed: true,
  hasPaid: true,
  paidPlaysUsed: true,
  referralUnlocked: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
