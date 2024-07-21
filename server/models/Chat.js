const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Chat', {
    chatRoom: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    tableName: 'Chat',
    schema: 'dbo',
    timestamps: false,
    indexes: [
      {
        name: "PK__Chat__F7BAC996F5A8DA9E",
        unique: true,
        fields: [
          { name: "chatRoom" },
        ]
      },
    ]
  });
};
