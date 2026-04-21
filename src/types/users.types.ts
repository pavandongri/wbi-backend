import { users } from "db/schema";

export type User = typeof users.$inferSelect;

export type CreateUserPayload = {
  companyId: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "super_admin" | "admin" | "staff";
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "companyId">> & {
  companyId?: string; // disallowed unless super_admin (we will reject if provided and not allowed)
  status?: "active" | "deleted";
  // Password update is optional.
  password?: string;
};
