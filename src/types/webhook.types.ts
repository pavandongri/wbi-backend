export type FacebookTokenResponse = {
  access_token: string;
  token_type: string;
  error?: { message: string; code: number };
};

export type FacebookBusiness = { id: string; name: string };
export type FacebookWABA = { id: string; name: string };
export type FacebookPhoneNumber = {
  id: string;
  display_phone_number: string;
  verified_name: string;
};

export type ExchangeCodeResult = {
  wabaId: string;
  whatsappPhoneNumberId: string;
  phoneNumber: string;
};

export type WhatsAppWebhookMetadata = {
  display_phone_number: string;
  phone_number_id: string;
};

export type WhatsAppInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

export type WhatsAppMessageStatus = {
  id: string;
  recipient_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: {
    code: number;
    title: string;
    error_data?: {
      details?: string;
    };
  }[];
};

export type WhatsAppMessagesValue = {
  messaging_product: string;
  metadata: WhatsAppWebhookMetadata;
  contacts?: { profile: { name: string }; wa_id: string }[];
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppMessageStatus[];
};

export type MetaTemplateStatusWebhookValue = {
  event: string;
  message_template_id: number;
  message_template_name: string;
  message_template_language: string;
  reason: string | null;
};
