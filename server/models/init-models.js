var DataTypes = require("sequelize").DataTypes;
var _Chat = require("./Chat");
var _Message = require("./Message");
var _Users = require("./Users");

function initModels(sequelize) {
  var Chat = _Chat(sequelize, DataTypes);
  var Message = _Message(sequelize, DataTypes);
  var Users = _Users(sequelize, DataTypes);

  Message.belongsTo(Chat, { as: "chatRoom_Chat", foreignKey: "chatRoom"});
  Chat.hasMany(Message, { as: "Messages", foreignKey: "chatRoom"});
  Message.belongsTo(Users, { as: "user", foreignKey: "userId"});
  Users.hasMany(Message, { as: "Messages", foreignKey: "userId"});

  return {
    Chat,
    Message,
    Users,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
