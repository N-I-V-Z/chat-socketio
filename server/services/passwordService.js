const bcrypt = require("bcryptjs");
const { createHash, timingSafeEqual } = require("node:crypto");

const PASSWORD_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const SHA256_BCRYPT_PREFIX = "$bcrypt-sha256$";

function prehash(password) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

async function hashPassword(password) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    return `${SHA256_BCRYPT_PREFIX}${await bcrypt.hash(prehash(password), 12)}`;
  }
  return bcrypt.hash(password, 12);
}

async function verifyAndUpgradePassword(user, password) {
  const isSha256Bcrypt = user.password.startsWith(SHA256_BCRYPT_PREFIX);
  const isBcryptHash =
    isSha256Bcrypt || PASSWORD_HASH_PATTERN.test(user.password);
  const isLegacyPassword = !isBcryptHash;
  const hash = isSha256Bcrypt
    ? user.password.slice(SHA256_BCRYPT_PREFIX.length)
    : user.password;
  const passwordToCompare = isSha256Bcrypt ? prehash(password) : password;
  const left = Buffer.from(user.password);
  const right = Buffer.from(password);
  let isValidPassword;
  if (isLegacyPassword) {
    isValidPassword =
      left.length === right.length && timingSafeEqual(left, right);
  } else if (isSha256Bcrypt || right.length <= 72) {
    isValidPassword = await bcrypt.compare(passwordToCompare, hash);
  } else {
    isValidPassword = false;
  }

  if (isValidPassword && isLegacyPassword) {
    await user.update({ password: await hashPassword(password) });
  }

  return isValidPassword;
}

module.exports = {
  hashPassword,
  verifyAndUpgradePassword,
};
