module.exports = {
  env: 'development',
  dbServer: 'http://localhost',
  db: 'chronicle',
  dbPort: process.env.PORT || 5984,
  auth: 'none',
  logger: true,
  DIMSE: {
    tempDir: './data',
    AET: 'PACS',
    port: 4002,
  },
  maxConcurrent: 5,
};
