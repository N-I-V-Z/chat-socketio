var DataTypes = require("sequelize").DataTypes;
var _Message = require("./Message");
var _Users = require("./Users");
var _RefreshToken = require("./RefreshToken");
var _AuditLog = require("./AuditLog");

function initModels(sequelize) {
  var Message = _Message(sequelize, DataTypes);
  var Users = _Users(sequelize, DataTypes);
  var RefreshToken = _RefreshToken(sequelize, DataTypes);
  var AuditLog = _AuditLog(sequelize, DataTypes);

  Message.belongsTo(Users, { as: "Receiver", foreignKey: "ReceiverId"});
  Users.hasMany(Message, { as: "Messages", foreignKey: "ReceiverId"});
  Message.belongsTo(Users, { as: "Sender", foreignKey: "SenderId"});
  Users.hasMany(Message, { as: "Sender_Messages", foreignKey: "SenderId"});
  RefreshToken.belongsTo(Users, { as: "User", foreignKey: "userId" });
  Users.hasMany(RefreshToken, { as: "RefreshTokens", foreignKey: "userId" });

  return {
    Message,
    Users,
    RefreshToken,
    AuditLog,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
