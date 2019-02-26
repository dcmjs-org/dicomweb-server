const fp = require('fastify-plugin');

// const toArrayBuffer = require('to-array-buffer');
// const dicomwebClient = require('dicomweb-client');
// window = {};
// const dcmjs = require('dcmjs');

const viewsjs = require('../config/views');

async function couchdb(fastify, options, next) {
  // register couchdb
  // disables eslint check as I want this module to be standalone to be (un)pluggable
  fastify.register(require('fastify-couchdb'), { // eslint-disable-line global-require
    url: options.url,
  });

  // Update the views in couchdb with the ones defined in the code
  fastify.decorate('checkCouchDBViews', async () => {
    const dicomDB = fastify.couch.db.use('chronicle');
    dicomDB.get('_design/instances', (e, b) => { // create view
      const viewDoc = b;
      if (e) {
        fastify.log.info(`Error getting the design document ${e.message}`);
        return;
      }
      const keys = Object.keys(viewsjs.views);
      const values = Object.values(viewsjs.views);
      for (let i = 0; i < keys.length; i += 1) {
        viewDoc.views[keys[i]] = values[i];
      }
      dicomDB.insert(viewDoc, '_design/instances', (insertErr) => {
        if (insertErr) { fastify.log.info(`Error updating the design document ${e.message}`); } else fastify.log.info('Design document updated successfully ');
      });
    });
  });


  // add accessor methods with decorate
  fastify.decorate('getQIDOStudies', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');

      const bodySeriesCounts = new Promise((resolve, reject) => {
        dicomDB.view('instances', 'qido_study_series',
          {
            reduce: true,
            group_level: 1,
          },
          (error, body) => {
            if (!error) {
              const seriesCounts = {};
              body.rows.forEach((study) => {
                seriesCounts[study.key[0]] = study.value;
              });
              resolve(seriesCounts);
            } else {
              reject(error);
            }
          });
      });

      const bodyStudies = new Promise((resolve, reject) => {
        dicomDB.view('instances', 'qido_study',
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
          });
      });

      Promise.all([bodySeriesCounts, bodyStudies]).then((values) => {
        const res = [];
        values[1].rows.forEach((study) => {
          const studySeriesObj = study.key[1];
          studySeriesObj['00201208'].Value = [];
          studySeriesObj['00201208'].Value.push(study.value);
          studySeriesObj['00201206'].Value = [];
          studySeriesObj['00201206'].Value.push(values[0][study.key[0]]);
          res.push(studySeriesObj);
        });
        reply.send(JSON.stringify(res));
      }).catch((err) => {
        reply.send(err);
      });
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('getQIDOSeries', async (request, reply) => {
    try {
      fastify.log.info(request.params.study);

      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'qido_series',
        {
          startkey: [request.params.study, ''],
          endkey: [`${request.params.study}\u9999`, '{}'],
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            fastify.log.info(body);

            const res = [];
            body.rows.forEach((series) => {
              // get the actual instance object (tags only)
              const seriesObj = series.key[2];
              seriesObj['00201209'].Value = [];
              seriesObj['00201209'].Value.push(series.value);
              res.push(seriesObj);
            });
            reply.send(JSON.stringify(res));
          } else {
            fastify.log.info(error);
          }
        });
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('getQIDOInstances', async (request, reply) => {
    try {
      fastify.log.info(request.params.study);

      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'qido_instances',
        {
          startkey: [request.params.study, request.params.series, ''],
          endkey: [`${request.params.study}\u9999`, `${request.params.series}\u9999`, '{}'],
          reduce: true,
          group_level: 4,
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach((instance) => {
              // get the actual instance object (tags only)
              res.push(instance.key[3]);
            });
            reply.send(JSON.stringify(res));
          } else {
            fastify.log.info(error);
          }
        });
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('retrieveInstance', async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);
      reply.send(dicomDB.attachment.getAsStream(request.params.instance, 'object.dcm'));
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('getStudyMetadata', async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'wado_metadata',
        {
          startkey: [request.params.study, '', ''],
          endkey: [`${request.params.study}\u9999`, {}, {}],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach((instance) => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.send(JSON.stringify(res));
          } else {
            fastify.log.info(error);
          }
        });
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('getSeriesMetadata', async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'wado_metadata',
        {
          startkey: [request.params.study, request.params.series, ''],
          endkey: [`${request.params.study}\u9999`, `${request.params.series}\u9999`, {}],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach((instance) => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.send(JSON.stringify(res));
          } else {
            fastify.log.info(error);
          }
        });
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('getInstanceMetadata', async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'wado_metadata',
        {
          key: [request.params.study, request.params.series, request.params.instance],
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach((instance) => {
              // get the actual instance object (tags only)
              res.push(instance.value);
            });
            reply.send(JSON.stringify(res));
          } else {
            fastify.log.info(error);
          }
        });
    } catch (err) {
      reply.send(err);
    }
  });


  fastify.decorate('getPatients', async (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use('chronicle');
      await dicomDB.view('instances', 'patients',
        {
          reduce: true,
          group_level: 3,
        },
        (error, body) => {
          if (!error) {
            fastify.log.info(body);

            const res = [];
            body.rows.forEach((patient) => {
              res.push(patient.key);
            });
            reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send(res);
          } else {
            fastify.log.info(error);
            reply.code(500).send(error);
          }
        });
    } catch (err) {
      reply.code(500).send(err);
    }
  });

  // fastify.decorate('stow', async (request, reply) => {
  //   // dicomwc=new dicomweb_client.api.DICOMwebClient({"url" : "noURL"});
  //   const res = fastify.dicomweb_client.message.multipartDecode(request.body);
  //   const ab = toArrayBuffer(res);
  //   const dicomAttach = {
  //     name: 'object.dcm',
  //     data: ab,
  //     content_type: '',
  //   };

  //   const dictDataset = DICOMZero.dictAndDatasetFromArrayBuffer(ab);
  //   // console.log(dataset)
  //   const couchDoc = {
  //     _id: dictDataset.dataset.SOPInstanceUID,
  //     dataset: dictDataset.dict,
  //   };
  //   const dicomDB = fastify.couch.db.use('chronicle');
  //   dicomDB.multipart.insert(couchDoc, [dicomAttach], couchDoc._id, (err, body) => {
  //     console.log(err);
  //     if (!err) console.log(body);
  //   });
  //   reply.send('success');
  // });

  next();
}
// expose as plugin so the module using it can access the decorated methods
module.exports = fp(couchdb);
