import { companies } from "db/schema";

export type Company = typeof companies.$inferSelect;

export type CreateCompanyPayload = {
  name: string;
  phone: string;
  email?: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
};

export type UpdateCompanyPayload = Partial<CreateCompanyPayload> & {
  status?: "active" | "deleted";
};

export const mapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    name: companies.name,
    phone: companies.phone,
    email: companies.email,
    category: companies.category,
    status: companies.status,
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt
  };
  return sortMap[sortBy] ?? companies.createdAt;
};
