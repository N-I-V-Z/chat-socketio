const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "MessageReadReceipt",
    {
      ...auditAttributes(DataTypes),
      MessageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Message",
          key: "MessageId",
        },
      },
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Users",
          key: "userId",
        },
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "MessageReadReceipts",
      schema: "dbo",
      timestamps: false,
      indexes: [
        {
          name: "IX_MessageReadReceipts_UserId_MessageId",
          fields: [{ name: "UserId" }, { name: "MessageId" }],
        },
      ],
    },
  );
};
