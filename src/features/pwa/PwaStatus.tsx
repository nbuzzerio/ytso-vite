import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";

export default function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const registration = useRef<ServiceWorkerRegistration>();
  const refreshRequested = useRef(false);
  const refreshTimeout = useRef<number>();
  const pendingWrites = useIsMutating() > 0;

  useEffect(() => {
    let disposed = false;
    let checking = false;
    let observedWorker: ServiceWorker | null = null;
    let hadController = !!navigator.serviceWorker?.controller;
    const showUpdate = () => {
      if (disposed) return;
      setUpdateAvailable(true);
      setDismissed(false);
    };
    const reportVersion = () => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[type="module"][src]',
      );
      if (script)
        navigator.serviceWorker?.controller?.postMessage({
          type: "YTSO_CLIENT_READY",
          entry: new URL(script.src).pathname,
        });
    };
    const onControllerChange = () => {
      reportVersion();
      if (refreshRequested.current) window.location.reload();
      else if (hadController) showUpdate();
      hadController = true;
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "YTSO_REPORT_VERSION") reportVersion();
    };
    const onStateChange = () => {
      if (
        observedWorker?.state === "installed" &&
        navigator.serviceWorker.controller
      )
        showUpdate();
    };
    const onUpdateFound = () => {
      observedWorker?.removeEventListener("statechange", onStateChange);
      observedWorker = registration.current?.installing || null;
      observedWorker?.addEventListener("statechange", onStateChange);
    };
    const supported = import.meta.env.PROD && "serviceWorker" in navigator;
    const checkForUpdate = async () => {
      if (!supported || !navigator.onLine || disposed || checking) return;
      checking = true;
      try {
        if (!registration.current) {
          const result = await navigator.serviceWorker.register(
            `${import.meta.env.BASE_URL}sw.js`,
            {
              scope: import.meta.env.BASE_URL,
              updateViaCache: "none",
            },
          );
          if (disposed) return;
          registration.current = result;
          result.addEventListener("updatefound", onUpdateFound);
          if (result.waiting) showUpdate();
          onUpdateFound();
        } else if (!registration.current.installing)
          await registration.current.update();
        reportVersion();
      } catch {
        // A failed update/network check leaves the working version intact.
      } finally {
        checking = false;
      }
    };
    const onOnline = () => {
      setOnline(true);
      void checkForUpdate();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    if (supported) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
      navigator.serviceWorker.addEventListener("message", onMessage);
      // Offline launches still report their loaded version so obsolete caches
      // can be cleaned after every open tab has refreshed.
      reportVersion();
      void checkForUpdate();
    }
    const timer = window.setInterval(() => void checkForUpdate(), 60 * 60_000);
    return () => {
      disposed = true;
      clearInterval(timer);
      clearTimeout(refreshTimeout.current);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      if (supported) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
        navigator.serviceWorker.removeEventListener("message", onMessage);
      }
      registration.current?.removeEventListener("updatefound", onUpdateFound);
      observedWorker?.removeEventListener("statechange", onStateChange);
      registration.current = undefined;
    };
  }, []);

  function refresh() {
    setApplying(true);
    setUpdateError("");
    refreshRequested.current = true;
    if (registration.current?.waiting) {
      registration.current.waiting.postMessage({ type: "SKIP_WAITING" });
      // Do not leave an unusable disabled action if activation fails.
      refreshTimeout.current = window.setTimeout(() => {
        refreshRequested.current = false;
        setApplying(false);
        setUpdateError("The update couldn't be applied. Please try again.");
      }, 15_000);
    } else window.location.reload();
  }

  if (online && (!updateAvailable || dismissed)) return null;
  return (
    <div className="pwa-status">
      {!online && (
        <div className="feedback feedback-info" role="status">
          You're offline. Reconnect to load your library, search YouTube, or
          save changes.
        </div>
      )}
      {updateAvailable && !dismissed && (
        <div className="feedback feedback-info pwa-update" role="status">
          <span>
            {updateError ||
              "A new version of YTSO is ready. Refresh when you're ready; unsaved changes will be lost."}
          </span>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              type="button"
              disabled={pendingWrites || applying}
              onClick={() => void refresh()}
            >
              {applying ? "Updating…" : "Refresh to update"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={applying}
              onClick={() => setDismissed(true)}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
