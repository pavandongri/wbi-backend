import { customers } from "db/schema";

export type Customer = typeof customers.$inferSelect;

export const customerSelect = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  email: customers.email,
  city: customers.city,
  state: customers.state,
  country: customers.country,
  zipcode: customers.zipcode,
  address: customers.address,
  tags: customers.tags,
  isActive: customers.isActive,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt
} as const;

export type CreateCustomerPayload = {
  companyId?: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  address?: string;
  tags?: unknown;
};

export type UpdateCustomerPayload = Partial<Omit<CreateCustomerPayload, "companyId">> & {
  isActive?: boolean;
};
