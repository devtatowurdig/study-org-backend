import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";

type JwtPayload = {
  sub: string;
  exp: number;
  iat: number;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(normalized, "base64").toString("utf8");
}

function signJwt(payload: JwtPayload) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", JWT_SECRET).update(content).digest("base64url");

  return `${content}.${signature}`;
}

function verifyJwt(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const content = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", JWT_SECRET).update(content).digest("base64url");

  const providedSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as JwtPayload;

    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function createAccessToken(userId: string, expiresInSeconds: number) {
  const issuedAt = Math.floor(Date.now() / 1000);

  return signJwt({
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  });
}

function getBearerToken(req: Request) {
  const authorizationHeader = req.header("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

function getAuthenticatedUserId(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const payload = verifyJwt(token);
  return payload?.sub ?? null;
}

function sendUnauthorized(res: Response) {
  return res.status(401).json({
    message: "Nao autenticado.",
  });
}

export { createAccessToken, getAuthenticatedUserId, sendUnauthorized };
