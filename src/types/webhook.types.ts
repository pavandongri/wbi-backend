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
