import { customerGroupMappings } from "db/schema";

export type customerGroupMapping = typeof customerGroupMappings.$inferSelect;

export const customerGroupMappingSelect = {
  id: customerGroupMappings.id,
  customerId: customerGroupMappings.customerId,
  groupId: customerGroupMappings.groupId,
  createdAt: customerGroupMappings.createdAt
} as const;

export type CreateCustomerGroupMappingPayload = {
  customerId: string;
  groupId: string;
};

export type UpdateCustomerGroupMappingPayload = Partial<CreateCustomerGroupMappingPayload>;
