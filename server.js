// Require the framework and instantiate it
const fastify = require('fastify')({
  logger: true
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

//require schema jsons
var patients_schema = require('./config/schemas/patients_output_schema.json');
var studies_schema = require('./config/schemas/studies_output_schema.json');
var series_schema = require('./config/schemas/series_output_schema.json');
var instances_schema =require('./config/schemas/instances_output_schema.json');

//add schemas to fastify to use by id
fastify.addSchema(patients_schema);
fastify.addSchema(studies_schema);
fastify.addSchema(series_schema);
fastify.addSchema(instances_schema);

//register CouchDB plugin we created
fastify.register(require('./controllers/CouchDB'),{
  url: 'http://localhost:5984'
})
//register routes
//this should be done after CouchDB plugin to be able to use the accessor methods
fastify.register(require('./routes/qido'))
fastify.register(require('./routes/wado'))
fastify.register(require('./routes/stow'))
fastify.register(require('./routes/other'))

fastify.after(() => {
  //this enables basic authentication
  // disabling authentication for now 
  // fastify.addHook('preHandler', fastify.basicAuth)

  
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



// Run the server!
const start = async () => {
  try {
    await fastify.listen(5985, '0.0.0.0')
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
    fastify.checkCouchDBViews();
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()