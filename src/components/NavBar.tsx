import { Link, NavLink, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/auth-context";
import logo from "../assets/favicon.ico";

export default function NavBar() {
  const { token, name, update } = useSession();
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/ytso" aria-label="YTSO home">
          <img src={logo} alt="" width="40" height="40" />
          <span>
            YTSO<span className="brand-caption">A place for your channels</span>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/ytso/channels">Channels</NavLink>
          <NavLink to="/ytso/categories">Categories</NavLink>
        </nav>
        <div className="account-nav">
          {token ? (
            <>
              <span className="account-name" title={name}>
                {name}
              </span>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  // Leave the protected route before its session guard re-renders.
                  navigate("/ytso", { replace: true, flushSync: true });
                  update("");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link className="btn btn-secondary" to="/ytso/login">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
