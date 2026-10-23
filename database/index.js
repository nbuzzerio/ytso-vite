import mongoose from "mongoose";

export default async function initDatabase(logger, databaseUri) {
  mongoose.set("strictQuery", false);
  await mongoose.connect(databaseUri, { serverSelectionTimeoutMS: 10_000 });
  logger.info("Connected to MongoDB.");
}
