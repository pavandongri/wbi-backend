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

export type MetaCreateHeaderComponent = {
  type: "HEADER";
  format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  example?: { header_text?: string[]; header_handle?: string[] };
};

export type MetaCreateBodyComponent = {
  type: "BODY";
  text: string;
  example?: { body_text: string[][] };
};

export type MetaCreateFooterComponent = {
  type: "FOOTER";
  text: string;
};

export type MetaCreateButtonItem =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string[] }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

export type MetaCreateButtonsComponent = {
  type: "BUTTONS";
  buttons: MetaCreateButtonItem[];
};

export type MetaCreateTemplateComponent =
  | MetaCreateHeaderComponent
  | MetaCreateBodyComponent
  | MetaCreateFooterComponent
  | MetaCreateButtonsComponent;

export type MetaCreateTemplateResponse = {
  id: string;
  status: string;
  category: string;
};
