require("dotenv").config();

const databaseConfig = {
  username: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ChatDb",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 1433),
  dialect: "mssql",
  dialectOptions: {
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: true,
    },
  },
};

module.exports = {
  development: databaseConfig,
  test: databaseConfig,
  production: databaseConfig,
};
