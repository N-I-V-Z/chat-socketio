const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('Message', {
    MessageId: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    SenderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'userId'
      }
    },
    ReceiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'userId'
      }
    },
    MessageText: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    Timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('getdate')
    }
  }, {
    sequelize,
    tableName: 'Message',
    schema: 'dbo',
    timestamps: false,
    indexes: [
      {
        name: "PK__Message__C87C0C9CE1B8AE90",
        unique: true,
        fields: [
          { name: "MessageId" },
        ]
      },
    ]
  });
};
