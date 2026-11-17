const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "ConversationParticipant",
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
        defaultValue: Sequelize.Sequelize.fn("getdate"),
      },
    },
    {
      sequelize,
      tableName: "ConversationParticipants",
      schema: "dbo",
      timestamps: false,
    },
  );
};
