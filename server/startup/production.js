import helmet from "helmet";
import compression from "compression";

export default function production(app, { environment = "development" } = {}) {
  app.use(compression());
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      strictTransportSecurity: environment === "production" ? undefined : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            "data:",
            "https://*.ytimg.com",
            "https://yt3.ggpht.com",
            "https://yt3.googleusercontent.com",
          ],
          frameSrc: [
            "'self'",
            "https://www.youtube.com",
            "https://www.youtube-nocookie.com",
          ],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          // Local HTTP and a TLS-terminating proxy are both supported.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
}
