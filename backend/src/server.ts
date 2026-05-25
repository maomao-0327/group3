import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initializeDatabase } from "./db";
import userRouter from "./routes/user";
import matchRouter from "./routes/match";
import roomRouter from "./routes/room";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.use("/api/users", userRouter);
app.use("/api/matches", matchRouter);
app.use("/api/rooms", roomRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "Classroom Match API is running.",
    endpoints: ["/api/health", "/api/users", "/api/rooms", "/api/matches"],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 非同期で起動
async function start() {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
