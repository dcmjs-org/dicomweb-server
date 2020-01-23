module.exports = {
  env: 'test',
  dbServer: 'http://localhost',
  db: 'testdb_dicomweb',
  dbPort: process.env.PORT || 5984,
  auth: 'none',
  DIMSE: {
    tempDir: './data',
    AET: 'PACS',
    port: 4002,
  },
  maxConcurrent: 5,
  logger: {
    level: 'warn',
  },
};
