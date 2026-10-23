import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  const token = req.header("x-auth-token");
  if (!token)
    return res.status(401).json({ error: "Please sign in to continue." });

  try {
    const decoded = jwt.verify(token, process.env.jwtPrivateKey, {
      algorithms: ["HS256"],
      audience: "ytso-session",
      issuer: "ytso",
    });
    if (
      typeof decoded !== "object" ||
      !/^[a-fA-F0-9]{24}$/.test(decoded._id) ||
      !Number.isFinite(decoded.exp)
    ) {
      return res.status(401).json({ error: "Please sign in again." });
    }
    req.user = decoded;
    next();
  } catch {
    res
      .status(401)
      .json({ error: "Your session has expired. Please sign in again." });
  }
}
