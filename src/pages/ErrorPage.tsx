import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import NavBar from "../components/NavBar";

export default function ErrorPage() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="app-shell">
      <NavBar />
      <main className="page">
        <div className="empty-state">
          <p className="eyebrow">{missing ? "404" : "Something went wrong"}</p>
          <h1>
            {missing ? "This page isn't here" : "We couldn't open this page"}
          </h1>
          <p>
            {missing
              ? "The link may have changed. Your library is a good place to start."
              : "Please reload the page or return to your library."}
          </p>
          <div className="toolbar mt-6 justify-center">
            <Link className="btn btn-primary" to="/ytso/channels">
              Go to channels
            </Link>
            {!missing && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
