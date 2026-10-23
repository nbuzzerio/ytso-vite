import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";

export default function RequireAuth() {
  const token = useAuth();
  const location = useLocation();
  return token ? (
    <Outlet />
  ) : (
    <Navigate
      to="/ytso/login"
      replace
      state={{ from: location.pathname + location.search }}
    />
  );
}
