module.exports = {
  env: 'development',
  dbServer: 'http://localhost',
  db: 'chronicle',
  dbPort: process.env.PORT || 5984,
  auth: 'none',
  logger: true,
  DIMSETempDir: './data',
  DIMSEAET: 'PACS',
  DIMSEPort: 4002,
  maxConcurrent: 5,
  maxQueue: Infinity,
};
