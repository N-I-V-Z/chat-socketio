"use strict";

const { DataTypes, Sequelize } = require("sequelize");
const { hashPassword } = require("../services/passwordService");

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const SHA256_BCRYPT_PREFIX = "$bcrypt-sha256$";

module.exports = {
  async up(queryInterface) {
    const userIndexes = await queryInterface.showIndex("Users");
    const hasUniqueUsername = userIndexes.some(
      (index) =>
        index.unique &&
        index.fields.some((field) => field.attribute === "userName")
    );

    if (!hasUniqueUsername) {
      await queryInterface.addIndex("Users", ["userName"], {
        unique: true,
        name: "UQ_Users_userName",
      });
    }

    if (!(await queryInterface.tableExists("RefreshTokens"))) {
      await queryInterface.createTable("RefreshTokens", {
        tokenId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "Users",
            key: "userId",
          },
          onDelete: "CASCADE",
        },
        tokenHash: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
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
      });

      await queryInterface.addIndex("RefreshTokens", ["familyId"], {
        name: "IX_RefreshTokens_familyId",
      });
    }

    const users = await queryInterface.sequelize.query(
      "SELECT [userId], [password] FROM [dbo].[Users]",
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const user of users) {
      if (
        BCRYPT_HASH_PATTERN.test(user.password) ||
        user.password.startsWith(SHA256_BCRYPT_PREFIX)
      ) {
        continue;
      }

      await queryInterface.bulkUpdate(
        "Users",
        { password: await hashPassword(user.password) },
        { userId: user.userId }
      );
    }
  },

  async down(queryInterface) {
    if (await queryInterface.tableExists("RefreshTokens")) {
      await queryInterface.dropTable("RefreshTokens");
    }

    const userIndexes = await queryInterface.showIndex("Users");
    const usernameIndex = userIndexes.find(
      (index) => index.name === "UQ_Users_userName"
    );
    if (usernameIndex) {
      await queryInterface.removeIndex("Users", "UQ_Users_userName");
    }
  },
};
