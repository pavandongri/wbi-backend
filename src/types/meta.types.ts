export type MetaSendResult = {
  messageId: string;
};

export type MetaTextPayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: { body: string };
};

export type MetaTemplateComponent =
  | { type: "header"; parameters: { type: "text"; text: string }[] }
  | { type: "body"; parameters: { type: "text"; text: string }[] };

export type MetaTemplatePayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: MetaTemplateComponent[];
  };
};

export type MetaSendPayload = MetaTextPayload | MetaTemplatePayload;

export type MetaApiResponse = {
  messages?: { id: string }[];
  error?: { message: string; code: number };
};
