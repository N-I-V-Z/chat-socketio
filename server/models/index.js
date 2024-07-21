// models/index.js
const Sequelize = require('sequelize');
const config = require('../config/config.json'); // Đường dẫn đến file config của bạn
const initModels = require('./init-models'); // Đường dẫn đến file init-models của bạn

const sequelize = new Sequelize(config.development.database, config.development.username, config.development.password, {
  host: config.development.host,
  dialect: config.development.dialect
});

const models = initModels(sequelize);

module.exports = {
  ...models,
  sequelize,
  Sequelize
};
