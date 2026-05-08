import { Router } from "express";
import { Theme } from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUserId, sendUnauthorized } from "../utils/auth";

const router = Router();

router.get("/me", async (req, res) => {
  const userIdHeader = getAuthenticatedUserId(req);

  if (!userIdHeader) {
    return sendUnauthorized(res);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userIdHeader,
    },
    select: {
      id: true,
      name: true,
      email: true,
      preferences: {
        select: {
          theme: true,
          emailNotifications: true,
          pushNotifications: true,
          dailySummary: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "Recurso nao encontrado.",
    });
  }

  return res.status(200).json(user);
});

router.patch("/me/preferences", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendUnauthorized(res);
  }

  const { theme, emailNotifications, pushNotifications, dailySummary } = req.body ?? {};
  const errors: Record<string, string[]> = {};

  if (theme !== undefined && theme !== "light" && theme !== "dark") {
    errors.theme = ["Tema invalido."];
  }

  if (emailNotifications !== undefined && typeof emailNotifications !== "boolean") {
    errors.emailNotifications = ["emailNotifications deve ser um boolean."];
  }

  if (pushNotifications !== undefined && typeof pushNotifications !== "boolean") {
    errors.pushNotifications = ["pushNotifications deve ser um boolean."];
  }

  if (dailySummary !== undefined && typeof dailySummary !== "boolean") {
    errors.dailySummary = ["dailySummary deve ser um boolean."];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors,
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!existingUser) {
    return res.status(404).json({
      message: "Recurso nao encontrado.",
    });
  }

  const preferences = await prisma.userPreferences.upsert({
    where: {
      userId,
    },
    update: {
      ...(theme !== undefined ? { theme: theme as Theme } : {}),
      ...(emailNotifications !== undefined ? { emailNotifications } : {}),
      ...(pushNotifications !== undefined ? { pushNotifications } : {}),
      ...(dailySummary !== undefined ? { dailySummary } : {}),
    },
    create: {
      userId,
      theme: (theme ?? "light") as Theme,
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? false,
      dailySummary: dailySummary ?? true,
    },
    select: {
      theme: true,
      emailNotifications: true,
      pushNotifications: true,
      dailySummary: true,
    },
  });

  return res.status(200).json(preferences);
});

export default router;
