import { eq } from "drizzle-orm";

import { db } from "../index";
import { companies } from "../schema";

export const WBI_COMPANY_NAME = "wbi";

export async function seedWbiCompany(): Promise<void> {
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.name, WBI_COMPANY_NAME))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed:company] Company "${WBI_COMPANY_NAME}" already exists — skipping.`);
    return;
  }

  await db.insert(companies).values({
    name: WBI_COMPANY_NAME,
    email: "wbi@gmail.com",
    phone: "9876543210",
    status: "active",
    category: "messaging",
    address: "hyderabad",
    city: "hyderabad",
    state: "telangana",
    zipcode: "500001"
  });

  console.log(`[seed:company] Inserted company "${WBI_COMPANY_NAME}".`);
}
