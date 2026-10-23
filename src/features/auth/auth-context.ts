import { createContext, useContext } from "react";

export interface AuthState {
  token: string | null;
  name: string;
  expired: boolean;
  update: (token: string) => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  name: "",
  expired: false,
  update: () => {},
});
export const useSession = () => useContext(AuthContext);
export const useAuth = () => useSession().token;
export const useUpdateAuth = () => useSession().update;
