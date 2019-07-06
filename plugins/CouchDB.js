/* eslint-disable no-underscore-dangle */
const fp = require('fastify-plugin');
const _ = require('underscore');
const toArrayBuffer = require('to-array-buffer');
// eslint-disable-next-line no-global-assign
window = {};
const dcmjs = require('dcmjs');
const config = require('../config/index');
const viewsjs = require('../config/views');

async function couchdb(fastify, options) {
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

      const bodySeriesInfo = new Promise((resolve, reject) => {
        dicomDB.view(
          'instances',
          'qido_study_series',
          {
            reduce: true,
            group_level: 2,
          },
          (error, body) => {
            if (!error) {
              const seriesCounts = {};
              const seriesModalities = {};
              body.rows.forEach(study => {
                if (!(study.key[0] in seriesCounts)) seriesCounts[study.key[0]] = 0;
                seriesCounts[study.key[0]] += study.value;
                if (!(study.key[0] in seriesModalities)) seriesModalities[study.key[0]] = [];
                seriesModalities[study.key[0]].push(study.key[1]);
              });
              resolve({ count: seriesCounts, modalities: seriesModalities });
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

      Promise.all([bodySeriesInfo, bodyStudies])
        .then(values => {
          const res = [];
          // couch returns ordered list, merge if the study occurs multiple times consequently (due to seres listing different tags)
          for (let i = 0; i < values[1].rows.length; i += 1) {
            const study = values[1].rows[i];
            const studySeriesObj = study.key[1];
            // add numberOfStudyRelatedInstances
            studySeriesObj['00201208'].Value = [];
            studySeriesObj['00201208'].Value.push(study.value);
            // add numberOfStudyRelatedSeries
            studySeriesObj['00201206'].Value = [];
            studySeriesObj['00201206'].Value.push(values[0].count[study.key[0]]);
            // add modalities
            studySeriesObj['00080061'].Value = values[0].modalities[study.key[0]];

            // see if there are consequent records with the same studyuid
            const currentStudyUID = study.key[0];
            for (let j = i + 1; j < values[1].rows.length; j += 1) {
              const consequentStudyUID = values[1].rows[j].key[0];
              if (currentStudyUID === consequentStudyUID) {
                // same study merge
                const consequentStudySeriesObj = values[1].rows[j].key[1];
                Object.keys(consequentStudySeriesObj).forEach(tag => {
                  if (studySeriesObj[tag] !== consequentStudySeriesObj[tag]) {
                    if (consequentStudySeriesObj[tag].Value)
                      consequentStudySeriesObj[tag].Value.forEach(val => {
                        if (!studySeriesObj[tag].Value) studySeriesObj[tag].Value = [];
                        if (!_.findIndex(studySeriesObj[tag].Value, val) === -1)
                          studySeriesObj[tag].Value.push(val);
                      });
                  }
                });
                // skip the consequent study entries
                i = j;
              }
            }
            res.push(studySeriesObj);
          }
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
          endkey: [`${request.params.study}`, `${request.params.series}\u9999`, '{}'],
          reduce: true,
          group: true,
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
      const instance = request.params.instance || request.query.objectUID; // for instance rs and uri
      reply.header('Content-Disposition', `attachment; filename=${instance}.dcm`);
      reply.code(200).send(dicomDB.attachment.getAsStream(instance, 'object.dcm'));
    } catch (err) {
      reply.code(404).send(err);
    }
  });

  fastify.decorate('retrieveInstanceFrames', (request, reply) => {
    // TODO:  this is just a non-working stuff for wado-rs frame retrieve
    //
    // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_8.6.html#sect_8.6.1.2
    //
    // Issues:
    // - Need to accept frames as a comma separated list of frame numbers (starting at 1)
    //   -- most likely/common use case will be a single number 1.  This is what OHIF requests.
    //   -- this means just skipping past the dicom header and returning just the PixelData.
    // - in general, need to skip to the correct frame location for each requested frame
    //   -- need to figure offsets out from the instance metadata (maybe precalculate?)
    //   -- need to do a range request to get the part of the attachment corresponding to the frame
    //        Couchdb attachments can be accessed via ranges:
    //          http://docs.couchdb.org/en/stable/api/document/attachments.html#api-doc-attachment-range
    //        Not clear how to do this via nano.
    //        Issue filed here: https://github.com/apache/couchdb-nano/issues/166
    // - need to add the multipart header and content separators
    try {
      // const dicomDB = fastify.couch.db.use(config.db);
      reply.code(404).send('Not supported');
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
          endkey: [`${request.params.study}`, `${request.params.series}\u9999`, {}],
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
    try {
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
        promises.push(
          new Promise((resolve, reject) =>
            dicomDB.get(couchDoc._id, (error, existing) => {
              if (!error) {
                couchDoc._rev = existing._rev;
                fastify.log.info(`Updating document for dicom ${couchDoc._id}`);
              }

              dicomDB.multipart
                .insert(couchDoc, [dicomAttach], couchDoc._id)
                .then(() => {
                  resolve('Saving successful');
                })
                .catch(err => {
                  // TODO Proper error reporting implementation required
                  reject(err);
                });
            })
          )
        );
        // promises.push(dicomDB.multipart.insert(couchDoc, [dicomAttach], couchDoc._id));
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
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      fastify.log.info(`Error in STOW: ${e}`);
      reply.code(503).send('error');
    }
  });

  fastify.decorate('deleteStudy', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'qido_instances',
        {
          startkey: [request.params.study, '', ''],
          endkey: [`${request.params.study}\u9999`, '{}', '{}'],
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            let count = 0;
            const deletePromises = [];
            body.rows.forEach(instance => {
              deletePromises.push(
                new Promise((resolve, reject) => {
                  dicomDB.get(instance.key[2], (getError, existing) => {
                    if (!getError) {
                      dicomDB.destroy(instance.key[2], existing._rev, deleteError => {
                        if (deleteError) {
                          fastify.log.info(`Error deleting document for dicom ${instance.key[2]}`);
                          reject(deleteError);
                        } else {
                          fastify.log.info(`Deleted document for dicom ${instance.key[2]}`);
                          count += 1;
                          resolve();
                        }
                      });
                    }
                  });
                })
              );
            });
            Promise.all(deletePromises)
              .then(() => {
                fastify.log.info(`Deleted ${count} of ${body.rows.length}`);
                if (count === body.rows.length) reply.code(200).send('Deleted successfully');
                else
                  reply
                    .code(503)
                    .send(`Counts don't match. Deleted ${count} of ${body.rows.length}`);
              })
              .catch(err => {
                // TODO send correct error codes
                // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
                reply.code(503).send(err);
              });
          } else {
            fastify.log.info(error);
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.code(503).send(error);
          }
        }
      );
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      fastify.log.info(`Error in Delete: ${e}`);
      reply.code(503).send('error');
    }
  });

  fastify.decorate('deleteSeries', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'qido_instances',
        {
          startkey: [request.params.study, request.params.series, ''],
          endkey: [`${request.params.study}`, `${request.params.series}\u9999`, '{}'],
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            let count = 0;
            const deletePromises = [];
            body.rows.forEach(instance => {
              deletePromises.push(
                new Promise((resolve, reject) => {
                  dicomDB.get(instance.key[2], (getError, existing) => {
                    if (!getError) {
                      dicomDB.destroy(instance.key[2], existing._rev, deleteError => {
                        if (deleteError) {
                          fastify.log.info(`Error deleting document for dicom ${instance.key[2]}`);
                          reject(deleteError);
                        } else {
                          fastify.log.info(`Deleted document for dicom ${instance.key[2]}`);
                          count += 1;
                          resolve();
                        }
                      });
                    }
                  });
                })
              );
            });
            Promise.all(deletePromises)
              .then(() => {
                fastify.log.info(`Deleted ${count} of ${body.rows.length}`);
                if (count === body.rows.length) reply.code(200).send('Deleted successfully');
                else
                  reply
                    .code(503)
                    .send(`Counts don't match. Deleted ${count} of ${body.rows.length}`);
              })
              .catch(err => {
                // TODO send correct error codes
                // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
                reply.code(503).send(err);
              });
          } else {
            fastify.log.info(error);
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.code(503).send(error);
          }
        }
      );
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      fastify.log.info(`Error in Delete: ${e}`);
      reply.code(503).send('error');
    }
  });

  fastify.log.info(`Using db: ${config.db}`);
  // register couchdb
  // disables eslint check as I want this module to be standalone to be (un)pluggable
  // eslint-disable-next-line global-require
  fastify.register(require('fastify-couchdb'), {
    // eslint-disable-line global-require
    url: options.url,
  });
  fastify.after(async () => {
    try {
      await fastify.checkAndCreateDb();
    } catch (err) {
      fastify.log.info(`Cannot connect to couchdb (err:${err}), shutting down the server`);
      fastify.close();
    }
    // need to add hook for close to remove the db if test;
    fastify.addHook('onClose', async (instance, done) => {
      if (config.env === 'test') {
        try {
          // if it is test remove the database
          await instance.couch.db.destroy(config.db);
          fastify.log.info('Destroying test database');
        } catch (err) {
          fastify.log.info(`Cannot destroy test database (err:${err})`);
        }
        done();
      }
    });
  });
}
// expose as plugin so the module using it can access the decorated methods
module.exports = fp(couchdb);
