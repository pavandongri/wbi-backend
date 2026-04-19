import {
  AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "staff"]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed"
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "completed",
  "failed"
]);

export const groupStatusEnum = pgEnum("group_status", ["active", "inactive", "deleted"]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  phone: text("phone").notNull().unique(),
  status: groupStatusEnum("status").default("active").notNull(),
  category: text("category"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  zipcode: text("zipcode"),
  email: text("email").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    phone: text("phone"),
    phoneVerified: boolean("phone_verified").default(false),
    emailVerified: boolean("email_verified").default(false),
    role: roleEnum("role").notNull(),
    status: groupStatusEnum("status").default("active").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: text("last_login_ip"),
    createdBy: uuid("created_by")
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
      .notNull(),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("users_company_id_idx").on(table.companyId),
    index("users_status_idx").on(table.status),
    index("users_email_idx").on(table.email)
  ]
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    email: text("email"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    zipcode: text("zipcode"),
    address: text("address"),
    tags: jsonb("tags"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("customers_is_active_idx").on(table.isActive)]
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: groupStatusEnum("status").default("active"),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("groups_company_id_idx").on(table.companyId),
    index("groups_status_idx").on(table.status)
  ]
);

export const customerCompanyMappings = pgTable(
  "customer_company_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("customer_company_unique").on(table.customerId, table.companyId),
    index("customer_company_customer_id_idx").on(table.customerId),
    index("customer_company_company_id_idx").on(table.companyId)
  ]
);

export const customerGroupMappings = pgTable(
  "customer_group_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .references(() => customers.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("customer_group_unique").on(table.customerId, table.groupId),
    index("customer_group_customer_id_idx").on(table.customerId),
    index("customer_group_group_id_idx").on(table.groupId)
  ]
);
