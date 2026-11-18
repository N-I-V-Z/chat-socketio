const { createHash, randomBytes, randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const db = require("../models");
const httpError = require("../utils/httpError");
const { hashPassword, verifyAndUpgradePassword } = require("./passwordService");
const auditLogService = require("./auditLogService");
const cacheService = require("./cacheService");
const { USER_DIRECTORY_KEY } = require("./cacheKeys");
const { USER_ROLES } = require("../constants/userRole");

const REFRESH_COOKIE = "refreshToken";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
if (
  !Number.isSafeInteger(REFRESH_TOKEN_TTL_DAYS) ||
  REFRESH_TOKEN_TTL_DAYS < 1 ||
  REFRESH_TOKEN_TTL_DAYS > 365
) {
  throw new Error("REFRESH_TOKEN_TTL_DAYS must be between 1 and 365.");
}
const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
function getAccessTokenSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 bytes.");
  }
  return secret;
}

function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeUser(user) {
  return {
    userId: user.userId,
    userName: user.userName,
    role: user.role || USER_ROLES.USER,
  };
}

function signAccessToken(user) {
  return jwt.sign({}, getAccessTokenSecret(), {
    algorithm: "HS256",
    subject: String(user.userId),
    issuer: "chat-socketio",
    audience: "chat-socketio-api",
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, getAccessTokenSecret(), {
    algorithms: ["HS256"],
    issuer: "chat-socketio",
    audience: "chat-socketio-api",
  });
  const userId = Number(payload.sub);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new jwt.JsonWebTokenError("Invalid access token subject.");
  }
  return { userId, expiresAt: payload.exp };
}

function refreshCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === undefined
      ? process.env.NODE_ENV === "production"
      : process.env.COOKIE_SECURE === "true";

  return {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: REFRESH_TTL_MS,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

function newRefreshToken() {
  return randomBytes(64).toString("base64url");
}

async function createRefreshSession(userId, res, familyId = randomUUID()) {
  const user = await db.Users.findByPk(userId);
  if (!user || user.isActive === false) {
    throw httpError(401, "INVALID_CREDENTIALS", "Authentication required");
  }

  const refreshToken = newRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  await db.RefreshToken.create({
    userId,
    tokenHash,
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  setRefreshCookie(res, refreshToken);
  return {
    accessToken: signAccessToken(user),
    user: serializeUser(user),
  };
}

async function register(userName, password) {
  const passwordHash = await hashPassword(password);
  const user = await db.sequelize.transaction(async (transaction) => {
    const user = await db.Users.create(
      { userName, password: passwordHash },
      { transaction },
    );
    await auditLogService.recordEvent(
      {
        eventType: auditLogService.EVENT_TYPES.USER_REGISTERED,
        actorUserId: user.userId,
        actorUserName: user.userName,
        outcome: "success",
      },
      { transaction },
    );
    return serializeUser(user);
  });
  await cacheService.invalidate(USER_DIRECTORY_KEY);
  return user;
}

async function authenticate(userName, password) {
  const user = await db.Users.unscoped().findOne({ where: { userName } });
  if (!user || user.isActive === false) {
    return null;
  }

  if (!(await verifyAndUpgradePassword(user, password))) {
    return null;
  }

  return serializeUser(user);
}

async function revokeFamily(familyId) {
  await db.RefreshToken.update(
    { revokedAt: new Date() },
    { where: { familyId, revokedAt: null } },
  );
}

async function refreshSession(token, res) {
  if (!token) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Authentication required");
  }

  const tokenHash = hashRefreshToken(token);
  const storedToken = await db.RefreshToken.findOne({ where: { tokenHash } });

  if (!storedToken) {
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Authentication required");
  }

  if (storedToken.revokedAt) {
    await revokeFamily(storedToken.familyId);
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Authentication required");
  }

  if (storedToken.expiresAt <= new Date()) {
    await storedToken.update({ revokedAt: new Date() });
    throw httpError(401, "EXPIRED_REFRESH_TOKEN", "Authentication required");
  }

  const user = await db.Users.findByPk(storedToken.userId);
  if (!user || user.isActive === false) {
    await revokeFamily(storedToken.familyId);
    throw httpError(401, "INVALID_REFRESH_TOKEN", "Authentication required");
  }

  const nextToken = newRefreshToken();
  const nextTokenHash = hashRefreshToken(nextToken);
  const transaction = await db.sequelize.transaction();

  try {
    const [updatedCount] = await db.RefreshToken.update(
      { revokedAt: new Date(), replacedByHash: nextTokenHash },
      {
        where: { tokenId: storedToken.tokenId, revokedAt: null },
        transaction,
      },
    );

    if (updatedCount !== 1) {
      await transaction.rollback();
      await revokeFamily(storedToken.familyId);
      throw httpError(401, "INVALID_REFRESH_TOKEN", "Authentication required");
    }

    await db.RefreshToken.create(
      {
        userId: storedToken.userId,
        tokenHash: nextTokenHash,
        familyId: storedToken.familyId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
      { transaction },
    );
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }

  setRefreshCookie(res, nextToken);
  return {
    accessToken: signAccessToken(user),
    user: serializeUser(user),
  };
}

async function revokeRefreshSession(token) {
  if (!token) {
    return null;
  }

  const storedToken = await db.RefreshToken.findOne({
    attributes: ["userId"],
    where: {
      tokenHash: hashRefreshToken(token),
      revokedAt: null,
    },
  });
  if (!storedToken) {
    return null;
  }

  await db.RefreshToken.update(
    { revokedAt: new Date() },
    {
      where: {
        tokenHash: hashRefreshToken(token),
        revokedAt: null,
      },
    },
  );
  return storedToken.userId;
}

module.exports = {
  REFRESH_COOKIE,
  authenticate,
  clearRefreshCookie,
  createRefreshSession,
  hashRefreshToken,
  refreshSession,
  register,
  revokeRefreshSession,
  serializeUser,
  signAccessToken,
  verifyAccessToken,
};
