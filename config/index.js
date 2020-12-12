const env = process.env.NODE_ENV || 'development';
const config = require(`./${env}`); // eslint-disable-line
config.authConfig = {};
if (config.auth && config.auth != 'none') config.authConfig = require(`./${config.auth}.json`); // eslint-disable-line
config.maxConcurrent = config.maxConcurrent || 5;
config.prefix = config.prefix || '';
config.dbUrlWithAuth =
  config.dbUser && config.dbPassword
    ? `${config.dbServer.replace('http://', `http://${config.dbUser}:${config.dbPassword}@`)}:${
        config.dbPort
      }`
    : `${config.dbServer}:${config.dbPort}`;
module.exports = config;
