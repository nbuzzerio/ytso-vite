import rateLimit from "express-rate-limit";

export default function rateLimiter(api) {
  const authentication = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: "Too many sign-in attempts. Please try again in 15 minutes.",
    },
  });
  const search = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many channel requests. Please wait a minute and try again.",
    },
  });
  api.post(["/auth", "/users"], authentication);
  api.use("/search", search);
}
