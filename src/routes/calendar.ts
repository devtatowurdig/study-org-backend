import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUserId, sendUnauthorized } from "../utils/auth";
import { formatDateOnly } from "../utils/tasks";

const router = Router();

router.get("/", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const month = Number(req.query.month ?? new Date().getUTCMonth() + 1);
  const year = Number(req.query.year ?? new Date().getUTCFullYear());

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors: {
        month: ["Mes ou ano invalido."],
      },
    });
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const items = await prisma.task.findMany({
    where: {
      userId,
      dueDate: {
        gte: start,
        lte: end,
      },
    },
    orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }],
    select: {
      id: true,
      title: true,
      course: true,
      dueDate: true,
      dueTime: true,
      status: true,
    },
  });

  return res.status(200).json({
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      course: item.course,
      date: formatDateOnly(item.dueDate),
      time: item.dueTime,
      status: item.status,
    })),
  });
});

export default router;
