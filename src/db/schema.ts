import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "draft",
  "active",
  "cancelled",
  "expired",
  "scheduled"
]);

// Define enums

export const billingIntervalEnum = pgEnum("billing_interval", ["weekly", "monthly", "yearly"]);

export const roleEnum = pgEnum("role", ["super_admin", "admin", "staff"]);

export const messageStatusEnum = pgEnum("message_status", [
  "created",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "received"
]);

export const messageTypeEnum = pgEnum("message_type", [
  "marketing",
  "authentication",
  "utility",
  "text"
]);

export const templateCategoryEnum = pgEnum("template_category", ["marketing", "utility"]);

export const templateHeaderTypeEnum = pgEnum("template_header_type", [
  "text",
  "image",
  "video",
  "document",
  "location",
  "none"
]);

export const templateStatusEnum = pgEnum("template_status", [
  "pending",
  "approved",
  "rejected",
  "deleted"
]);

export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "completed",
  "failed"
]);

export const groupStatusEnum = pgEnum("group_status", ["active", "inactive", "deleted"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded"
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "void",
  "overdue"
]);

// Define tables

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
  messageCredits: integer("message_credits").default(0),
  facebookBusinessId: text("facebook_business_id"),
  wabaId: text("waba_id"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
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
    phone: text("phone").notNull().unique(),
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

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    language: text("language").notNull(),
    category: templateCategoryEnum("category").notNull(),
    headerType: templateHeaderTypeEnum("header_type").notNull(),
    headerText: text("header_text"),
    headerMediaUrl: text("header_media_url"),
    headerMediaHandler: text("header_media_handler"),
    headerExample: jsonb("header_example").$type<string[]>(),
    body: text("body").notNull(),
    bodyExample: jsonb("body_example").$type<string[][]>(),
    footer: text("footer"),
    buttons: jsonb("buttons").$type<
      {
        type: "quick_reply" | "url" | "phone_number";
        text: string;
        url?: string;
        url_type?: "static" | "dynamic";
        phone_number?: string;
        example?: string[];
      }[]
    >(),
    status: templateStatusEnum("status").default("pending").notNull(),
    rejectionMessage: text("rejection_message"),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedBy: uuid("deleted_by").references((): AnyPgColumn => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedAtMeta: boolean("deleted_at_meta").default(false).notNull()
  },
  (table) => [
    index("templates_company_id_idx").on(table.companyId),
    index("templates_status_idx").on(table.status),
    index("templates_created_by_idx").on(table.userId)
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    from: text("from").notNull(),
    to: text("to").notNull(),
    body: text("body"),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
    templateHeaderParams: text("template_header_params"),
    templateBodyParams: jsonb("template_body_params").$type<string[]>(),
    wamid: text("wamid"),
    messageType: messageTypeEnum("message_type").default("text").notNull(),
    status: messageStatusEnum("status").default("queued").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    failedReason: text("failed_reason"),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    userId: uuid("user_id").references(() => users.id),
    cost: real("cost").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true })
  },
  (table) => [
    index("messages_company_id_idx").on(table.companyId),
    index("messages_user_id_idx").on(table.userId),
    index("messages_template_id_idx").on(table.templateId),
    index("messages_status_idx").on(table.status),
    index("messages_direction_idx").on(table.direction),
    index("messages_created_at_idx").on(table.createdAt)
  ]
);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  description: text("description"),

  amount: integer("amount").notNull(),
  platformAmount: integer("platform_amount").notNull(),
  messageAmount: integer("message_amount").notNull(),

  currency: text("currency").default("INR").notNull(),
  interval: billingIntervalEnum("interval").notNull(),
  features: jsonb("features").$type<Record<string, any>>(),

  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),

  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),

  planId: uuid("plan_id")
    .references(() => subscriptionPlans.id)
    .notNull(),

  status: subscriptionStatusEnum("status").default("active").notNull(),

  planName: text("plan_name").notNull(),
  planCode: text("plan_code").notNull(),
  planDescription: text("plan_description"),
  planInterval: text("interval").notNull(),
  planFeatures: jsonb("plan_features").$type<Record<string, any>>(),
  planAmount: integer("plan_amount").notNull(),
  planPlatformAmount: integer("plan_platform_amount").notNull(),
  planMessageAmount: integer("plan_message_amount").notNull(),
  currency: text("currency").default("INR").notNull(),

  discount: integer("discount").default(0).notNull(),
  netAmount: integer("net_amount").notNull(),

  startDate: timestamp("start_date", { withTimezone: true }).defaultNow().notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).defaultNow().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    subscriptionPlanId: uuid("subscription_plan_id").references(() => subscriptionPlans.id),

    razorpayOrderId: text("razorpay_order_id").notNull().unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpaySignature: text("razorpay_signature"),

    type: text("type").default("subscription").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").default("INR").notNull(),

    status: paymentStatusEnum("status").default("created").notNull(),
    paymentMethod: text("payment_method"),
    failureReason: text("failure_reason"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("payments_company_id_idx").on(table.companyId),
    index("payments_subscription_id_idx").on(table.subscriptionId),
    index("payments_status_idx").on(table.status),
    index("payments_razorpay_order_id_idx").on(table.razorpayOrderId),
    index("payments_razorpay_payment_id_idx").on(table.razorpayPaymentId)
  ]
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    paymentId: uuid("payment_id").references(() => payments.id),

    invoiceNumber: text("invoice_number").notNull().unique(),
    taxAmount: integer("tax_amount").default(0).notNull(),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").default("INR").notNull(),

    status: invoiceStatusEnum("status").default("draft").notNull(),
    notes: text("notes"),
    pdfUrl: text("pdf_url"),

    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("invoices_company_id_idx").on(table.companyId),
    index("invoices_invoice_number_idx").on(table.invoiceNumber),
    index("invoices_status_idx").on(table.status)
  ]
);
