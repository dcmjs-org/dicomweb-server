// Require the framework and instantiate it
const fastify = require('fastify')({
  logger: true
})
var toArrayBuffer = require('to-array-buffer')

const dicomweb_client = require('dicomweb-client');
window={}
const dcmjs = require('dcmjs');

const path = require('path')
const fs = require('fs')

fastify.register(require('fastify-couchdb'), {
  url: 'http://localhost:5984'
})

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, ''),
  // prefix: '/public/', // optional: default '/'
})
 
const authenticate = {realm: 'Westeros'}
fastify.register(require('fastify-basic-auth'), { validate, authenticate })
// `this` inside validate is `fastify`
function validate (username, password, req, reply, done) {
  if (username === 'dicomweb' && password === 'server') {
    done()
  } else {
    done(new Error('Not Authenticated'))
  }
}

class DICOMZero {
  constructor(options={}) {
    this.status = options.status || function() {};
    this.reset();
  }

  reset() {
    this.mappingLog = [];
    this.dataTransfer = undefined;
    this.datasets = [];
    this.readers = [];
    this.arrayBuffers = [];
    this.files = [];
    this.fileIndex = 0;
    this.context = {patients: []};
  }
  
  static datasetFromArrayBuffer(arrayBuffer) {
    let dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    let dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    dataset._meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dicomData.meta);
    return(dataset);
  }

  static dictAndDatasetFromArrayBuffer(arrayBuffer) {
    let dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    let dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
    dataset._meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dicomData.meta);
    return({dict:dicomData.dict,dataset:dataset});
  }
  // return a function to use as the 'onload' callback for the file reader.
  // The function takes a progress event argument and it knows (from this class instance)
  // when all files have been read so it can invoke the doneCallback when all
  // have been read.
  getReadDICOMFunction(doneCallback, statusCallback) {
    statusCallback = statusCallback || console.log;
    return progressEvent => {
      let reader = progressEvent.target;
      let arrayBuffer = reader.result;
      this.arrayBuffers.push(arrayBuffer);

      let dicomData;
      try {
        dicomData = dcmjs.data.DicomMessage.readFile(arrayBuffer);
        let dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(dicomData.dict);
        dataset._meta = dcmjs.data.DicomMetaDictionary.namifyDataset(dicomData.meta);
        this.datasets.push(dataset);
      } catch (error) {
        console.error(error);
        statusCallback("skipping non-dicom file");
      }

      let readerIndex = this.readers.indexOf(reader);
      if (readerIndex < 0) {
        reject("Logic error: Unexpected reader!");
      } else {
        this.readers.splice(readerIndex, 1); // remove the reader
      }

      if (this.fileIndex === this.dataTransfer.files.length) {
        statusCallback(`Normalizing...`);
        try {
          this.multiframe = dcmjs.normalizers.Normalizer.normalizeToDataset(this.datasets);
        } catch (e) {
          console.error('Could not convert to multiframe');
          console.error(e);
        }
		
		if (this.multiframe.SOPClassUID == dcmjs.data.DicomMetaDictionary.sopClassUIDsByName['Segmentation']){
			statusCallback(`Creating segmentation...`);
			try {
			  this.seg = new dcmjs.derivations.Segmentation([this.multiframe]);
			  statusCallback(`Created ${this.multiframe.NumberOfFrames} frame multiframe object and segmentation.`);
			} catch (e) {
			  console.error('Could not create segmentation');
			  console.error(e);
			}
	    } else if (this.multiframe.SOPClassUID == dcmjs.data.DicomMetaDictionary.sopClassUIDsByName['ParametricMapStorage']){
			statusCallback(`Creating parametric map...`);
			try {
			  this.pm = new dcmjs.derivations.ParametricMap([this.multiframe]);
			  statusCallback(`Created ${this.multiframe.NumberOfFrames} frame multiframe object and parametric map.`);
			} catch (e) {
			  console.error('Could not create parametric map');
			  console.error(e);
			}
		}
        doneCallback();
      } else {
        statusCallback(`Reading... (${this.fileIndex+1}).`);
        this.readOneFile(doneCallback, statusCallback);
      }
    };
  }

  // Used for file selection button or drop of file list
  readOneFile(doneCallback, statusCallback) {
    let file = this.dataTransfer.files[this.fileIndex];
    this.fileIndex++;

    let reader = new FileReader();
    reader.onload = this.getReadDICOMFunction(doneCallback, statusCallback);
    reader.readAsArrayBuffer(file);

    this.files.push(file);
    this.readers.push(reader);
  }

  handleDataTransferFileAsDataset(file, options={}) {
    options.doneCallback = options.doneCallback || function(){};

    let reader = new FileReader();
    reader.onload = (progressEvent) => {
      let dataset = DICOMZero.datasetFromArrayBuffer(reader.result);
      options.doneCallback(dataset);
    }
    reader.readAsArrayBuffer(file);
  }
  
  extractDatasetFromZipArrayBuffer(arrayBuffer) {
    this.status(`Extracting ${this.datasets.length} of ${this.expectedDICOMFileCount}...`);
    this.datasets.push(DICOMZero.datasetFromArrayBuffer(arrayBuffer));
    if (this.datasets.length == this.expectedDICOMFileCount) {
      this.status(`Finished extracting`);
      this.zipFinishCallback();
    }
  };

  handleZip(zip) {
    this.zip = zip;
    this.expectedDICOMFileCount = 0;
    Object.keys(zip.files).forEach(fileKey => {
      this.status(`Considering ${fileKey}...`);
      if (fileKey.endsWith('.dcm')) {
        this.expectedDICOMFileCount += 1;
        zip.files[fileKey].async('arraybuffer').then(this.extractDatasetFromZipArrayBuffer.bind(this));
      }
    });
  }

  extractFromZipArrayBuffer(arrayBuffer, finishCallback=function(){}) {
    this.zipFinishCallback = finishCallback;
    this.status("Extracting from zip...");
    JSZip.loadAsync(arrayBuffer)
    .then(this.handleZip.bind(this));
  }

  organizeDatasets() {
    this.datasets.forEach(dataset => {
      let patientName = dataset.PatientName;
      let studyTag = dataset.StudyDate + ": " + dataset.StudyDescription;
      let seriesTag = dataset.SeriesNumber + ": " + dataset.SeriesDescription;
      let patientNames = this.context.patients.map(patient => patient.name);
      let patientIndex = patientNames.indexOf(dataset.PatientName);
      if (patientIndex == -1) {
        this.context.patients.push({
          name: dataset.PatientName,
          id: this.context.patients.length,
          studies: {}
        });
      }
      let studyNames; // TODO - finish organizing
    });
  }
}
fastify.addContentTypeParser('*', function (req, done) {
  // done()
  var data = [];
  req.on('data', chunk => { data.push(chunk); })
  req.on('end', () => {
    // console.log(data)
    data = Buffer.concat(data);
    done(null, data)
  })
})

//schemas
fastify.addSchema( {
  "$id": "studies_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080020": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080030": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080050": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080061": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                },
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080090": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "object",
                  properties: {
                    Alphabetic: {
                      type: "string"
                    }
                  },
                  required: [
                    "Alphabetic"
                  ]
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "object",
                  properties: {
                    Alphabetic: {
                      type: "string"
                    }
                  },
                  required: [
                    "Alphabetic"
                  ]
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100020": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100030": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00100040": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201206": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201208": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080020",
        "00080030",
        "00080050",
        "00080054",
        "00080056",
        "00080061",
        "00080090",
        "00081190",
        "00100010",
        "00100020",
        "00100030",
        "00100040",
        "0020000D",
        "00200010",
        "00201206",
        "00201208"
      ]
    }   
  ]
});

fastify.addSchema({
  "$id": "series_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080060": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0008103E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200011": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00201209": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080054",
        "00080056",
        "00080060",
        "0008103E",
        "00081190",
        "0020000D",
        "0020000E",
        "00200011",
        "00201209"
      ]
    }
  ]
});

fastify.addSchema({
  "$id": "instances_schema",
  type: "array",
  items: [
    {
      type: "object",
      properties: {
        "00080005": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080016": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080018": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080054": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00080056": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00081190": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000D": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "0020000E": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "string"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00200013": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280010": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280011": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        },
        "00280100": {
          type: "object",
          properties: {
            vr: {
              type: "string"
            },
            Value: {
              type: "array",
              items: [
                {
                  type: "integer"
                }
              ]
            }
          },
          required: [
            "vr"
          ]
        }
      },
      required: [
        "00080005",
        "00080016",
        "00080018",
        "00080054",
        "00080056",
        "00081190",
        "0020000D",
        "0020000E",
        "00200013",
        "00280010",
        "00280011",
        "00280100"
      ]
    }
  ]
});

fastify.after(() => {
  //this enables basic authentication
  // disabling authentication for now 
  // fastify.addHook('preHandler', fastify.basicAuth)
  
  // WADO Retrieve Instance
  // GET	{s}/studies/{study}/series/{series}/instances/{instance}
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances/:instance',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          },
          series: {
            type: 'string'
          },
          instance: {
            type: 'string'
          }
        }
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        reply.header('Content-Disposition', `attachment; filename=${request.params.instance}.dcm`);      
        reply.send(dicomDB.attachment.getAsStream(request.params.instance, "object.dcm"))
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  // WADO Retrieve Instance Metadata
  // GET	{s}/studies/{study}/series/{series}/instances/{instance}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances/:instance/metadata',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          },
          series: {
            type: 'string'
          },
          instance: {
            type: 'string'
          }
        }
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'wado_metadata', 
          {
            key: [request.params.study,request.params.series,request.params.instance]
          },
          function(error, body) {
            if (!error) {
              var res=[];
              body.rows.forEach(function(instance) {
                //get the actual instance object (tags only)
                res.push(instance.value);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  
  // GET	{s}/patients
  fastify.route({
    method: 'GET',
    url: '/patients',
    schema: {
      response: {
        200: {
          type: "array",
          items: [
            {
              type: "object",
              properties: {
                "00080005": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00081190": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00080080": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00100020": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00100010": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "object",
                          properties: {
                            Alphabetic: {
                              type: "string"
                            }
                          }
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00101030": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                },
                "00100040": {
                  type: "object",
                  properties: {
                    Value: {
                      type: "array",
                      items: [
                        {
                          type: "string"
                        }
                      ]
                    },
                    vr: {
                      type: "string"
                    }
                  },
                  required: [
                    "vr"
                  ]
                }
              }
            }
          ]
        }
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'patients', 
          {
            reduce: true, 
            group_level: 3
          },
          function(error, body) {
            if (!error) {
              fastify.log.info(body)
              
              var res=[];
              body.rows.forEach(function(patient) {
                res.push(patient.key);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
        
        
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  // QIDO Retrieve Studies
  // GET	{s}/studies
  fastify.route({
    method: 'GET',
    url: '/studies',
    schema: {
      response: {
        200: 'studies_schema#'
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        var seriesCounts={};
        const bodySeriesCounts = await dicomDB.view('instances', 'qido_study_series', 
          {
            reduce: true, 
            group_level: 1
          },
          function(error, bodySeriesCounts) {
            if (!error) {
              
              bodySeriesCounts.rows.forEach(function(study) {
                seriesCounts[study.key[0]]=study.value;
              });
              
            }else{
              fastify.log.info(error)
            }
          });
        
        fastify.log.info(seriesCounts);
        const body = await dicomDB.view('instances', 'qido_study', 
          {
            reduce: true, 
            group_level: 2
          },
          function(error, body) {
            if (!error) {
              fastify.log.info(body)
              
              var res=[];
              body.rows.forEach(function(study) {
                study.key[1]["00201208"].Value=[]
                study.key[1]["00201208"].Value.push(study.value);
                study.key[1]["00201206"].Value=[]
                study.key[1]["00201206"].Value.push(seriesCounts[study.key[0]]);
                res.push(study.key[1]);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
        
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  // QIDO Retrieve Series
  // GET	{s}/studies/:study/series
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          }
        }
      },
      response: {
        200: 'series_schema#'
      }
    },
   
    handler: async (request, reply) => {
      try {
        fastify.log.info(request.params.study);
            
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'qido_series', 
          {
            startkey: [request.params.study,""],
            endkey: [request.params.study+"\u9999","{}"],
            reduce: true, 
            group_level: 3
          },
          function(error, body) {
            if (!error) {
              fastify.log.info(body)
              
              var res=[];
              body.rows.forEach(function(series) {
                //get the actual instance object (tags only)
                series.key[2]["00201209"].Value=[]
                series.key[2]["00201209"].Value.push(series.value);
                res.push(series.key[2]);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
      }
      catch(err) {
        reply.send(err);
      }
    }
  })
  
  // QIDO Retrieve Instances
  // GET	{s}/studies/:study/series/:series/instances
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/instances',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          },
          series: {
            type: 'string'
          }
        }
      },
      response: {
        200: 'instances_schema#'
      }
    },
   
    handler: async (request, reply) => {
      try {
        fastify.log.info(request.params.study);
            
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'qido_instances', 
          {
            startkey: [request.params.study,request.params.series,""],
            endkey: [request.params.study+"\u9999",request.params.series+"\u9999","{}"],
            reduce: true, 
            group_level: 4
          },
          function(error, body) {
            if (!error) {
              var res=[];
              body.rows.forEach(function(instance) {
                //get the actual instance object (tags only)
                res.push(instance.key[3]);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  // WADO Retrieve Study Metadata
  // GET	{s}/studies/{study}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/metadata',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          }
        }
      },
      
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'wado_metadata', 
          {
            startkey: [request.params.study,"",""],
            endkey: [request.params.study+"\u9999",{},{}]
          },
          function(error, body) {
            if (!error) {
              var res=[];
              body.rows.forEach(function(instance) {
                //get the actual instance object (tags only)
                res.push(instance.value);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
      }
      catch(err) {
        reply.send(err);
      }
    }
  })


  // WADO Retrieve Series Metadata
  // GET	{s}/studies/{study}/series/{series}/metadata
  fastify.route({
    method: 'GET',
    url: '/studies/:study/series/:series/metadata',
    schema: {
      params: {
        type: 'object',
        properties: {
          study: {
            type: 'string'
          },
          series: {
            type: 'string'
          }
        }
      }
    },
   
    handler: async (request, reply) => {
      try {
        const dicomDB = fastify.couch.db.use('chronicle');
        const body = await dicomDB.view('instances', 'wado_metadata', 
          {
            startkey: [request.params.study,request.params.series,""],
            endkey: [request.params.study+"\u9999",request.params.series+"\u9999",{}]
          },
          function(error, body) {
            if (!error) {
              var res=[];
              body.rows.forEach(function(instance) {
                //get the actual instance object (tags only)
                res.push(instance.value);
              });
              reply.send(JSON.stringify(res));
            }else{
              fastify.log.info(error)
            }
        });
      }
      catch(err) {
        reply.send(err);
      }
    }
  })

  
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      // request needs to have a querystring with a `name` parameter
      querystring: {
        name: { type: 'string' }
      },
      // the response needs to be an object with an `hello` property of type 'string'
      response: {
        200: {
          type: 'object',
          properties: {
            hello: { type: 'string' }
          }
        }
      }
    },
    // this function is executed for every request before the handler is executed
    beforeHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      return { hello: 'world' }
    }
  })
})

fastify.route({
  method: 'POST',
  url: '/',
  // this function is executed for every request before the handler is executed
  beforeHandler: async (request, reply) => {
    // E.g. check authentication
  },
  handler: async (request, reply) => {
    // dicomwc=new dicomweb_client.api.DICOMwebClient({"url" : "noURL"});
    res=dicomweb_client.message.multipartDecode(request.body);
    ab = toArrayBuffer(res)
    var dicomAttach = {
      name: 'object.dcm', 
      data: ab,
      content_type: ''
    };
    
    dictDataset = DICOMZero.dictAndDatasetFromArrayBuffer(ab);
    // console.log(dataset)
    couchDoc={
      '_id':dictDataset.dataset.SOPInstanceUID,
      dataset:dictDataset.dict
    }
    const dicomDB = fastify.couch.db.use('chronicle');
    dicomDB.multipart.insert(couchDoc, [dicomAttach], couchDoc._id, function(err, body) {
      console.log(err)
      if (!err)
        console.log(body);
    });
    reply.send('success')
    
  }
// })
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(5985, '0.0.0.0')
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
