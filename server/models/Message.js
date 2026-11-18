const Sequelize = require("sequelize");
const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Message",
    {
      ...auditAttributes(DataTypes),
      MessageId: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      ConversationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Conversations",
          key: "conversationId",
        },
      },
      SenderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "userId",
        },
      },
      MessageText: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      Timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.fn("getdate"),
      },
    },
    {
      sequelize,
      tableName: "Message",
      schema: "dbo",
      timestamps: false,
      indexes: [
        {
          name: "PK__Message__C87C0C9CE1B8AE90",
          unique: true,
          fields: [{ name: "MessageId" }],
        },
        {
          name: "IX_Message_ConversationId_MessageId",
          fields: [{ name: "ConversationId" }, { name: "MessageId" }],
        },
      ],
    },
  );
};
