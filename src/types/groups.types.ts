import { groups } from "db/schema";

export type Group = typeof groups.$inferSelect;

export type CreateGroupPayload = {
  companyId: string;
  name: string;
  description?: string;
  status?: "active" | "inactive" | "deleted";
};

export type UpdateGroupPayload = Partial<CreateGroupPayload> & {
  status?: "active" | "inactive" | "deleted";
};
