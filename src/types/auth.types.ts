export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  companyName: string;
  companyPhone: string;
  companyEmail: string;

  category: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;

  name: string;
  email: string;
  password: string;
};
