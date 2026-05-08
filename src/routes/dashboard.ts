import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUserId, sendUnauthorized } from "../utils/auth";
import { formatDateOnly, formatDeadlineLabel, formatDurationFromNow } from "../utils/tasks";

const router = Router();

router.get("/summary", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const now = new Date();
  const todayStart = new Date(`${formatDateOnly(now)}T00:00:00.000Z`);
  const todayEnd = new Date(`${formatDateOnly(now)}T23:59:59.999Z`);
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const [user, todayTasks, overdueTasks, upcomingTasks, weeklyTasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    prisma.task.count({
      where: {
        userId,
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    prisma.task.count({
      where: {
        userId,
        status: "overdue",
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: {
          in: ["pending", "overdue"],
        },
      },
      orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        course: true,
        dueDate: true,
        dueTime: true,
        priority: true,
        status: true,
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        status: true,
      },
    }),
  ]);

  if (!user) {
    return res.status(404).json({
      message: "Recurso nao encontrado.",
    });
  }

  const completedThisWeek = weeklyTasks.filter((task) => task.status === "completed").length;
  const weeklyAverage = weeklyTasks.length === 0
    ? 0
    : Math.round((completedThisWeek / weeklyTasks.length) * 100);

  const nextUpcomingTask = upcomingTasks.find((task) => task.status === "pending");
  const nextDeadlineIn = nextUpcomingTask
    ? formatDurationFromNow(nextUpcomingTask.dueDate)
    : null;

  return res.status(200).json({
    userName: user.name.split(" ")[0] ?? user.name,
    stats: {
      todayTasks,
      overdueTasks,
      nextDeadlineIn,
      weeklyAverage,
    },
    tasks: upcomingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      course: task.course,
      deadlineLabel: formatDeadlineLabel(task.dueDate, task.dueTime),
      priority: task.priority,
      status: task.status,
    })),
    focusItems: upcomingTasks.slice(0, 3).map((task, index) => ({
      id: `fcs_${task.id}`,
      title: task.title,
      subtitle: `Sessao de ${Math.max(15, (index + 1) * 15)} min recomendada`,
      tone: task.priority === "alta" ? "amber" : "blue",
    })),
  });
});

export default router;
