import mongoose from "mongoose";

const db =
  process.env.NODE_ENV === "test" ? process.env.testdb : process.env.db;

export default function (logger) {
  mongoose.set("strictQuery", false);
  mongoose
    .connect(db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => logger.info("Connected to MongoDB..."));
}
