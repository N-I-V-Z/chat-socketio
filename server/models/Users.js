const Sequelize = require("sequelize");
const { USER_ROLES, USER_ROLE_VALUES } = require("../constants/userRole");
const auditAttributes = require("./auditAttributes");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Users",
    {
      ...auditAttributes(DataTypes),
      userId: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      userName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...USER_ROLE_VALUES),
        allowNull: false,
        defaultValue: USER_ROLES.USER,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: "Users",
      schema: "dbo",
      timestamps: false,
      indexes: [
        {
          name: "PK__Users__CB9A1CFFF9B02A89",
          unique: true,
          fields: [{ name: "userId" }],
        },
      ],
    },
  );
};
