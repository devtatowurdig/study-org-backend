import cors from "cors";
import express from "express";

import authRouter  from "./routes/auth";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import tasksRouter from "./routes/tasks";
import usersRouter from "./routes/users";

const app = express();
const port = process.env.API_PORT || 3071;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("<h1 style='color: blue; font-size: 24px; text-align: center;'>API: Studio Org - Organize seus estudos</h1>");
});

app.use("/auth", authRouter);
app.use("/calendar", calendarRouter);
app.use("/dashboard", dashboardRouter);
app.use("/tasks", tasksRouter);
app.use("/users", usersRouter);

app.listen(port, () => {
  console.log(`[BACKEND] - Servidor rodando na porta ${port}`);
});
