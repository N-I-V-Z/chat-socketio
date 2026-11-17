"use strict";

const { DataTypes, Sequelize } = require("sequelize");

module.exports = {
  async up(queryInterface) {
    if (!(await queryInterface.tableExists("Users"))) {
      await queryInterface.createTable("Users", {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
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
      });
    }

    if (!(await queryInterface.tableExists("Message"))) {
      await queryInterface.createTable("Message", {
        MessageId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        SenderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "Users",
            key: "userId",
          },
        },
        ReceiverId: {
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
          defaultValue: Sequelize.literal("GETDATE()"),
        },
      });
    }
  },

  async down() {
    // This baseline may run against an existing database; rolling it back must not delete user data.
  },
};
