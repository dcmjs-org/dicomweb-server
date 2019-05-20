module.exports = {
  env: 'development',
  dbServer: 'http://localhost',
  db: 'chronicle',
  dbPort: process.env.PORT || 5984,
  auth: 'none',
  logger: true,
};
