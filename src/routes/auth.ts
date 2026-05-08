import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { createAccessToken } from "../utils/auth";

const router = Router();
const scrypt = promisify(scryptCallback);

const ACCESS_TOKEN_EXPIRES_IN = 3600;
const REFRESH_TOKEN_EXPIRES_IN_REMEMBER_ME_DAYS = 30;
const REFRESH_TOKEN_EXPIRES_IN_DEFAULT_DAYS = 7;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKeyBuffer = Buffer.from(key, "hex");

  if (derivedKey.length !== storedKeyBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKeyBuffer);
}

router.post("/register", async (req, res) => {
  const { name, email, password, confirmPassword, acceptTerms } = req.body ?? {};

  const errors: Record<string, string[]> = {};

  if (typeof name !== "string" || name.trim().length < 2) {
    errors.name = ["Nome deve ter no minimo 2 caracteres."];
  }

  if (typeof email !== "string" || !isValidEmail(email)) {
    errors.email = ["Email invalido."];
  }

  if (typeof password !== "string" || password.length < 6) {
    errors.password = ["Senha deve ter no minimo 6 caracteres."];
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = ["Confirmacao de senha deve ser igual a senha."];
  }

  if (acceptTerms !== true) {
    errors.acceptTerms = ["Voce precisa aceitar os termos."];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors: {
        email: ["Email ja cadastrado."],
      },
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      acceptTermsAt: new Date(),
      preferences: {
        create: {},
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return res.status(201).json({
    message: "Usuario cadastrado com sucesso.",
    user,
  });
});

router.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body ?? {};

  const errors: Record<string, string[]> = {};

  if (typeof email !== "string" || !isValidEmail(email)) {
    errors.email = ["Email invalido."];
  }

  if (typeof password !== "string" || password.length < 6) {
    errors.password = ["Senha deve ter no minimo 6 caracteres."];
  }

  if (rememberMe !== undefined && typeof rememberMe !== "boolean") {
    errors.rememberMe = ["rememberMe deve ser um boolean."];
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Dados invalidos.",
      errors,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({
      message: "Email ou senha invalidos.",
    });
  }

  const refreshToken = randomUUID();
  const refreshTokenTtlDays = rememberMe
    ? REFRESH_TOKEN_EXPIRES_IN_REMEMBER_ME_DAYS
    : REFRESH_TOKEN_EXPIRES_IN_DEFAULT_DAYS;
  const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      expiresAt,
      userId: user.id,
    },
  });

  const accessToken = createAccessToken(user.id, ACCESS_TOKEN_EXPIRES_IN);

  return res.status(200).json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

export default router
