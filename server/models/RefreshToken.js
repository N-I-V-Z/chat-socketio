const { Sequelize } = require("sequelize");
const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "RefreshToken",
    {
      ...auditAttributes(DataTypes),
      tokenId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      familyId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      replacedByHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("GETDATE()"),
      },
    },
    {
      tableName: "RefreshTokens",
      schema: "dbo",
      timestamps: false,
    },
  );
};
