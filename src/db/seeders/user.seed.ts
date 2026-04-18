import { eq, or } from "drizzle-orm";

import { db } from "../index";
import { companies, users } from "../schema";

import { WBI_COMPANY_NAME } from "./company.seed";

const SEED_USER_ID = "a7b4c1d2-5e6f-4a8b-9c3d-1e2f7a8b9c0d";
const SEED_EMAIL = "pavan@gmail.com";

export async function seedPavanSuperAdmin(): Promise<void> {
  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.name, WBI_COMPANY_NAME))
    .limit(1);

  const company = companyRows[0];
  if (!company) {
    throw new Error(
      `[seed:user] Company "${WBI_COMPANY_NAME}" not found. Run company seed first (seed order in index).`
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.id, SEED_USER_ID), eq(users.email, SEED_EMAIL)))
    .limit(1);

  if (existing.length > 0) {
    console.log("[seed:user] Super admin user already exists (id or email) — skipping.");
    return;
  }

  await db.insert(users).values({
    id: SEED_USER_ID,
    companyId: company.id,
    name: "pavan",
    email: SEED_EMAIL,
    phone: "9876543210",
    password: "Pavan@123",
    role: "super_admin",
    status: "active",
    createdBy: SEED_USER_ID
  });

  console.log(`[seed:user] Inserted super_admin user (${SEED_EMAIL}, id=${SEED_USER_ID}).`);
}
