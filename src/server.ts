import "dotenv/config";

import cors from "cors";
import express from "express";

import authRouter  from "./routes/auth";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import tasksRouter from "./routes/tasks";
import usersRouter from "./routes/users";

const app = express();
const port = Number(process.env.API_PORT || 3071);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOriginPatterns = (process.env.ALLOWED_ORIGIN_PATTERNS || "")
  .split(",")
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));

function isAllowedOrigin(origin: string) {
  return allowedOrigins.includes(origin) || allowedOriginPatterns.some((pattern) => pattern.test(origin));
}

app.set("trust proxy", 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
  },
}));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("<h1 style='color: blue; font-size: 24px; text-align: center;'>API: Studio Org - Organize seus estudos</h1>");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/calendar", calendarRouter);
app.use("/dashboard", dashboardRouter);
app.use("/tasks", tasksRouter);
app.use("/users", usersRouter);

app.listen(port, "0.0.0.0", () => {
  console.log(`[BACKEND] - Servidor rodando na porta ${port}`);
  console.log(`[BACKEND] - Origens permitidas: ${allowedOrigins.join(", ")}`);
  console.log(`[BACKEND] - Padroes de origem permitidos: ${allowedOriginPatterns.map(String).join(", ") || "nenhum"}`);
});
