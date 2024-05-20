import { createContext, useContext, useState } from "react";

const AuthContext = createContext<string>("");
const AuthUpdateContext = createContext<(token: string) => void>(() => {});

export function useAuth() {
  return useContext(AuthContext);
}

export function useUpdateAuth() {
  return useContext(AuthUpdateContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const token: string = "";
  const [auth, setAuth] = useState(token);

  function handleAuth(token: string) {
    setAuth(token);
  }

  return (
    <AuthContext.Provider value={auth}>
      <AuthUpdateContext.Provider value={handleAuth}>
        {children}
      </AuthUpdateContext.Provider>
    </AuthContext.Provider>
  );
}

export default AuthProvider;
