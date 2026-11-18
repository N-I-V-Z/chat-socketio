const Sequelize = require("sequelize");
const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "AuditLog",
    {
      ...auditAttributes(DataTypes),
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
    },
    {
      tableName: "AuditLogs",
      schema: "dbo",
      timestamps: false,
      indexes: [
        { name: "IX_AuditLogs_occurredAt", fields: ["occurredAt"] },
        { name: "IX_AuditLogs_eventType", fields: ["eventType"] },
      ],
    },
  );
};
