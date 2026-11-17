const USER_ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

module.exports = { USER_ROLES, USER_ROLE_VALUES };
