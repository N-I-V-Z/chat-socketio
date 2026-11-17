"use strict";

const { DataTypes, QueryTypes, Sequelize } = require("sequelize");

const READ_RECEIPT_USER_INDEX = "IX_MessageReadReceipts_UserId_MessageId";
const OUTBOX_PENDING_INDEX =
  "IX_OutboxEvents_PublishedAt_NextAttemptAt_ClaimedUntil_CreatedAt";

module.exports = {
  async up(queryInterface) {
    for (const tableName of ["Users", "Message", "ConversationParticipants"]) {
      if (!(await queryInterface.tableExists(tableName))) {
        throw new Error(
          `${tableName} must exist before adding read receipts and outbox events.`,
        );
      }
    }

    if (
      (await queryInterface.tableExists("MessageReadReceipts")) ||
      (await queryInterface.tableExists("OutboxEvents"))
    ) {
      throw new Error(
        "Read receipt or outbox tables already exist; refusing to re-run migration.",
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "MessageReadReceipts",
        {
          MessageId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Message",
              key: "MessageId",
            },
            onDelete: "CASCADE",
          },
          UserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Users",
              key: "userId",
            },
            onDelete: "CASCADE",
          },
          readAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETDATE()"),
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "OutboxEvents",
        {
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
            defaultValue: Sequelize.literal("GETDATE()"),
          },
          nextAttemptAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETDATE()"),
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
        { transaction },
      );

      await queryInterface.sequelize.query(
        `INSERT INTO [dbo].[MessageReadReceipts] ([MessageId], [UserId], [readAt])
        SELECT [m].[MessageId], [p].[userId], GETDATE()
        FROM [dbo].[Message] AS [m]
        INNER JOIN [dbo].[ConversationParticipants] AS [p]
          ON [p].[conversationId] = [m].[ConversationId];`,
        { transaction, type: QueryTypes.INSERT },
      );

      await queryInterface.addIndex(
        "MessageReadReceipts",
        ["UserId", "MessageId"],
        { name: READ_RECEIPT_USER_INDEX, transaction },
      );
      await queryInterface.addIndex(
        "OutboxEvents",
        ["publishedAt", "nextAttemptAt", "claimedUntil", "createdAt"],
        { name: OUTBOX_PENDING_INDEX, transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      if (await queryInterface.tableExists("OutboxEvents")) {
        await queryInterface.dropTable("OutboxEvents", { transaction });
      }
      if (await queryInterface.tableExists("MessageReadReceipts")) {
        await queryInterface.dropTable("MessageReadReceipts", { transaction });
      }
    });
  },
};
