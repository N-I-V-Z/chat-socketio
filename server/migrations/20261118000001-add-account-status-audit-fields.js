"use strict";

const { DataTypes } = require("sequelize");

const tables = [
  "Users",
  "Message",
  "Conversations",
  "ConversationParticipants",
  "RefreshTokens",
  "AuditLogs",
  "MessageReadReceipts",
  "OutboxEvents",
];
const columns = {
  createdAt: { type: DataTypes.DATE, allowNull: true },
  updatedAt: { type: DataTypes.DATE, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
};

module.exports = {
  async up(queryInterface) {
    for (const table of tables) {
      const existing = await queryInterface.describeTable({
        tableName: table,
        schema: "dbo",
      });
      for (const [name, definition] of Object.entries(columns)) {
        if (!existing[name])
          await queryInterface.addColumn(
            { tableName: table, schema: "dbo" },
            name,
            definition,
          );
      }
    }
    const users = await queryInterface.describeTable({
      tableName: "Users",
      schema: "dbo",
    });
    if (!users.isActive) {
      await queryInterface.addColumn(
        { tableName: "Users", schema: "dbo" },
        "isActive",
        {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      );
    }
  },
  async down(queryInterface) {
    const users = await queryInterface.describeTable({
      tableName: "Users",
      schema: "dbo",
    });
    if (users.isActive)
      await queryInterface.removeColumn(
        { tableName: "Users", schema: "dbo" },
        "isActive",
      );
    for (const table of [...tables].reverse()) {
      const existing = await queryInterface.describeTable({
        tableName: table,
        schema: "dbo",
      });
      for (const name of Object.keys(columns)) {
        if (
          existing[name] &&
          !(
            name === "createdAt" &&
            ["Conversations", "RefreshTokens", "OutboxEvents"].includes(table)
          )
        ) {
          await queryInterface.removeColumn(
            { tableName: table, schema: "dbo" },
            name,
          );
        }
      }
    }
  },
};
