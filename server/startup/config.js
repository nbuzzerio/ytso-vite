import dotenv from "dotenv";

dotenv.config();

export default function () {
  if (!process.env.jwtPrivateKey) {
    throw new Error("FATAL ERROR: jwtPrivateKey is not defined.");
  }
}
