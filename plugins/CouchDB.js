/* eslint-disable no-underscore-dangle */
const fp = require('fastify-plugin');
const toArrayBuffer = require('to-array-buffer');
const config = require('../config/index');

// eslint-disable-next-line no-global-assign
window = {};
const dcmjs = require('../../dcmjs/build/dcmjs');

const viewsjs = require('../config/views');

async function couchdb(fastify, options, next) {
  // Update the views in couchdb with the ones defined in the code
  fastify.decorate(
    'checkAndCreateDb',
    () =>
      new Promise(async (resolve, reject) => {
        try {
          const databases = await fastify.couch.db.list();
          // check if the db exists
          if (databases.indexOf(config.db) < 0) {
            await fastify.couch.db.create(config.db);
          }
          const dicomDB = fastify.couch.db.use(config.db);
          // define an empty design document
          let viewDoc = {};
          viewDoc.views = {};
          // try and get the design document
          try {
            viewDoc = await dicomDB.get('_design/instances');
          } catch (e) {
            fastify.log.info('View document not found! Creating new one');
          }
          const keys = Object.keys(viewsjs.views);
          const values = Object.values(viewsjs.views);
          // update the views
          for (let i = 0; i < keys.length; i += 1) {
            viewDoc.views[keys[i]] = values[i];
          }
          // insert the updated/created design document
          await dicomDB.insert(viewDoc, '_design/instances', insertErr => {
            if (insertErr) {
              fastify.log.info(`Error updating the design document ${insertErr.message}`);
              reject(insertErr);
            } else {
              fastify.log.info('Design document updated successfully ');
              resolve();
            }
          });
        } catch (err) {
          fastify.log.info(`Error connecting to couchdb: ${err.message}`);
          reject(err);
        }
      })
  );

  // add accessor methods with decorate
  fastify.decorate('getQIDOStudies', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);

      const bodySeriesCounts = new Promise((resolve, reject) => {
        dicomDB.view(
          'instances',
          'qido_study_series',
          {
            reduce: true,
            group_level: 1,
          },
          (error, body) => {
            if (!error) {
              const seriesCounts = {};
              body.rows.forEach(study => {
                seriesCounts[study.key[0]] = study.value;
              });
              resolve(seriesCounts);
            } else {
              reject(error);
            }
          }
        );
      });

      const bodyStudies = new Promise((resolve, reject) => {
        dicomDB.view(
          'instances',
          'qido_study',
          {
            reduce: true,
            group_level: 2,
          },
          (error, body) => {
            if (!error) {
              resolve(body);
            } else {
              reject(error);
            }
          }
        );
      });

      Promise.all([bodySeriesCounts, bodyStudies])
        .then(values => {
          const res = [];
          values[1].rows.forEach(study => {
            const studySeriesObj = study.key[1];
            studySeriesObj['00201208'].Value = [];
            studySeriesObj['00201208'].Value.push(study.value);
            studySeriesObj['00201206'].Value = [];
            studySeriesObj['00201206'].Value.push(values[0][study.key[0]]);
            res.push(studySeriesObj);
          });
          reply.code(200).send(res);
        })
        .catch(err => {
          // TODO send correct error codes
          // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
          reply.code(503).send(err);
        });
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('getQIDOSeries', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'qido_series',
        {
          startkey: [request.params.study, ''],
          endkey: [`${request.params.study}\u9999`, '{}'],
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(series => {
              // get the actual instance object (tags only)
              const seriesObj = series.key[2];
              seriesObj['00201209'].Value = [];
              seriesObj['00201209'].Value.push(series.value);
              res.push(seriesObj);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.code(503).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('getQIDOInstances', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'qido_instances',
        {
          startkey: [request.params.study, request.params.series, ''],
          endkey: [`${request.params.study}\u9999`, `${request.params.series}\u9999`, '{}'],
          reduce: true,
          group_level: 4,
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(instance => {
              // get the actual instance object (tags only)
              res.push(instance.key[3]);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.code(503).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('retrieveInstance', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);
      reply.code(200).send(dicomDB.attachment.getAsStream(request.params.instance, 'object.dcm'));
    } catch (err) {
      reply.code(404).send(err);
    }
  });

  fastify.decorate('getStudyMetadata', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'wado_metadata',
        {
          startkey: [request.params.study, '', ''],
          endkey: [`${request.params.study}\u9999`, {}, {}],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(instance => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            reply.code(404).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(404).send(err);
    }
  });

  fastify.decorate('getSeriesMetadata', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'wado_metadata',
        {
          startkey: [request.params.study, request.params.series, ''],
          endkey: [`${request.params.study}\u9999`, `${request.params.series}\u9999`, {}],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(instance => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            reply.code(404).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(404).send(err);
    }
  });

  fastify.decorate('getInstanceMetadata', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'wado_metadata',
        {
          key: [request.params.study, request.params.series, request.params.instance],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(instance => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            reply.code(404).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(404).send(err);
    }
  });

  fastify.decorate('getPatients', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'patients',
        {
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(patient => {
              res.push(patient.key);
            });
            reply.code(200).send(res);
          } else {
            fastify.log.info(error);
            reply.code(503).send(error);
          }
        }
      );
    } catch (err) {
      reply.code(503).send(err);
    }
  });

  fastify.decorate('stow', (request, reply) => {
    const res = toArrayBuffer(request.body);
    const parts = dcmjs.utilities.message.multipartDecode(res);
    const promises = [];
    for (let i = 0; i < parts.length; i += 1) {
      const arrayBuffer = parts[i];
      const dicomAttach = {
        name: 'object.dcm',
        data: arrayBuffer,
        content_type: '',
      };

      const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer, {});
      const couchDoc = {
        _id: dicomData.dict['00080018'].Value[0],
        dataset: dicomData.dict,
      };
      const dicomDB = fastify.couch.db.use(config.db);
      promises.push(dicomDB.multipart.insert(couchDoc, [dicomAttach], couchDoc._id));
    }
    Promise.all(promises)
      .then(() => {
        reply.code(200).send('success');
      })
      .catch(err => {
        // TODO Proper error reporting implementation required
        // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
        fastify.log.info(`Error in STOW: ${err}`);
        reply.code(503).send('error');
      });
  });

  fastify.log.info(`Using db: ${config.db}`);
  // register couchdb
  // disables eslint check as I want this module to be standalone to be (un)pluggable
  // eslint-disable-next-line global-require
  fastify.register(require('fastify-couchdb'), {
    // eslint-disable-line global-require
    url: options.url,
  });
  fastify.after(() => {
    // need to add hook for close to remove the db if test;
    fastify.addHook('onClose', (instance, done) => {
      if (config.env === 'test') {
        // if it is test remove the database
        instance.couch.db.destroy(config.db);
        fastify.log.info('Destroying test database');
        done();
      }
    });
    fastify
      .checkAndCreateDb()
      .then(() => {
        next();
      })
      .catch(err => {
        fastify.log.info(`Cannot connect to couchdb (err:${err}), shutting down the server`);
        fastify.close();
      });
  });
}
// expose as plugin so the module using it can access the decorated methods
module.exports = fp(couchdb);
