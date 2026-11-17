"use strict";

const { DataTypes, Sequelize } = require("sequelize");

const AUDIT_LOG_INDEXES = [
  { name: "IX_AuditLogs_occurredAt", fields: ["occurredAt"] },
  { name: "IX_AuditLogs_eventType", fields: ["eventType"] },
];

module.exports = {
  async up(queryInterface) {
    if (!(await queryInterface.tableExists("Users"))) {
      throw new Error("Users table must exist before adding admin roles.");
    }

    const userColumns = await queryInterface.describeTable("Users");
    if (!userColumns.role) {
      await queryInterface.addColumn("Users", "role", {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "user",
      });
    }

    await queryInterface.bulkUpdate(
      "Users",
      { role: "admin" },
      { userName: "nivz" }
    );

    if (!(await queryInterface.tableExists("AuditLogs"))) {
      await queryInterface.createTable("AuditLogs", {
        eventId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        eventType: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        actorUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "Users",
            key: "userId",
          },
          onDelete: "SET NULL",
        },
        actorUserName: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        targetUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        outcome: {
          type: DataTypes.STRING(16),
          allowNull: true,
        },
        occurredAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("GETDATE()"),
        },
      });
    }

    const indexes = await queryInterface.showIndex("AuditLogs");
    for (const index of AUDIT_LOG_INDEXES) {
      if (!indexes.some(({ name }) => name === index.name)) {
        await queryInterface.addIndex("AuditLogs", index.fields, {
          name: index.name,
        });
      }
    }
  },

  async down(queryInterface) {
    if (await queryInterface.tableExists("AuditLogs")) {
      await queryInterface.dropTable("AuditLogs");
    }

    const userColumns = await queryInterface.describeTable("Users");
    if (userColumns.role) {
      await queryInterface.removeColumn("Users", "role");
    }
  },
};
