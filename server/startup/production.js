import helmet from "helmet";
import compression from "compression";

export default function (app) {
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      crossOriginEmbedderPolicy: false,
      directives: {
        "default-src": ["'self'", "'unsafe-inline'"],
        "script-src": ["'self'", "'unsafe-eval'"],
        "img-src": ["'self'", "https://yt3.ggpht.com"],
        "style-src": null,
      },
    }),
  );
  app.use(compression());
}
