export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  companyName: string;
  companyPhone: string;
  companyEmail?: string;
  name: string;
  email: string;
  password: string;
};
