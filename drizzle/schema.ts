import crypto from "node:crypto";
import { mysqlTable, varchar, datetime, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 191 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  openId: varchar("open_id", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user"),
  lastSignedIn: datetime("last_signed_in"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
