// models/index.js
const Sequelize = require('sequelize');
const config = require('../config/config')[process.env.NODE_ENV || 'development'];
const initModels = require('./init-models');

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config
);

const models = initModels(sequelize);

module.exports = {
  ...models,
  sequelize,
  Sequelize
};
