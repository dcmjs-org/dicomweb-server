const fp = require('fastify-plugin');

const split2 = require('split2');
const path = require('path');
const fs = require('fs');
const dcmtk = require('../../dcmtk-node')({
  verbose: false,
});

async function dimse(fastify, options) {
  let storeServer;
  fastify.decorate('initDIMSE', async () => {
    try {
      if (options.aet === undefined || options.port === undefined)
        throw new Error('Missing AETitle or Port');
      if (options.tempDir === undefined) {
        fastify.log.warn('No tempdirname in options, creating dir named tempDataDir');
        fs.mkdirSync(path.join(__dirname, 'tempDataDir'));
      }

      if (!fs.existsSync(path.join(__dirname, options.tempDir))) {
        // create directory, no need to fail
        fs.mkdirSync(path.join(__dirname, options.tempDir));
      }

      storeServer = dcmtk.storescp({
        args: [
          '-od',
          options.tempDir,
          '-aet',
          options.aet,
          '--fork',
          options.port,
          '--exec-sync',
          '--exec-on-reception',
          'echo "file:#f"',
        ],
      });
      storeServer.on('error', err => {
        fastify.log.error(`Error on storescp server: ${err.message}`);
      });
      storeServer.on('close', (code, signal) => {
        fastify.log.warn(`Closed storescp server with code ${code} and signal ${signal}`);
      });
      storeServer.stdout.pipe(split2()).on('data', data => {
        if (data.startsWith('file:')) {
          const filePath = path.join(__dirname, `../${options.tempDir}/${data.replace('file:', '')}`);
          fastify.dbPqueue
            .add(() => {
              fastify.updateViews();
              fastify.log.info(`Saving DIMSE file ${filePath}`);
              return fastify.saveFile(filePath);
            })
            .then(() => {
              fastify.log.info(`Deleting DIMSE temp file ${filePath}`);
              fs.unlinkSync(filePath);
            });
        }
      });
      fastify.log.info(`DIMSE protocol started listening on port ${options.port}`);
    } catch (err) {
      fastify.log.warn(`DIMSE protocol starting error: ${err.message}`);
    }
  });

  fastify.after(async () => {
    try {
      await fastify.initDIMSE();
    } catch (err) {
      fastify.log.error(`Cannot init DIMSE (err:${err.message}), shutting down the server`);
      fastify.close();
    }
    // need to add hook for close to remove the db if test;
    fastify.addHook('onClose', async (instance, done) => {
      storeServer.kill();
      done();
    });
  });
}
// expose as plugin so the module using it can access the decorated methods
module.exports = fp(dimse);
