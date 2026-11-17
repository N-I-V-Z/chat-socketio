require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

if (
  !process.env.JWT_ACCESS_SECRET ||
  Buffer.byteLength(process.env.JWT_ACCESS_SECRET) < 32
) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 bytes.");
}

const { Sequelize } = require("sequelize");

const databaseName = process.env.DB_NAME || "ChatDb";
const password = process.env.DB_PASSWORD;

if (!password) {
  throw new Error("DB_PASSWORD must be set before starting the server.");
}

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}

const sequelize = new Sequelize("master", process.env.DB_USER || "sa", password, {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 1433),
  dialect: "mssql",
  dialectOptions: {
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: true,
      connectTimeout: 5000,
    },
  },
  logging: false,
});

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function ensureDatabase() {
  let lastError;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await sequelize.authenticate();
      await sequelize.query(
        `IF DB_ID(N'${databaseName}') IS NULL CREATE DATABASE [${databaseName}]`
      );
      await sequelize.close();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 30) {
        console.error(`Waiting for SQL Server (${attempt}/30): ${error.message}`);
        await delay(2000);
      }
    }
  }

  await sequelize.close();
  throw lastError;
}

ensureDatabase().catch((error) => {
  console.error("Could not initialize the application database:", error);
  process.exitCode = 1;
});
