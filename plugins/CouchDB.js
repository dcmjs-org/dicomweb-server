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
const md5 = require('md5');

const config = require('../config/index');
const viewsjs = require('../config/views');
const { studyTags, seriesTags, instanceTags, patientTags } = require('../config/viewTags');
const { InternalError, ResourceNotFoundError, BadRequestError } = require('../utils/Errors');

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

  // pass the actual obj
  fastify.decorate('queryObj', (query, obj, keys) => {
    const keysInQuery = Object.keys(query);
    for (let i = 0; i < keysInQuery.length; i += 1) {
      if (
        keys[keysInQuery[i]] &&
        !(
          obj[keys[keysInQuery[i]]] &&
          obj[keys[keysInQuery[i]]].Value &&
          obj[keys[keysInQuery[i]]].Value[0] &&
          ((obj[keys[keysInQuery[i]]].Value[0].Alphabetic &&
            obj[keys[keysInQuery[i]]].Value[0].Alphabetic === query[keysInQuery[i]]) ||
            obj[keys[keysInQuery[i]]].Value[0].toString() === query[keysInQuery[i]])
        )
      ) {
        return false;
      }
    }
    return true;
  });

  // get the values from couchdb and format the object with and according to VRs
  fastify.decorate('formatValuesWithVR', (values, tags) => {
    try {
      const arr = JSON.parse(values);
      const result = {};
      for (let j = 0; j < tags.length; j += 1) {
        result[tags[j][1]] = { vr: tags[j][3] };

        // if (arr[j]) newobj[tags[j][1]].Value = [arr[j]];
        const Value = arr[j];
        switch (tags[j][3]) {
          case 'PN':
            if (Value && Value[0]) {
              result[tags[j][1]].Value = [
                {
                  Alphabetic: Value[0],
                },
              ];
            }

            break;
          case 'UN':
            // TODO: Not sure what the actual limit should be,
            // but dcm4chee will use BulkDataURI if the Value
            // is too large. We should do the same
            if (Value.startsWith('http') || Value.startsWith('/studies')) {
              result[tags[j][1]].BulkDataURI = Value;
            } else {
              result[tags[j][1]].InlineBinary = Value;
            }

            break;
          case 'OW':
            result[tags[j][1]].BulkDataURI = Value;
            break;
          default:
            if (
              Value &&
              Value.length &&
              !(Value.length === 1 && (Value[0] === undefined || Value[0] === ''))
            ) {
              result[tags[j][1]].Value = Value;
            }
        }
      }
      return result;
    } catch (err) {
      fastify.log.error(
        `Couldn't format Values With VR ${err.message}. Values: ${JSON.stringify(
          values
        )} Tags: ${JSON.stringify(tags)}`
      );
    }
    return {};
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
      // TODO: Commented out StudyDate because it doesn't actually
      // filter by StudyDate unless it's an exact match, and so it
      // was returning no results for the OHIF Study List
      const queryKeys = {
        // StudyDate: '00080020',
        StudyTime: '00080030',
        AccessionNumber: '00080050',
        // ModalitiesInStudy: '00080061', // not here
        ReferringPhysicianName: '00080090',
        PatientName: '00100010',
        PatientID: '00100020',
        StudyInstanceUID: '0020000D',
        StudyID: '00200010',
      };

      const dicomDB = fastify.couch.db.use(config.db);
      // const dbfilter = request.query.PatientID
      //   ? {
      //       startkey: [request.query.PatientID, '', '', '', ''],
      //       endkey: [`${request.query.PatientID}\u9999`, '{}', '{}', '{}', '{}'],
      //     }
      //   : {};
      const bodyStudies = new Promise((resolve, reject) => {
        dicomDB.view(
          'instances',
          'qido_study',
          {
            // ...dbfilter,
            reduce: true,
            group_level: 4,
            stale: 'ok',
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

      bodyStudies
        .then(values => {
          const studies = {};
          studies.rows = values.rows;
          const res = [];
          // couch returns ordered list, merge if the study occurs multiple times consequently (due to seres listing different tags)
          for (let i = 0; i < studies.rows.length; i += 1) {
            const study = studies.rows[i];
            const newobj = fastify.formatValuesWithVR(study.key[3], studyTags);
            // add numberOfStudyRelatedInstances
            newobj['00201208'].Value = [];
            newobj['00201208'].Value.push(study.value);
            // add numberOfStudyRelatedSeries
            newobj['00201206'].Value = [];
            newobj['00201206'].Value.push(1);
            newobj['00080061'].Value = [study.key[1]];

            study.key[3] = newobj;
          }

          for (let i = 0; i < studies.rows.length; i += 1) {
            const study = studies.rows[i];
            const studySeriesObj = study.key[3];
            if (fastify.queryObj(request.query, studySeriesObj, queryKeys)) {
              // see if there are consequent records with the same studyuid
              const currentStudyUID = study.key[0];
              for (let j = i + 1; j < studies.rows.length; j += 1) {
                const consequentStudyUID = studies.rows[j].key[0];
                if (currentStudyUID === consequentStudyUID) {
                  // same study merge
                  const consequentStudySeriesObj = studies.rows[j].key[3];
                  Object.keys(consequentStudySeriesObj).forEach(tag => {
                    if (tag === '00201208') {
                      // numberOfStudyRelatedInstances needs to be cumulated
                      studySeriesObj['00201208'].Value[0] += studies.rows[j].value;
                    } else if (tag === '00201206') {
                      // numberOfStudyRelatedSeries needs to be cumulated
                      studySeriesObj['00201206'].Value[0] +=
                        consequentStudySeriesObj['00201206'].Value[0];
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
          }
          try {
            if (request.query.limit) {
              reply.code(200).send(res.slice(0, Number(request.query.limit)));
            } else reply.code(200).send(res);
          } catch (limitErr) {
            fastify.log.warn(
              `Cannot limit. invalid value ${request.query.limit}. Error: ${limitErr.message}`
            );
          }
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

  // needs to support query with following keys
  // Modality 00080060
  // SeriesInstanceUID 0020000E
  // SeriesNumber 00200011
  // we don't have the rest in results
  // PerformedProcedureStepStartDate 00400244
  // PerformedProcedureStepStartTime 00400245
  // RequestAttributeSequence 00400275
  // &gt;ScheduledProcedureStepID 00400009
  // &gt;RequestedProcedureID 00401001
  fastify.decorate('getQIDOSeries', (request, reply) => {
    try {
      const queryKeys = {
        Modality: '00080060',
        SeriesInstanceUID: '0020000E',
        SeriesNumber: '00200011',
        // PerformedProcedureStepStartDate: '00400244',
        // PerformedProcedureStepStartTime: '00400245',
        // RequestAttributeSequence: '00400275',
        // ScheduledProcedureStepID: '00400009',
        // RequestedProcedureID: '00401001',
      };

      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'qido_series',
        {
          startkey: [request.params.study],
          endkey: [request.params.study, {}, {}],
          reduce: true,
          group_level: 3,
          stale: 'ok',
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(series => {
              // get the actual instance object (tags only)
              const seriesObj = fastify.formatValuesWithVR(series.key[2], seriesTags);
              if (fastify.queryObj(request.query, seriesObj, queryKeys)) {
                seriesObj['00201209'].Value = [];
                seriesObj['00201209'].Value.push(series.value);
                res.push(seriesObj);
              }
            });
            try {
              if (request.query.limit) {
                reply.code(200).send(res.slice(0, Number(request.query.limit)));
              } else reply.code(200).send(res);
            } catch (limitErr) {
              fastify.log.warn(
                `Cannot limit. invalid value ${request.query.limit}. Error: ${limitErr.message}`
              );
            }
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
          startkey: [request.params.study, request.params.series],
          endkey: [request.params.study, request.params.series, {}],
          reduce: true,
          group: true,
          group_level: 4,
          stale: 'ok',
        },
        (error, body) => {
          if (!error) {
            const res = [];
            body.rows.forEach(instance => {
              // get the actual instance object (tags only)
              const instanceObj = fastify.formatValuesWithVR(instance.key[3], instanceTags);
              res.push(instanceObj);
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

  fastify.decorate('retrieveInstance', async (request, reply) => {
    try {
      // if the query params have frame use retrieveInstanceFrames instead
      if (request.query.frame) fastify.retrieveInstanceFrames(request, reply);
      else {
        const dicomDB = fastify.couch.db.use(config.db);
        const instance = request.params.instance || request.query.objectUID; // for instance rs and uri
        reply.header('Content-Disposition', `attachment; filename=${instance}.dcm`);
        const stream = await fastify.getDicomFileAsStream(instance, dicomDB);
        reply.code(200).send(stream);
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

  fastify.decorate('retrieveInstanceFrames', async (request, reply) => {
    // wado-rs frame retrieve
    //
    // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_8.6.html#sect_8.6.1.2
    //
    // - Accepts frames as a comma separated list of frame numbers (starting at 1):
    //   -- most likely/common use case will be a single number 1.  This is what OHIF requests.
    //   -- this means just skipping past the dicom header and returning just the PixelData.
    // - in general, need to skip to the correct frame location for each requested frame
    //   -- need to figure offsets out from the instance metadata.
    //   For attachments it makes a head call for attachment size and gets the document for the necessary header values, calculates the ofset and makes a range query
    //        Couchdb attachments can be accessed via ranges:
    //          http://docs.couchdb.org/en/stable/api/document/attachments.html#api-doc-attachment-range
    //        Not clear how to do this via nano. resolved with http range query for attachments for now
    //        Issue filed here: https://github.com/apache/couchdb-nano/issues/166
    //  For linked files it makes a stats call for the size, calculates the offset and makes a range read from the stream
    // - Adds multipart header and content separators
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      const instance = request.params.instance || request.query.objectUID;
      const framesParam = request.params.frames || request.query.frame;
      let doc = instance;
      if (typeof instance === 'string') doc = await dicomDB.get(instance);
      // get tags of the instance
      const numOfFrames = doc.dataset['00280008'] ? doc.dataset['00280008'].Value[0] : 1;
      const numOfBits = doc.dataset['00280100'].Value[0];
      const rows = doc.dataset['00280010'].Value[0];
      const cols = doc.dataset['00280011'].Value[0];
      const samplesForPixel = doc.dataset['00280002'].Value[0];
      const frameSize = Math.ceil((rows * cols * numOfBits * samplesForPixel) / 8);
      let framePromises = [];
      const frames = [];
      if (doc.filePath)
        framePromises = await fastify.retrieveInstanceFramesFromLink(doc, framesParam, {
          numOfFrames,
          numOfBits,
          rows,
          cols,
          samplesForPixel,
          frameSize,
        });
      else
        framePromises = await fastify.retrieveInstanceFramesFromAttachment(doc, framesParam, {
          numOfFrames,
          numOfBits,
          rows,
          cols,
          samplesForPixel,
          frameSize,
        });
      // pack the frames in a multipart and send
      const frameResponses = await Promise.all(framePromises);
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
    } catch (err) {
      reply.send(
        new ResourceNotFoundError('Frame', request.params.frames || request.query.frame, err)
      );
    }
  });

  fastify.decorate(
    'retrieveInstanceFramesFromAttachment',
    (doc, framesParam, calcVars) =>
      new Promise(async (resolve, reject) => {
        try {
          this.request = Axios.create({
            baseURL: `${config.dbServer}:${config.dbPort}/${config.db}`,
          });
          const id = doc.id ? doc.id : doc._id;
          // make a head query to get the attachment size
          // TODO nano doesn't support db.attachment.head
          this.request
            .head(`/${id}/object.dcm`)
            .then(head => {
              fastify.log.info(
                `Content length of the attachment is ${head.headers['content-length']}`
              );
              const attachmentSize = Number(head.headers['content-length']);

              try {
                // TODO Number should be removed after IS is corrected
                const headerSize =
                  attachmentSize - calcVars.frameSize * Number(calcVars.numOfFrames);
                fastify.log.info(
                  `numOfFrames: ${calcVars.numOfFrames}, numOfBits: ${calcVars.numOfBits}, rows : ${calcVars.rows}, cols: ${calcVars.cols}, samplesForPixel: ${calcVars.samplesForPixel}, frameSize: ${calcVars.frameSize}, headerSize: ${calcVars.headerSize}`
                );

                // get range from couch for each frame, just forward the url for now
                // TODO update nano
                const framePromises = [];
                const frameNums = framesParam.split(',');
                fastify.log.info(`frameNums that are sent : ${frameNums}`);
                frameNums.forEach(frameNum => {
                  const frameNo = Number(frameNum);
                  // calculate offset using frame count * frame size (row*col*pixel byte*samples for pixel)
                  const range = `bytes=${headerSize +
                    calcVars.frameSize * (frameNo - 1)}-${headerSize -
                    1 +
                    calcVars.frameSize * frameNo}`;
                  fastify.log.info(
                    `headerSize: ${headerSize}, frameNo: ${frameNo}, range: ${range}`
                  );
                  framePromises.push(
                    new Promise((rangeResolve, rangeReject) => {
                      const opt = {
                        hostname: config.dbServer.replace('http://', ''),
                        port: config.dbPort,
                        path: `/${config.db}/${id}/object.dcm`,
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
                            rangeResolve(databuffer);
                          });
                        } catch (e) {
                          if (data.length === 0) rangeReject(new Error('Empty buffer'));
                          else {
                            const databuffer = Buffer.concat(data);
                            fastify.log.info(
                              `Threw error in catch. Error: ${e.message}, sending buffer of size 
                               ${databuffer.length} anyway`
                            );
                            rangeResolve(databuffer);
                          }
                        }
                      });

                      req.on('error', error => {
                        if (data.length === 0) rangeReject(new Error('Empty buffer'));
                        else {
                          const databuffer = Buffer.concat(data);
                          fastify.log.info(
                            `Threw error ${error.message}, sending buffer of size 
                             ${databuffer.length} anyway`
                          );
                          rangeResolve(databuffer);
                        }
                      });

                      req.end();
                    })
                  );
                });
                resolve(framePromises);
              } catch (frameErr) {
                reject(new InternalError('Not able to get frame', frameErr));
              }
            })
            .catch(err => {
              reject(new InternalError(`Couldn't get content length for the attachment`, err));
            });
        } catch (err) {
          reject(new ResourceNotFoundError('Frame', framesParam, err));
        }
      })
  );

  fastify.decorate(
    'retrieveInstanceFramesFromLink',
    (doc, framesParam, calcVars) =>
      new Promise(async (resolve, reject) => {
        try {
          const fileSize = fs.statSync(doc.filePath).size;

          // TODO Number should be removed after IS is corrected
          const headerSize = fileSize - calcVars.frameSize * Number(calcVars.numOfFrames);
          fastify.log.info(
            `numOfFrames: ${calcVars.numOfFrames}, numOfBits: ${calcVars.numOfBits}, rows : ${calcVars.rows}, cols: ${calcVars.cols}, samplesForPixel: ${calcVars.samplesForPixel}, frameSize: ${calcVars.frameSize}, headerSize: ${headerSize}`
          );

          fs.open(doc.filePath, 'r', (error, fd) => {
            if (error) {
              reject(new InternalError('Opening linked DICOM file', error));
            }
            // get range from couch for each frame, just forward the url for now
            // TODO update nano
            const framePromises = [];
            const frameNums = framesParam.split(',');
            fastify.log.info(`frameNums that are sent : ${frameNums}`);
            frameNums.forEach(frameNum => {
              const frameNo = Number(frameNum);
              // calculate offset using frame count * frame size (row*col*pixel byte*samples for pixel)
              const offset = headerSize + calcVars.frameSize * (frameNo - 1);
              fastify.log.info(`headerSize: ${headerSize}, frameNo: ${frameNo}, offset: ${offset}`);
              const buffer = Buffer.alloc(calcVars.frameSize);
              framePromises.push(
                new Promise((rangeResolve, rangeReject) => {
                  fs.read(fd, buffer, 0, calcVars.frameSize, offset, (err, __, databuffer) => {
                    if (err) rangeReject(new InternalError('Reading frame buffer', err));
                    rangeResolve(databuffer);
                  });
                })
              );
            });
            resolve(framePromises);
          });
        } catch (err) {
          reject(new ResourceNotFoundError('Frame', framesParam, err));
        }
      })
  );

  fastify.decorate('getStudyMetadata', (request, reply) => {
    try {
      const dicomDB = fastify.couch.db.use(config.db);
      dicomDB.view(
        'instances',
        'wado_metadata',
        {
          startkey: [request.params.study],
          endkey: [request.params.study, {}, {}],
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
          startkey: [request.params.study, request.params.series],
          endkey: [request.params.study, request.params.series, {}],
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
              const patientObj = fastify.formatValuesWithVR(patient.key, patientTags);
              res.push(patientObj);
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

  fastify.decorate('saveBuffer', (arrayBuffer, dicomDB, filePath) => {
    // eslint-disable-next-line no-param-reassign
    if (dicomDB === undefined) dicomDB = fastify.couch.db.use(config.db);
    // TODO: Check if this needs to be Buffer or not.
    const body = Buffer.from(arrayBuffer);
    const incomingMd5 = md5(body);
    const dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer, {});
    const couchDoc = {
      _id: dicomData.dict['00080018'].Value[0],
      dataset: dicomData.dict,
      md5hash: incomingMd5,
    };
    if (filePath) couchDoc.filePath = filePath;
    return new Promise((resolve, reject) =>
      dicomDB.get(couchDoc._id, (error, existing) => {
        if (!error) {
          couchDoc._rev = existing._rev;
          // old documents won't have md5
          if (existing.md5hash) {
            // get the md5 of the buffer
            if (
              existing.md5hash === incomingMd5 && // same md5
              ((filePath && existing.filePath && existing.filePath === filePath) || // filepath sent (saving as a link) and it was saved as a link to same path before
                (!filePath && !existing.filePath)) // no filepath (saving as attachment) and it wasn't saved as a link before
            ) {
              fastify.log.info(`${couchDoc._id} is already in the system with same hash`);
              resolve('File already in system');
              return;
            }
          }
          fastify.log.info(`Updating document for dicom ${couchDoc._id}`);
        }

        dicomDB.insert(couchDoc, (err, data) => {
          if (err) {
            reject(err);
          }
          if (!filePath)
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
          else resolve('Saving successful');
        });
      })
    );
  });

  fastify.decorate(
    'processFolder',
    (linkDir, dicomDB) =>
      new Promise((resolve, reject) => {
        fastify.log.info(`Processing folder ${linkDir}`);
        // success variable is to check if there was at least one successful processing
        const result = { success: false, errors: [] };
        fs.readdir(linkDir, async (err, files) => {
          if (err) {
            reject(new InternalError(`Reading directory ${linkDir}`, err));
          } else {
            try {
              const promises = [];
              for (let i = 0; i < files.length; i += 1) {
                if (files[i] !== '__MACOSX')
                  if (fs.statSync(`${linkDir}/${files[i]}`).isDirectory() === true)
                    try {
                      // eslint-disable-next-line no-await-in-loop
                      const subdirResult = await fastify.processFolder(
                        `${linkDir}/${files[i]}`,
                        dicomDB
                      );
                      if (subdirResult && subdirResult.errors && subdirResult.errors.length > 0) {
                        result.errors = result.errors.concat(subdirResult.errors);
                      }
                      if (subdirResult && subdirResult.success) {
                        result.success = result.success || subdirResult.success;
                      }
                    } catch (folderErr) {
                      reject(folderErr);
                    }
                  else
                    promises.push(() => {
                      return (
                        fastify
                          .processFile(linkDir, files[i], dicomDB)
                          // eslint-disable-next-line no-loop-func
                          .catch(error => {
                            result.errors.push(error);
                          })
                      );
                    });
              }
              fastify.dbPqueue.addAll(promises).then(async values => {
                try {
                  for (let i = 0; values.length; i += 1) {
                    if (
                      values[i] === undefined ||
                      (values[i].errors && values[i].errors.length === 0)
                    ) {
                      // one success is enough
                      result.success = result.success || true;
                      break;
                    }
                  }
                  resolve(result);
                } catch (saveDicomErr) {
                  reject(saveDicomErr);
                }
              });
            } catch (errDir) {
              reject(errDir);
            }
          }
        });
      })
  );

  fastify.decorate(
    'processFile',
    (dir, filename, dicomDB) =>
      new Promise((resolve, reject) => {
        try {
          let buffer = [];
          const readableStream = fs.createReadStream(`${dir}/${filename}`);
          readableStream.on('data', chunk => {
            buffer.push(chunk);
          });
          readableStream.on('error', readErr => {
            fastify.log.error(`Error in save when reading file ${dir}/${filename}: ${readErr}`);
            reject(new InternalError(`Reading file ${dir}/${filename}`, readErr));
          });
          readableStream.on('close', () => {
            readableStream.destroy();
          });
          readableStream.on('end', async () => {
            buffer = Buffer.concat(buffer);
            try {
              const arrayBuffer = toArrayBuffer(buffer);
              await fastify.saveBuffer(arrayBuffer, dicomDB, `${dir}/${filename}`);
              resolve({ success: true, errors: [] });
            } catch (err) {
              fastify.log.warn(`File not supported ignoring ${filename}`);
              resolve({ success: true, errors: [] });
            }
          });
        } catch (err) {
          reject(new InternalError(`Processing file ${filename}`, err));
        }
      })
  );

  fastify.decorate('linkFolder', async (request, reply) => {
    try {
      if (request.req.hostname.startsWith('localhost')) {
        const dicomDB = fastify.couch.db.use(config.db);
        const result = await fastify.processFolder(request.query.path, dicomDB);
        if (result.success) {
          fastify.updateViews(dicomDB);
          fastify.log.info(`Folder ${request.query.path} linked successfully`);
          reply.code(200).send('success');
        } else {
          reply.send(new InternalError('linkFolder', new Error(JSON.stringify(result.errors))));
        }
      } else {
        reply.send(
          new BadRequestError(
            'Not supported',
            new Error('Linkfolder functionality is only supported for localhost')
          )
        );
      }
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      reply.send(new InternalError('linkFolder', e));
    }
  });
  fastify.decorate('updateViews', dbConn => {
    let dicomDB = dbConn;
    if (!dicomDB) dicomDB = fastify.couch.db.use(config.db);
    // trigger view updates
    const updateViewPromisses = [];
    updateViewPromisses.push(() => {
      return dicomDB.view('instances', 'qido_study', {});
    });
    updateViewPromisses.push(() => {
      return dicomDB.view('instances', 'qido_series', {});
    });
    updateViewPromisses.push(() => {
      return dicomDB.view('instances', 'qido_instances', {});
    });
    // I don't need to wait
    fastify.dbPqueue.addAll(updateViewPromisses);
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
          fastify.updateViews(dicomDB);
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
          startkey: [request.params.study],
          endkey: [request.params.study, {}, {}],
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
            fastify.updateViews(dicomDB);
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
          startkey: [request.params.study, request.params.series],
          endkey: [request.params.study, request.params.series, {}],
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
            fastify.updateViews(dicomDB);
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

  fastify.decorate('getDicomFileAsStream', async (instance, dicomDB) => {
    let doc = instance;
    if (typeof instance === 'string') doc = await dicomDB.get(instance);
    if (doc.filePath) {
      return fs.createReadStream(doc.filePath);
    }
    // if the document is retrieved via metadata the id is in id, if document retrieved it is _id
    const id = doc.id ? doc.id : doc._id;
    return dicomDB.attachment.getAsStream(id, 'object.dcm');
  });

  fastify.decorate('getWado', (request, reply) => {
    try {
      // get the datasets
      const dicomDB = fastify.couch.db.use(config.db);
      let isFiltered = false;
      const startKey = [];
      const endKey = [];
      if (request.params.study) {
        startKey.push(request.params.study);
        endKey.push(request.params.study);
        isFiltered = true;
      }
      if (request.params.series) {
        startKey.push(request.params.series);
        endKey.push(request.params.series);
        isFiltered = true;
      }
      for (let i = endKey.length; i < 3; i += 1) endKey.push({});
      let filterOptions = {};
      if (isFiltered) {
        filterOptions = {
          startkey: startKey,
          endkey: endKey,
          reduce: false,
          include_docs: true,
        };
        dicomDB.view('instances', 'qido_instances', filterOptions, async (error, body) => {
          if (!error) {
            try {
              const datasetsReqs = [];
              body.rows.forEach(instance => {
                datasetsReqs.push(fastify.getDicomBuffer(instance.doc, dicomDB));
              });
              const datasets = await Promise.all(datasetsReqs);
              const { data, boundary } = await fastify.packMultipartDicomsInternal(datasets);
              // send response
              reply.header(
                'Content-Type',
                `multipart/related; type=application/dicom; boundary=${boundary}`
              );
              reply.header('content-length', Buffer.byteLength(data));
              reply.send(Buffer.from(data));
            } catch (err) {
              reply.send(
                new InternalError(`getWado with params ${JSON.stringify(request.params)}`, err)
              );
            }
          } else {
            reply.send(new InternalError('Retrieve series metadata from couchdb', error));
          }
        });
      } else {
        reply.send(
          new BadRequestError('Not supported', new Error('Wado retrieve with no parameters'))
        );
      }
    } catch (e) {
      // TODO Proper error reporting implementation required
      // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      reply.send(new InternalError(`getWado with params ${JSON.stringify(request.params)}`, e));
    }
  });

  fastify.decorate(
    'packMultipartDicomsInternal',
    datasets =>
      new Promise(async (resolve, reject) => {
        try {
          fastify.log.info(`Packing ${datasets.length} dicoms`);
          const { data, boundary } = dcmjs.utilities.message.multipartEncode(datasets);
          fastify.log.info(`Packed ${Buffer.byteLength(data)} bytes of data `);
          resolve({ data, boundary });
        } catch (err) {
          reject(err);
        }
      })
  );

  fastify.decorate(
    'getDicomBuffer',
    (instance, dicomDB) =>
      new Promise(async (resolve, reject) => {
        try {
          const stream = await fastify.getDicomFileAsStream(instance, dicomDB);
          const bufs = [];
          stream.on('data', d => {
            bufs.push(d);
          });
          stream.on('end', () => {
            const buf = Buffer.concat(bufs);
            resolve(toArrayBuffer(buf));
          });
        } catch (err) {
          reject(err);
        }
      })
  );

  fastify.addHook('onError', (request, reply, error, done) => {
    if (error instanceof ResourceNotFoundError) reply.code(404);
    else if (error instanceof InternalError) reply.code(500);
    else if (error instanceof BadRequestError) reply.code(400);
    done();
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
      // update views on startup
      fastify.updateViews();
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
