"use strict";

const { Op, QueryTypes } = require("sequelize");
const { USER_ROLE_VALUES } = require("../constants/userRole");

const ROLE_CONSTRAINT = "CK_Users_Role";

module.exports = {
  async up(queryInterface) {
    if (!(await queryInterface.tableExists("Users"))) {
      throw new Error("Users table must exist before constraining user roles.");
    }

    const columns = await queryInterface.describeTable("Users");
    if (!columns.role) {
      throw new Error("Users.role must exist before constraining user roles.");
    }

    const existingRoles = await queryInterface.sequelize.query(
      "SELECT DISTINCT [role] AS [role] FROM [dbo].[Users]",
      { type: QueryTypes.SELECT },
    );
    const unsupportedRoles = existingRoles
      .map(({ role }) => role)
      .filter((role) => !USER_ROLE_VALUES.includes(role));

    if (unsupportedRoles.length > 0) {
      const values = [...new Set(unsupportedRoles)]
        .map((role) => (role === null ? "<NULL>" : String(role)))
        .join(", ");
      throw new Error(
        `Users.role contains unsupported values (${values}); update them before applying this migration.`,
      );
    }

    await queryInterface.addConstraint("Users", {
      fields: ["role"],
      type: "check",
      name: ROLE_CONSTRAINT,
      where: { role: { [Op.in]: USER_ROLE_VALUES } },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("Users", ROLE_CONSTRAINT);
  },
};
