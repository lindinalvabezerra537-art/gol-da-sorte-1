import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const rankingFollowsTable = pgTable("ranking_follows", {
  id: serial("id").primaryKey(),
  targetUserId: integer("target_user_id").notNull(),
  followerUserId: integer("follower_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
