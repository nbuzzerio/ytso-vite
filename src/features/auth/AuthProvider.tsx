import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "./auth-context";
import {
  decodeSession,
  isSessionValid,
  readSession,
  writeSession,
} from "./session";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readSession);
  const [expired, setExpired] = useState(false);
  const queryClient = useQueryClient();

  const update = useCallback(
    (nextToken: string) => {
      const validToken =
        nextToken && isSessionValid(nextToken) ? nextToken : null;
      void queryClient.cancelQueries();
      queryClient.clear();
      writeSession(validToken);
      setExpired(false);
      setToken(validToken);
    },
    [queryClient],
  );

  useEffect(() => {
    const expire = () => {
      update("");
      setExpired(true);
    };
    const onUnauthorized = (event: Event) => {
      if (token && (event as CustomEvent<string>).detail === token) expire();
    };
    const checkExpiry = () => {
      if (token && !isSessionValid(token)) expire();
    };
    window.addEventListener("ytso:unauthorized", onUnauthorized);
    window.addEventListener("focus", checkExpiry);
    const timer = window.setInterval(checkExpiry, 30_000);
    return () => {
      window.removeEventListener("ytso:unauthorized", onUnauthorized);
      window.removeEventListener("focus", checkExpiry);
      window.clearInterval(timer);
    };
  }, [token, update]);

  const value = useMemo(
    () => ({
      token,
      name: token ? decodeSession(token)?.name ?? "" : "",
      expired,
      update,
    }),
    [token, expired, update],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
