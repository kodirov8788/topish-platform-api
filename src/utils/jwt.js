const crypto = require("crypto");

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const fromBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padding), "base64").toString(
    "utf8"
  );
};

const parseExpiresIn = (value) => {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 60 * 60;
  }

  const match = String(value).trim().match(/^(\d+)([smhd])?$/i);
  if (!match) {
    return 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };

  return amount * multipliers[unit];
};

const sign = (input, secret) =>
  crypto
    .createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const createJWT = ({ payload, secret, expiresIn }) => {
  if (!secret) {
    throw new Error("JWT secret is required");
  }

  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + parseExpiresIn(expiresIn),
  };
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(body));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const isTokenValid = (token, secret) => {
  if (!token || !secret) {
    const error = new Error("jwt must be provided");
    error.name = "JsonWebTokenError";
    throw error;
  }

  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    const error = new Error("jwt malformed");
    error.name = "JsonWebTokenError";
    throw error;
  }

  const expectedSignature = sign(`${header}.${payload}`, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    const error = new Error("invalid signature");
    error.name = "JsonWebTokenError";
    throw error;
  }

  const decoded = JSON.parse(fromBase64Url(payload));
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) {
    const error = new Error("jwt expired");
    error.name = "TokenExpiredError";
    throw error;
  }

  return decoded;
};

const createTokenUser = (user) => ({
  phoneNumber: user.phoneNumber,
  coins: user.coins,
  id: user.id,
  role:
    Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : null,
  favorites: user.favorites,
  avatar: user.avatar,
  fullName: user.fullName,
  roles: user.roles,
});

const generateTokens = (user) => {
  const payload = createTokenUser(user);

  const accessToken = createJWT({
    payload,
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_LIFETIME,
  });

  const refreshToken = createJWT({
    payload,
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_LIFETIME,
  });

  return {
    accessToken: `Bearer ${accessToken}`,
    refreshToken,
  };
};

const attachCookiesToResponse = ({ res, user }) => {
  const { accessToken, refreshToken } = generateTokens(user);
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    signed: false,
    sameSite: isProduction ? "none" : "lax",
    maxAge: parseExpiresIn(process.env.JWT_LIFETIME) * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    signed: false,
    sameSite: isProduction ? "none" : "lax",
    maxAge: parseExpiresIn(process.env.JWT_REFRESH_LIFETIME) * 1000,
  });
};

module.exports = {
  attachCookiesToResponse,
  createJWT,
  createTokenUser,
  generateTokens,
  isTokenValid,
};
