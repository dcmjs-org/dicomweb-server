module.exports = {
  env: 'test',
  dbServer: 'http://localhost',
  db: 'testdb_dicomweb',
  dbPort: process.env.PORT || 5984,
  auth: 'none',
  logger: false,
  DIMSETempDir: './data',
  DIMSEAET: 'PACS',
  DIMSEPort: 4002,
  maxConcurrent: 5,
  maxQueue: Infinity,
};
