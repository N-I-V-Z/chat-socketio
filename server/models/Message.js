const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Message', {
    messageId: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    time: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('getdate')
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'userId'
      }
    },
    chatRoom: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Chat',
        key: 'chatRoom'
      }
    }
  }, {
    sequelize,
    tableName: 'Message',
    schema: 'dbo',
    timestamps: false,
    indexes: [
      {
        name: "PK__Message__4808B99318447EAA",
        unique: true,
        fields: [
          { name: "messageId" },
        ]
      },
    ]
  });
};
