import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";
import NavBar from "../components/NavBar";
import PwaStatus from "../features/pwa/PwaStatus";

export default function Layout() {
  const location = useLocation();
  const navigation = useNavigation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    main.current?.focus({ preventScroll: true });
    const updateTitle = () => {
      const heading = main.current?.querySelector("h1")?.textContent;
      document.title = heading
        ? `${heading} · YTSO`
        : "YTSO · YouTube Subscription Organizer";
    };
    updateTitle();
    // Category names and the signed-in overview can arrive after the route renders.
    const observer = new MutationObserver(updateTitle);
    if (main.current)
      observer.observe(main.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    return () => observer.disconnect();
  }, [location.pathname, location.search]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <NavBar />
      <PwaStatus />
      {navigation.state === "loading" && (
        <div className="route-progress" role="status">
          Loading page…
        </div>
      )}
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        aria-busy={navigation.state === "loading"}
      >
        <Outlet />
      </main>
      <footer className="site-footer">
        A little less scrolling. A little more intention.
        <span>Organize here. Watch on YouTube.</span>
      </footer>
    </div>
  );
}
