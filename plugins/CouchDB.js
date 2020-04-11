/* eslint-disable no-underscore-dangle, no-async-promise-executor */
const fp = require('fastify-plugin');
const _ = require('underscore');
const toArrayBuffer = require('to-array-buffer');
// eslint-disable-next-line no-global-assign
window = {};
const dcmjs = require('dcmjs');
const Axios = require('axios');
const http = require('http');
const fs = require('fs');

const config = require('../config/index');
const viewsjs = require('../config/views');
const { InternalError, ResourceNotFoundError } = require('../utils/Errors');

async function couchdb(fastify, options) {
  fastify.decorate('init', async () => {
    try {
      await fastify.couch.db.list();
      fastify.log.info('Connected to couchdb server');
      return fastify.checkAndCreateDb();
    } catch (err) {
      fastify.log.info('Waiting for couchdb server');
      setTimeout(fastify.init, 3000);
    }
    return null;
  });

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
          fastify.log.error(`Error connecting to couchdb: ${err.message}`);
          reject(err);
        }
      })
  );

  fastify.decorate('queryStudy', (query, obj) => {
    const keys = {
      StudyDate: '00080020',
      StudyTime: '00080030',
      AccessionNumber: '00080050',
      // ModalitiesInStudy: '00080061', // not here
      ReferringPhysicianName: '00080090',
      PatientName: '00100010',
      PatientID: '00100020',
      StudyInstanceUID: '0020000D',
      StudyID: '00200010',
    };
    const keysInQuery = Object.keys(query);
    for (let i = 0; i < keysInQuery.length; i += 1) {
      if (
        keys[keysInQuery[i]] &&
        !(
          obj.key[1][keys[keysInQuery[i]]] &&
          obj.key[1][keys[keysInQuery[i]]].Value &&
          obj.key[1][keys[keysInQuery[i]]].Value[0] &&
          ((obj.key[1][keys[keysInQuery[i]]].Value[0].Alphabetic &&
            obj.key[1][keys[keysInQuery[i]]].Value[0].Alphabetic === query[keysInQuery[i]]) ||
            obj.key[1][keys[keysInQuery[i]]].Value[0] === query[keysInQuery[i]])
        )
      ) {
        return false;
      }
    }
    return true;
  });

  // needs to support query with following keys
  // StudyDate 00080020
  // StudyTime 00080030
  // AccessionNumber 00080050
  // ModalitiesInStudy 00080061
  // ReferringPhysicianName 00080090
  // PatientName 00100010
  // PatientID 00100020
  // StudyInstanceUID 0020000D
  // StudyID 00200010
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
            group_level: 3,
          },
          (error, body) => {
            if (!error) {
              const seriesCounts = {};
              const seriesModalities = {};
              body.rows.forEach(study => {
                if (!(study.key[0] in seriesCounts)) {
                  seriesCounts[study.key[0]] = 0;
                }

                seriesCounts[study.key[0]] += 1;

                if (!(study.key[0] in seriesModalities)) {
                  seriesModalities[study.key[0]] = [];
                }
                // we should make sure each modality is referenced once
                if (!seriesModalities[study.key[0]].includes(study.key[1]))
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
          const studies = {};
          studies.rows = _.filter(values[1].rows, obj => fastify.queryStudy(request.query, obj));
          const res = [];
          // couch returns ordered list, merge if the study occurs multiple times consequently (due to seres listing different tags)
          for (let i = 0; i < studies.rows.length; i += 1) {
            const study = studies.rows[i];
            const studySeriesObj = study.key[1];

            // add numberOfStudyRelatedInstances
            studySeriesObj['00201208'].Value = [];
            studySeriesObj['00201208'].Value.push(study.value);
            // add numberOfStudyRelatedSeries
            studySeriesObj['00201206'].Value = [];
            studySeriesObj['00201206'].Value.push(values[0].count[study.key[0]]);

            // add modalities
            // TODO needs to be filtered by query
            // ModalitiesInStudy 00080061
            if (
              request.query.ModalitiesInStudy &&
              !values[0].modalities[study.key[0]].includes(request.query.ModalitiesInStudy)
            )
              // eslint-disable-next-line no-continue
              continue;
            studySeriesObj['00080061'].Value = values[0].modalities[study.key[0]];

            // see if there are consequent records with the same studyuid
            const currentStudyUID = study.key[0];
            for (let j = i + 1; j < studies.rows.length; j += 1) {
              const consequentStudyUID = studies.rows[j].key[0];
              if (currentStudyUID === consequentStudyUID) {
                // same study merge
                const consequentStudySeriesObj = studies.rows[j].key[1];
                Object.keys(consequentStudySeriesObj).forEach(tag => {
                  if (tag === '00201208') {
                    // numberOfStudyRelatedInstances needs to be cumulated
                    studySeriesObj['00201208'].Value[0] += studies.rows[j].value;
                  } else if (studySeriesObj[tag] !== consequentStudySeriesObj[tag]) {
                    if (consequentStudySeriesObj[tag].Value)
                      consequentStudySeriesObj[tag].Value.forEach(val => {
                        if (!studySeriesObj[tag].Value) studySeriesObj[tag].Value = [val];
                        else if (
                          // if both studies have values, cumulate them but don't make duplicates
                          (typeof studySeriesObj[tag].Value[0] === 'string' &&
                            !studySeriesObj[tag].Value.includes(val)) ||
                          !_.findIndex(studySeriesObj[tag].Value, val) === -1
                        ) {
                          studySeriesObj[tag].Value.push(val);
                        }
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
          reply.send(new InternalError('QIDO Studies retreival from couchdb', err));
        });
    } catch (err) {
      reply.send(new InternalError('QIDO Studies retreival', err));
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
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.send(new InternalError('QIDO series retreival from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('QIDO series retreival', err));
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
            // TODO send correct error codes
            // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.7.html#table_6.7-1
            reply.send(new InternalError('QIDO instances retreival from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('QIDO instances retreival', err));
    }
  });

  fastify.decorate('retrieveInstance', (request, reply) => {
    try {
      // if the query params have frame use retrieveInstanceFrames instead
      if (request.query.frame) fastify.retrieveInstanceFrames(request, reply);
      else {
        const dicomDB = fastify.couch.db.use(config.db);
        const instance = request.params.instance || request.query.objectUID; // for instance rs and uri
        reply.header('Content-Disposition', `attachment; filename=${instance}.dcm`);
        reply.code(200).send(dicomDB.attachment.getAsStream(instance, 'object.dcm'));
      }
    } catch (err) {
      reply.send(
        new ResourceNotFoundError(
          'Instance',
          request.params.instance || request.query.objectUID,
          err
        )
      );
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
      const instance = request.params.instance || request.query.objectUID;
      const framesParam = request.params.frames || request.query.frame;
      this.request = Axios.create({
        baseURL: `${config.dbServer}:${config.dbPort}/${config.db}`,
      });

      // make a head query to get the attachment size
      // TODO nano doesn't support db.attachment.head
      this.request
        .head(`/${instance}/object.dcm`)
        .then(head => {
          fastify.log.info(`Content length of the attachment is ${head.headers['content-length']}`);
          const attachmentSize = Number(head.headers['content-length']);

          // calculate offset using frame count * frame size (row*col*pixel byte*samples for pixel)
          const dicomDB = fastify.couch.db.use(config.db);
          dicomDB.get(instance, (err, doc) => {
            if (err) reply.send(new InternalError('Get instance for frame retrieval', err));
            else {
              try {
                // get tags of the instance
                const numOfFrames = doc.dataset['00280008'] ? doc.dataset['00280008'].Value[0] : 1;
                const numOfBits = doc.dataset['00280100'].Value[0];
                const rows = doc.dataset['00280010'].Value[0];
                const cols = doc.dataset['00280011'].Value[0];
                const samplesForPixel = doc.dataset['00280002'].Value[0];
                const frameSize = Math.ceil((rows * cols * numOfBits * samplesForPixel) / 8);
                // TODO Number should be removed after IS is corrected
                const headerSize = attachmentSize - frameSize * Number(numOfFrames);
                fastify.log.info(
                  `numOfFrames: ${numOfFrames}, numOfBits: ${numOfBits}, rows : ${rows}, cols: ${cols}, samplesForPixel: ${samplesForPixel}, frameSize: ${frameSize}, headerSize: ${headerSize}`
                );

                // get range from couch for each frame, just forward the url for now
                // TODO update nano
                const frames = [];
                const framePromisses = [];
                const frameNums = framesParam.split(',');
                fastify.log.info(`frameNums that are sent : ${frameNums}`);
                frameNums.forEach(frameNum => {
                  const frameNo = Number(frameNum);
                  const range = `bytes=${headerSize + frameSize * (frameNo - 1)}-${headerSize -
                    1 +
                    frameSize * frameNo}`;
                  fastify.log.info(
                    `headerSize: ${headerSize}, frameNo: ${frameNo}, range: ${range}`
                  );
                  framePromisses.push(
                    new Promise((resolve, reject) => {
                      const opt = {
                        hostname: config.dbServer.replace('http://', ''),
                        port: config.dbPort,
                        path: `/${config.db}/${instance}/object.dcm`,
                        method: 'GET',
                        headers: { Range: range },
                      };
                      const data = [];
                      // node request is failing range requests with a parser error after reading the full content
                      // curl and web browser xhr works (probably ignores the remaining) (couchdb has javascript tests for range query which are done with web browser xhr)
                      // tried xmlhttprequest npm package but it uses node's request on nodejs side
                      // also tried adding range query capability to nano, but it uses node's request package and throws the parser error
                      // this code retrieves the range request using http.request and ignores if it encounters an error although it has buffer data
                      // returns the retrieved buffer
                      const req = http.request(opt, res => {
                        try {
                          res.on('data', d => {
                            data.push(d);
                          });
                          res.on('end', () => {
                            const databuffer = Buffer.concat(data);
                            resolve(databuffer);
                          });
                        } catch (e) {
                          if (data.length === 0) reject(new Error('Empty buffer'));
                          else {
                            const databuffer = Buffer.concat(data);
                            fastify.log.info(
                              `Threw error in catch. Error: ${e.message}, sending buffer of size 
                               ${databuffer.length} anyway`
                            );
                            resolve(databuffer);
                          }
                        }
                      });

                      req.on('error', error => {
                        if (data.length === 0) reject(new Error('Empty buffer'));
                        else {
                          const databuffer = Buffer.concat(data);
                          fastify.log.info(
                            `Threw error ${error.message}, sending buffer of size 
                             ${databuffer.length} anyway`
                          );
                          resolve(databuffer);
                        }
                      });

                      req.end();
                    })
                  );
                });
                // pack the frames in a multipart and send
                Promise.all(framePromisses)
                  .then(frameResponses => {
                    frameResponses.forEach(response => frames.push(response));
                    const { data, boundary } = dcmjs.utilities.message.multipartEncode(
                      frames,
                      undefined,
                      'application/octet-stream'
                    );
                    try {
                      reply.headers({
                        'Content-Type': `multipart/related; application/octet-stream; boundary=${boundary}`,
                        maxContentLength: Buffer.byteLength(data) + 1,
                      });
                      reply.code(200).send(Buffer.from(data));
                    } catch (replyErr) {
                      reply.send(new InternalError('Packing frames', replyErr));
                    }
                  })
                  .catch(packErr => {
                    reply.send(new InternalError('Pack error', packErr));
                  });
              } catch (frameErr) {
                reply.send(new InternalError('Not able to get frame', frameErr));
              }
            }
          });
        })
        .catch(err => {
          reply.send(new InternalError(`Couldn't get content length for the attachment`, err));
        });
    } catch (err) {
      reply.send(
        new ResourceNotFoundError('Frame', request.params.frames || request.query.frame, err)
      );
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
            reply.send(new InternalError('Retrieve study metadata from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('Retrieve study metadata', err));
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
            reply.send(new InternalError('Retrieve series metadata from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('Retrieve study metadata', err));
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
            reply.send(new InternalError('Retrieve instance metadata from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('Retrieve instance metadata from couchdb', err));
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
            reply.send(new InternalError('Retrieve patients from couchdb', error));
          }
        }
      );
    } catch (err) {
      reply.send(new InternalError('Retrieve patients from couchdb', err));
    }
  });

  fastify.decorate('saveFile', filePath => {
    const arrayBuffer = fs.readFileSync(filePath).buffer;
    return fastify.saveBuffer(arrayBuffer);
  });

  fastify.decorate('saveBuffer', (arrayBuffer, dicomDB) => {
    // eslint-disable-next-line no-param-reassign
    if (dicomDB === undefined) dicomDB = fastify.couch.db.use(config.db);
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer, {});
    const couchDoc = {
      _id: dicomData.dict['00080018'].Value[0],
      dataset: dicomData.dict,
    };
    return new Promise((resolve, reject) =>
      dicomDB.get(couchDoc._id, (error, existing) => {
        if (!error) {
          couchDoc._rev = existing._rev;
          fastify.log.info(`Updating document for dicom ${couchDoc._id}`);
        }

        dicomDB.insert(couchDoc, (err, data) => {
          if (err) {
            reject(err);
          }
          // TODO: Check if this needs to be Buffer or not.
          const body = Buffer.from(arrayBuffer);

          dicomDB.attachment.insert(
            couchDoc._id,
            'object.dcm',
            body,
            'application/dicom',
            { rev: data.rev },
            attachmentErr => {
              if (attachmentErr) {
                reject(attachmentErr);
              }

              resolve('Saving successful');
            }
          );
        });
      })
    );
  });
  fastify.decorate('stow', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      const res = toArrayBuffer(request.body);
      const parts = dcmjs.utilities.message.multipartDecode(res);
      const promises = [];
      for (let i = 0; i < parts.length; i += 1) {
        const arrayBuffer = parts[i];
        promises.push(() => {
          return fastify.saveBuffer(arrayBuffer, dicomDB);
        });
      }
      fastify.dbPqueue
        .addAll(promises)
        .then(() => {
          fastify.log.info(`Stow is done successfully`);
          reply.code(200).send('success');
        })
        .catch(err => {
          // TODO Proper error reporting implementation required
          // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
          fastify.log.error(`Error in STOW: ${err}`);
          reply.send(new InternalError('STOW save', err));
        });
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      reply.send(new InternalError('STOW', e));
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
          reduce: false,
          include_docs: true,
        },
        async (error, body) => {
          if (!error) {
            const docs = _.map(body.rows, instance => {
              return { _id: instance.key[2], _rev: instance.doc._rev, _deleted: true };
            });
            await fastify.dbPqueue.add(() => {
              return new Promise((resolve, reject) => {
                dicomDB
                  .bulk({ docs })
                  .then(() => {
                    resolve();
                  })
                  .catch(deleteError => {
                    fastify.log.info(
                      `Error deleting study ${request.params.study} with ${docs.length} dicoms`
                    );
                    reject(deleteError);
                  });
              });
            });
            fastify.log.info(`Deleted study ${request.params.study} with ${docs.length} dicoms`);
            reply.code(200).send('Deleted successfully');
          }
        }
      );
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      reply.send(new InternalError('Delete study', e));
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
          reduce: false,
          include_docs: true,
        },
        async (error, body) => {
          if (!error) {
            const docs = _.map(body.rows, instance => {
              return { _id: instance.key[2], _rev: instance.doc._rev, _deleted: true };
            });
            await fastify.dbPqueue.add(() => {
              return new Promise((resolve, reject) => {
                dicomDB
                  .bulk({ docs })
                  .then(() => {
                    resolve();
                  })
                  .catch(deleteError => {
                    fastify.log.info(
                      `Error deleting series ${request.params.series} with ${docs.length} dicoms`
                    );
                    reject(deleteError);
                  });
              });
            });

            fastify.log.info(`Deleted series ${request.params.series} with ${docs.length} dicoms`);
            reply.code(200).send('Deleted successfully');
          }
        }
      );
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      reply.send(new InternalError('Delete series', e));
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
      await fastify.init();
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
