var DataTypes = require("sequelize").DataTypes;
var _Message = require("./Message");
var _Users = require("./Users");
var _Conversation = require("./Conversation");
var _ConversationParticipant = require("./ConversationParticipant");
var _RefreshToken = require("./RefreshToken");
var _AuditLog = require("./AuditLog");
var _MessageReadReceipt = require("./MessageReadReceipt");
var _OutboxEvent = require("./OutboxEvent");

function initModels(sequelize) {
  var Message = _Message(sequelize, DataTypes);
  var Users = _Users(sequelize, DataTypes);
  var Conversation = _Conversation(sequelize, DataTypes);
  var ConversationParticipant = _ConversationParticipant(sequelize, DataTypes);
  var RefreshToken = _RefreshToken(sequelize, DataTypes);
  var AuditLog = _AuditLog(sequelize, DataTypes);
  var MessageReadReceipt = _MessageReadReceipt(sequelize, DataTypes);
  var OutboxEvent = _OutboxEvent(sequelize, DataTypes);

  Message.belongsTo(Conversation, {
    as: "Conversation",
    foreignKey: "ConversationId",
  });
  Conversation.hasMany(Message, {
    as: "Messages",
    foreignKey: "ConversationId",
  });
  Message.belongsTo(Users, { as: "Sender", foreignKey: "SenderId" });
  Users.hasMany(Message, { as: "Sender_Messages", foreignKey: "SenderId" });
  Conversation.belongsToMany(Users, {
    as: "Participants",
    through: ConversationParticipant,
    foreignKey: "conversationId",
    otherKey: "userId",
  });
  Users.belongsToMany(Conversation, {
    as: "Conversations",
    through: ConversationParticipant,
    foreignKey: "userId",
    otherKey: "conversationId",
  });
  RefreshToken.belongsTo(Users, { as: "User", foreignKey: "userId" });
  Users.hasMany(RefreshToken, { as: "RefreshTokens", foreignKey: "userId" });
  Message.hasMany(MessageReadReceipt, {
    as: "ReadReceipts",
    foreignKey: "MessageId",
  });
  MessageReadReceipt.belongsTo(Message, {
    as: "Message",
    foreignKey: "MessageId",
  });
  Users.hasMany(MessageReadReceipt, {
    as: "MessageReadReceipts",
    foreignKey: "UserId",
  });
  MessageReadReceipt.belongsTo(Users, {
    as: "User",
    foreignKey: "UserId",
  });

  return {
    Message,
    Users,
    Conversation,
    ConversationParticipant,
    RefreshToken,
    AuditLog,
    MessageReadReceipt,
    OutboxEvent,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
