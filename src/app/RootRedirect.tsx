import { useEffect } from "react";

export default function RootRedirect() {
  useEffect(() => {
    // Reload inside the app's cookie scope before initializing its session.
    window.location.replace("/ytso/");
  }, []);
  return <p role="status">Opening your library…</p>;
}
