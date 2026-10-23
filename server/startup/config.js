import dotenv from "dotenv";

export default function config() {
  dotenv.config();
  const environment = process.env.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }
  if (!process.env.jwtPrivateKey) throw new Error("jwtPrivateKey is required.");
  const databaseUri =
    environment === "test" ? process.env.testdb : process.env.db;
  if (!databaseUri)
    throw new Error("A database connection string is required.");
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0) {
    throw new Error("TRUST_PROXY_HOPS must be a nonnegative integer.");
  }
  return { environment, databaseUri, port, trustProxy: proxyHops || false };
}
