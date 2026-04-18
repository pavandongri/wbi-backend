import { pool } from "../index";
import { seedWbiCompany } from "./company.seed";
import { seedPavanSuperAdmin } from "./user.seed";

async function main(): Promise<void> {
  await seedWbiCompany();
  await seedPavanSuperAdmin();
}

void (async (): Promise<void> => {
  try {
    await main();
  } catch (err: unknown) {
    console.error("[seed] Failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
  process.exit(process.exitCode ?? 0);
})();
