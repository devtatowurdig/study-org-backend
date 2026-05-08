import { Router } from "express";
import { TaskPriority, TaskRecurrence, TaskStatus } from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUserId, sendUnauthorized } from "../utils/auth";
import { formatDateOnly, formatTask, isTaskPriority, isTaskRecurrence, isTaskStatus } from "../utils/tasks";

const router = Router();

router.get("/", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const { status, search, priority, course, from, to } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const errors: Record<string, string[]> = {};

  if (status !== undefined && !isTaskStatus(status)) {
    errors.status = ["Status invalido."];
  }

  if (priority !== undefined && !isTaskPriority(priority)) {
    errors.priority = ["Prioridade invalida."];
  }

  if (from !== undefined && (typeof from !== "string" || Number.isNaN(Date.parse(from)))) {
    errors.from = ["Data inicial invalida."];
  }

  if (to !== undefined && (typeof to !== "string" || Number.isNaN(Date.parse(to)))) {
    errors.to = ["Data final invalida."];
  }

  if (!Number.isInteger(page) || page < 1) {
    errors.page = ["Page deve ser um inteiro maior que 0."];
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.limit = ["Limit deve ser um inteiro entre 1 e 100."];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors,
    });
  }

  const where = {
    userId,
    ...(status ? { status: status as TaskStatus } : {}),
    ...(priority ? { priority: priority as TaskPriority } : {}),
    ...(typeof course === "string" && course.trim()
      ? { course: { equals: course.trim(), mode: "insensitive" as const } }
      : {}),
    ...(typeof search === "string" && search.trim()
      ? {
          OR: [
            { title: { contains: search.trim(), mode: "insensitive" as const } },
            { description: { contains: search.trim(), mode: "insensitive" as const } },
            { course: { contains: search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...((from || to)
      ? {
          dueDate: {
            ...(typeof from === "string" ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(typeof to === "string" ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return res.status(200).json({
    items: items.map(formatTask),
    page,
    limit,
    total,
  });
});

router.get("/completed", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const items = await prisma.task.findMany({
    where: {
      userId,
      status: "completed",
    },
    orderBy: {
      completedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      course: true,
      completedAt: true,
      estimatedHours: true,
      priority: true,
    },
  });

  return res.status(200).json({
    items: items.map((task) => ({
      id: task.id,
      title: task.title,
      course: task.course,
      completedAt: task.completedAt?.toISOString() ?? null,
      durationHours: task.estimatedHours?.toNumber() ?? null,
      priority: task.priority,
    })),
  });
});

router.post("/", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const {
    title,
    description,
    course,
    priority,
    dueDate,
    dueTime,
    estimatedHours,
    recurrence,
    tags,
  } = req.body ?? {};

  const errors: Record<string, string[]> = {};

  if (typeof title !== "string" || title.trim().length < 4) {
    errors.title = ["Titulo deve ter no minimo 4 caracteres."];
  }

  if (typeof course !== "string" || course.trim().length < 2) {
    errors.course = ["Curso deve ter no minimo 2 caracteres."];
  }

  if (!isTaskPriority(priority)) {
    errors.priority = ["Prioridade invalida."];
  }

  if (typeof dueDate !== "string" || Number.isNaN(Date.parse(dueDate))) {
    errors.dueDate = ["Data de entrega invalida."];
  }

  if (description !== undefined && description !== null && typeof description !== "string") {
    errors.description = ["Descricao invalida."];
  }

  if (dueTime !== undefined && dueTime !== null && (typeof dueTime !== "string" || !/^\d{2}:\d{2}$/.test(dueTime))) {
    errors.dueTime = ["Horario invalido."];
  }

  if (estimatedHours !== undefined && estimatedHours !== null && (typeof estimatedHours !== "number" || estimatedHours <= 0)) {
    errors.estimatedHours = ["estimatedHours deve ser um numero maior que 0."];
  }

  if (recurrence !== undefined && recurrence !== null && !isTaskRecurrence(recurrence)) {
    errors.recurrence = ["Recorrencia invalida."];
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    errors.tags = ["Tags devem ser uma lista de strings."];
  }

  if (Array.isArray(tags) && tags.some((tag) => typeof tag !== "string")) {
    errors.tags = ["Tags devem ser uma lista de strings."];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors,
    });
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: title.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      course: course.trim(),
      priority,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`),
      dueTime: typeof dueTime === "string" && dueTime.trim() ? dueTime : null,
      estimatedHours: typeof estimatedHours === "number" ? estimatedHours : undefined,
      recurrence: (recurrence ?? "none") as TaskRecurrence,
      tags: Array.isArray(tags) ? tags.map((tag) => tag.trim()) : [],
    },
  });

  return res.status(201).json(formatTask(task));
});

router.patch("/:id/status", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const { status } = req.body ?? {};

  if (!isTaskStatus(status) || status === "overdue") {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors: {
        status: ["Status deve ser pending ou completed."],
      },
    });
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      id: req.params.id,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!existingTask) {
    return res.status(404).json({
      message: "Recurso nao encontrado.",
    });
  }

  const task = await prisma.task.update({
    where: {
      id: req.params.id,
    },
    data: {
      status,
      completedAt: status === "completed" ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
    },
  });

  return res.status(200).json({
    id: task.id,
    status: task.status,
    completedAt: task.completedAt?.toISOString() ?? null,
  });
});

export default router;
