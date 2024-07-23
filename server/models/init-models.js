var DataTypes = require("sequelize").DataTypes;
var _Message = require("./Message");
var _Users = require("./Users");

function initModels(sequelize) {
  var Message = _Message(sequelize, DataTypes);
  var Users = _Users(sequelize, DataTypes);

  Message.belongsTo(Users, { as: "Receiver", foreignKey: "ReceiverId"});
  Users.hasMany(Message, { as: "Messages", foreignKey: "ReceiverId"});
  Message.belongsTo(Users, { as: "Sender", foreignKey: "SenderId"});
  Users.hasMany(Message, { as: "Sender_Messages", foreignKey: "SenderId"});

  return {
    Message,
    Users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
