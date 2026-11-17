"use strict";

const { DataTypes, QueryTypes, Sequelize } = require("sequelize");

const MESSAGE_CONVERSATION_FK = "FK_Message_Conversation";
const MESSAGE_CONVERSATION_INDEX = "IX_Message_ConversationId_MessageId";
const CONVERSATION_PAIR_INDEX = "UX_Conversations_DirectPairKey";
const PARTICIPANT_USER_INDEX =
  "IX_ConversationParticipants_UserId_ConversationId";

function directPairExpression(alias = "m") {
  const senderId = `${alias}.[SenderId]`;
  const receiverId = `${alias}.[ReceiverId]`;
  const lowerId = `CASE WHEN ${senderId} < ${receiverId} THEN ${senderId} ELSE ${receiverId} END`;
  const higherId = `CASE WHEN ${senderId} < ${receiverId} THEN ${receiverId} ELSE ${senderId} END`;
  return `CONVERT(varchar(10), ${lowerId}) + ':' + CONVERT(varchar(10), ${higherId})`;
}

async function assertNoUnmappedMessages(queryInterface, transaction) {
  const rows = await queryInterface.sequelize.query(
    "SELECT COUNT_BIG(1) AS [unmappedCount] FROM [dbo].[Message] WHERE [ConversationId] IS NULL",
    { type: QueryTypes.SELECT, transaction },
  );
  const unmappedCount = Number(rows[0]?.unmappedCount);

  if (!Number.isFinite(unmappedCount)) {
    throw new Error("Could not verify that every message has a conversation.");
  }
  if (unmappedCount > 0) {
    throw new Error(
      `${unmappedCount} message(s) could not be assigned to a conversation.`,
    );
  }
}

module.exports = {
  async up(queryInterface) {
    if (
      !(await queryInterface.tableExists("Users")) ||
      !(await queryInterface.tableExists("Message"))
    ) {
      throw new Error(
        "Users and Message tables must exist before adding conversations.",
      );
    }

    const messageColumns = await queryInterface.describeTable("Message");
    if (!messageColumns.SenderId || !messageColumns.ReceiverId) {
      throw new Error(
        "Message.SenderId and Message.ReceiverId are required to backfill conversations.",
      );
    }
    if (messageColumns.ConversationId) {
      throw new Error(
        "Message.ConversationId already exists; refusing to re-run migration.",
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "Conversations",
        {
          conversationId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
          },
          directPairKey: {
            type: DataTypes.STRING(22),
            allowNull: true,
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETDATE()"),
          },
        },
        { transaction },
      );

      await queryInterface.createTable(
        "ConversationParticipants",
        {
          conversationId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Conversations",
              key: "conversationId",
            },
            onDelete: "CASCADE",
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Users",
              key: "userId",
            },
            onDelete: "CASCADE",
          },
          joinedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("GETDATE()"),
          },
        },
        { transaction },
      );

      await queryInterface.addColumn(
        "Message",
        "ConversationId",
        {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX [${CONVERSATION_PAIR_INDEX}] ON [dbo].[Conversations] ([directPairKey]) WHERE [directPairKey] IS NOT NULL;`,
        { transaction },
      );

      const pairExpression = directPairExpression();
      await queryInterface.sequelize.query(
        `INSERT INTO [dbo].[Conversations] ([directPairKey]) SELECT DISTINCT ${pairExpression} FROM [dbo].[Message] AS [m];`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `WITH [MessageParticipants] AS (
          SELECT ${pairExpression} AS [directPairKey], [m].[SenderId] AS [userId]
          FROM [dbo].[Message] AS [m]
          UNION
          SELECT ${pairExpression} AS [directPairKey], [m].[ReceiverId] AS [userId]
          FROM [dbo].[Message] AS [m]
        )
        INSERT INTO [dbo].[ConversationParticipants] ([conversationId], [userId])
        SELECT [c].[conversationId], [p].[userId]
        FROM [MessageParticipants] AS [p]
        INNER JOIN [dbo].[Conversations] AS [c]
          ON [c].[directPairKey] = [p].[directPairKey];`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE [m]
        SET [ConversationId] = [c].[conversationId]
        FROM [dbo].[Message] AS [m]
        INNER JOIN [dbo].[Conversations] AS [c]
          ON [c].[directPairKey] = ${pairExpression};`,
        { transaction },
      );

      await assertNoUnmappedMessages(queryInterface, transaction);

      await queryInterface.changeColumn(
        "Message",
        "ConversationId",
        {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        { transaction },
      );
      await queryInterface.addConstraint("Message", {
        fields: ["ConversationId"],
        type: "foreign key",
        name: MESSAGE_CONVERSATION_FK,
        references: {
          table: "Conversations",
          field: "conversationId",
        },
        onDelete: "CASCADE",
        transaction,
      });
      await queryInterface.addIndex(
        "Message",
        ["ConversationId", "MessageId"],
        { name: MESSAGE_CONVERSATION_INDEX, transaction },
      );
      await queryInterface.addIndex(
        "ConversationParticipants",
        ["userId", "conversationId"],
        { name: PARTICIPANT_USER_INDEX, transaction },
      );

      await queryInterface.sequelize.query(
        `DECLARE @foreignKeyName sysname;
        SELECT @foreignKeyName = [fk].[name]
        FROM [sys].[foreign_keys] AS [fk]
        INNER JOIN [sys].[foreign_key_columns] AS [fkc]
          ON [fkc].[constraint_object_id] = [fk].[object_id]
        INNER JOIN [sys].[columns] AS [column]
          ON [column].[object_id] = [fkc].[parent_object_id]
          AND [column].[column_id] = [fkc].[parent_column_id]
        WHERE [fk].[parent_object_id] = OBJECT_ID(N'[dbo].[Message]')
          AND [column].[name] = N'ReceiverId';
        IF @foreignKeyName IS NOT NULL
          EXEC(N'ALTER TABLE [dbo].[Message] DROP CONSTRAINT ' + QUOTENAME(@foreignKeyName));`,
        { transaction },
      );
      await queryInterface.removeColumn("Message", "ReceiverId", {
        transaction,
      });
    });
  },

  async down(queryInterface) {
    const groupConversations = await queryInterface.sequelize.query(
      `SELECT TOP (1) [c].[conversationId]
      FROM [dbo].[Conversations] AS [c]
      WHERE (
        SELECT COUNT_BIG(1)
        FROM [dbo].[ConversationParticipants] AS [p]
        WHERE [p].[conversationId] = [c].[conversationId]
      ) > 2`,
      { type: QueryTypes.SELECT },
    );
    if (groupConversations.length > 0) {
      throw new Error(
        "Cannot roll back conversations while a conversation has more than two participants.",
      );
    }

    const invalidMessages = await queryInterface.sequelize.query(
      `SELECT TOP (1) [m].[MessageId]
      FROM [dbo].[Message] AS [m]
      WHERE NOT EXISTS (
        SELECT 1
        FROM [dbo].[ConversationParticipants] AS [p]
        WHERE [p].[conversationId] = [m].[ConversationId]
          AND [p].[userId] = [m].[SenderId]
      )
      OR (
        SELECT COUNT_BIG(1)
        FROM [dbo].[ConversationParticipants] AS [p]
        WHERE [p].[conversationId] = [m].[ConversationId]
      ) NOT BETWEEN 1 AND 2`,
      { type: QueryTypes.SELECT },
    );
    if (invalidMessages.length > 0) {
      throw new Error(
        "Cannot roll back conversations because a message cannot be mapped to its original sender and receiver.",
      );
    }

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "Message",
        "ReceiverId",
        {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE [m]
        SET [ReceiverId] = CASE
          WHEN (
            SELECT COUNT_BIG(1)
            FROM [dbo].[ConversationParticipants] AS [p]
            WHERE [p].[conversationId] = [m].[ConversationId]
          ) = 1 THEN [m].[SenderId]
          ELSE (
            SELECT MIN([p].[userId])
            FROM [dbo].[ConversationParticipants] AS [p]
            WHERE [p].[conversationId] = [m].[ConversationId]
              AND [p].[userId] <> [m].[SenderId]
          )
        END
        FROM [dbo].[Message] AS [m];`,
        { transaction },
      );

      const missingReceivers = await queryInterface.sequelize.query(
        "SELECT COUNT_BIG(1) AS [missingCount] FROM [dbo].[Message] WHERE [ReceiverId] IS NULL",
        { type: QueryTypes.SELECT, transaction },
      );
      const missingCount = Number(missingReceivers[0]?.missingCount);
      if (!Number.isFinite(missingCount) || missingCount > 0) {
        throw new Error(
          "Could not restore every message receiver; conversation rollback stopped.",
        );
      }

      await queryInterface.changeColumn(
        "Message",
        "ReceiverId",
        {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        { transaction },
      );
      await queryInterface.addConstraint("Message", {
        fields: ["ReceiverId"],
        type: "foreign key",
        name: "FK_Message_ReceiverId",
        references: {
          table: "Users",
          field: "userId",
        },
        transaction,
      });
      await queryInterface.removeConstraint(
        "Message",
        MESSAGE_CONVERSATION_FK,
        { transaction },
      );
      await queryInterface.removeColumn("Message", "ConversationId", {
        transaction,
      });
      await queryInterface.dropTable("ConversationParticipants", {
        transaction,
      });
      await queryInterface.dropTable("Conversations", { transaction });
    });
  },
};
