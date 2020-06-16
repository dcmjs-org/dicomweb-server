module.exports = {
    env: process.env.NODE_ENV,
    dbServer: process.env.USE_POUCHDB === 'true' ? 'http://0.0.0.0' : 'http://couchdb',
    db: 'chronicle',
    dbPort: process.env.PORT || 5984,
    auth: 'none',
    logger: true,
  };
