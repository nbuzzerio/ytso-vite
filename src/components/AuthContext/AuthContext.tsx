import { createContext, useContext, useState } from "react";

const AuthContext = createContext<string | null>(null);
const AuthUpdateContext = createContext<(token: string) => void>(() => {});

export function useAuth() {
  return useContext(AuthContext);
}

export function useUpdateAuth() {
  return useContext(AuthUpdateContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<string | null>(null);

  return (
    <AuthContext.Provider value={auth}>
      <AuthUpdateContext.Provider value={setAuth}>
        {children}
      </AuthUpdateContext.Provider>
    </AuthContext.Provider>
  );
}

export default AuthProvider;
