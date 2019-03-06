const env = process.env.NODE_ENV || 'development';
const config = require(`./${env}`); // eslint-disable-line

module.exports = config;
