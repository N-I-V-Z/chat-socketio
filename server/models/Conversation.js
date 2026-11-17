const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Conversation",
    {
      conversationId: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      directPairKey: {
        type: DataTypes.STRING(22),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.fn("getdate"),
      },
    },
    {
      sequelize,
      tableName: "Conversations",
      schema: "dbo",
      timestamps: false,
    },
  );
};
