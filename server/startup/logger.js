import winston from "winston";

// Process managers collect stdout/stderr. Logging must not open its own database
// connection or install process-level exception handlers when modules are imported.
export default winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
