export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  carrierCode?: string;
  carrierName?: string;
  email?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

