export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.status || 500;
  let message = error.message;
  if (error.type === "entity.parse.failed") {
    status = 400;
    message = "The request body must be valid JSON.";
  } else if (error.type === "entity.too.large") {
    status = 413;
    message = "The request is too large.";
  } else if (error.name === "CastError" || error.name === "ValidationError") {
    status = 400;
    message = "Some submitted information is invalid.";
  } else if (error.code === 11000) {
    status = 409;
    message = "An account with this email already exists.";
  } else if (error.name === "VersionError") {
    status = 409;
    message = "This information changed. Please refresh and try again.";
  }

  if (status >= 500) {
    req.app.locals.logger?.error("API request failed", {
      message: error.message,
      stack: error.stack,
    });
    if (status === 500) message = "Something went wrong. Please try again.";
  }
  res.status(status).json({ error: message });
}
