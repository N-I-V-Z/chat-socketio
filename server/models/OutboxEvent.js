const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OutboxEvent",
    {
      ...auditAttributes(DataTypes),
      eventId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      eventType: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      nextAttemptAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      claimedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastErrorCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "OutboxEvents",
      schema: "dbo",
      timestamps: false,
      indexes: [
        {
          name: "IX_OutboxEvents_PublishedAt_NextAttemptAt_ClaimedUntil_CreatedAt",
          fields: [
            { name: "publishedAt" },
            { name: "nextAttemptAt" },
            { name: "claimedUntil" },
            { name: "createdAt" },
          ],
        },
      ],
    },
  );
};
