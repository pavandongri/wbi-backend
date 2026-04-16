import { customerCompanyMappings } from "db/schema";

export type customerCompanyMapping = typeof customerCompanyMappings.$inferSelect;

export const customerCompanyMappingSelect = {
  id: customerCompanyMappings.id,
  customerId: customerCompanyMappings.customerId,
  companyId: customerCompanyMappings.companyId,
  createdAt: customerCompanyMappings.createdAt
} as const;

export type CreateCustomerCompanyMappingPayload = {
  customerId: string;
  companyId: string;
};

export type UpdateCustomerCompanyMappingPayload = Partial<CreateCustomerCompanyMappingPayload>;

export const customerCompanyMappingmapSortByToColumn = (sortBy: string) => {
  const sortMap: Record<string, unknown> = {
    createdAt: customerCompanyMappings.createdAt,
    customerId: customerCompanyMappings.customerId,
    companyId: customerCompanyMappings.companyId
  };
  return sortMap[sortBy] ?? customerCompanyMappings.createdAt;
};
