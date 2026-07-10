import crypto from "crypto";

const tokenSeparator = ".";

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeDuration(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60 * 60 * 24 * 7;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash?.includes(":")) {
    return false;
  }

  const [salt, expectedHash] = storedHash.split(":");
  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqualString(actualHash, expectedHash);
}

export function createJwt(payload, secret, expiresInSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const expires = now + normalizeDuration(expiresInSeconds);
  const tokenPayload = { ...payload, iat: now, exp: expires };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}${tokenSeparator}${encodedPayload}`)
    .digest("base64");

  const encodedSignature = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encodedHeader}${tokenSeparator}${encodedPayload}${tokenSeparator}${encodedSignature}`;
}

export function verifyJwt(token, secret) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(tokenSeparator);
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}${tokenSeparator}${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (!timingSafeEqualString(encodedSignature, expectedSignature)) {
    throw new Error("Invalid token");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

export function parseCookies(header = "") {
  return header.split(";").reduce((cookies, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      return cookies;
    }
    cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rest.join("=") || "");
    return cookies;
  }, {});
}

export function createAuthCookie(
  name,
  value,
  {
    maxAge = 7 * 24 * 60 * 60,
    httpOnly = true,
    sameSite = "Lax",
    secure = process.env.NODE_ENV === "production",
  } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];

  if (httpOnly) {
    parts.push("HttpOnly");
  }

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
