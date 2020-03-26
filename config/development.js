module.exports = {
  env: 'development',
  dbServer: process.env.DB_SERVER || 'http://localhost',
  db: process.env.DB_NAME || 'chronicle',
  dbPort: process.env.DB_PORT || 5984,
  prefix: process.env.PREFIX || '',
  auth: process.env.AUTH || 'none',
  logger: process.env.LOGGER || true,
  DIMSE: {
    tempDir: process.env.TEMPDIR || './data',
    AET: process.env.AET || 'PACS',
    port: process.env.DIMSE_PORT || 4002,
  },
  maxConcurrent: process.env.MAXCONCURRENT || 5,
};
