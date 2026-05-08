import { TaskPriority, TaskRecurrence, TaskStatus } from "../../generated/prisma/enums";

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === "baixa" || value === "media" || value === "alta";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "pending" || value === "completed" || value === "overdue";
}

function isTaskRecurrence(value: unknown): value is TaskRecurrence {
  return value === "none" || value === "daily" || value === "weekly" || value === "monthly";
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTask(task: {
  id: string;
  title: string;
  description: string | null;
  course: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date;
  dueTime: string | null;
  estimatedHours: { toNumber(): number } | null;
  recurrence: TaskRecurrence;
  tags: string[];
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    course: task.course,
    priority: task.priority,
    status: task.status,
    dueDate: formatDateOnly(task.dueDate),
    dueTime: task.dueTime,
    estimatedHours: task.estimatedHours?.toNumber() ?? null,
    recurrence: task.recurrence,
    tags: task.tags,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function formatDurationFromNow(target: Date) {
  const diffMs = target.getTime() - Date.now();

  if (diffMs <= 0) {
    return "agora";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatDeadlineLabel(dueDate: Date, dueTime: string | null) {
  const today = formatDateOnly(new Date());
  const dateLabel = formatDateOnly(dueDate) === today
    ? "Hoje"
    : dueDate.toLocaleDateString("pt-BR");

  return dueTime ? `${dateLabel}, ${dueTime}` : dateLabel;
}

export {
  formatDateOnly,
  formatDeadlineLabel,
  formatDurationFromNow,
  formatTask,
  isTaskPriority,
  isTaskRecurrence,
  isTaskStatus,
};
