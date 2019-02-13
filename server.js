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

// Update the views in couchdb with the ones defined in the code
function checkViews (){
  const dicomDB = fastify.couch.db.use('chronicle');
  dicomDB.get('_design/instances', function (e, b, h) { // create view
    if (e) {
      fastify.log.info('Error getting the design document '+ e.message)
      return;
    }
    for (view in views){
      b.views[view] = views[view]
            
    }
    dicomDB.insert(b, '_design/instances', function (e, b, h) {
      if (e) 
      fastify.log.info('Error updating the design document ' + e.message  )
        // console.log(e)
      else
      fastify.log.info('Design document updated successfully ' )
    })
  });
}


const views={
  wado_metadata:
  {'map':"function(doc){var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];"+
    " for(var t in doc.dataset){var fallback='';if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(doc.dataset[t].vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr}}"+
    " emit([studyUID,seriesUID,instanceUID],key);}}"
  },
  patients:
  {'map':"function(doc){var tags=[['institution','00080080','','CS'],['patientID','00100020','','LO'],['patientName','00100010','','PN']"+
    " ,['patientBirthDate','00101030','','DA'],['patientSex','00100040','','CS'],['charset','00080005','','CS'],['retrieveURL','00081190','','UR']];var key={};"+
    " if(doc.dataset){var i;for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};"+
    " if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr||vr}else{key[t]={};"+
    " key[t].vr=vr;}}"+
    " emit(key,1)}}",
   'reduce':'_count()'
  },
  qido_study_series:
  {'map':"function(doc){if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " emit([studyUID,seriesUID],null)}}",
    'reduce':'_approx_count_distinct()'
  },
  qido_study:
  {'map':"function(doc){var studyTags=[['charset','00080005','','CS',1],['studyDate','00080020','','DA',1],"+
    " ['studyTime','00080030','','TM',1],['accessionNumber','00080050','','SH',1],['instanceAvailability','00080056','','CS',1],"+
    " ['modalitiesInStudy','00080061','','CS',1],['referringPhysicianName','00080090','','PN',1],['timezoneOffsetFromUTC','00080201','','SH',0],"+
    " ['retrieveURL','00081190','','UR',1],['patientName','00100010','','PN',1],['patientID','00100020','','LO',1],['patientBirthDate','00101030','','DA',1],"+
    " ['patientSex','00100040','','CS',1],['studyUID','0020000D','','UI',1],['studyID','00200010','','SH',1],['numberOfStudyRelatedSeries','00201206','','IS',1],"+
    " ['numberOfStudyRelatedInstances','00201208','','IS',1],['retrieveAETitle','00080054','','AE']];var studyKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " var i;for(i=0;i<studyTags.length;i++){var tag=studyTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){if(doc.dataset[t].Value[0]!==''){studyKey[t]={};if(vr==='PN')"+
    " studyKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else studyKey[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " studyKey[t].vr=doc.dataset[t].vr||vr}else{if(required){studyKey[t]={};studyKey[t].vr=vr}}}"+
    " emit([studyUID,studyKey],1)}}",
    'reduce':'_count()'
  },
  qido_series:
  {'map':"function(doc){var seriesTags=[['charset','00080005','','CS',1,],['modality','00080060','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0],['seriesDescription','0008103E','','LO',0],['retrieveURL','00081190','','UR',0],"+
    " ['seriesUID','0020000E','','UI',1],['seriesNumber','00200011','','IS',1],['numberOfSeriesRelatedInstances','00201209','','IS',1],['retrieveAETitle','00080054','','AE',0],['instanceAvailability','00080056','','CS',0],['studyUID','0020000D','','UI',0]];"+
    " var seriesKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];"+
    " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];"+
    " var i;for(i=0;i<seriesTags.length;i++){var tag=seriesTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){seriesKey[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " seriesKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else seriesKey[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " seriesKey[t].vr=doc.dataset[t].vr||vr}else{if(required){seriesKey[t]={};seriesKey[t].vr=vr}}}"+
    " emit([studyUID,seriesUID,seriesKey],1)}}",
    'reduce':'_count()'
  },
  qido_instances:
  {'map':"function(doc){var tags=[['charset','00080005','','CS',1],['SOPClassUID','00080016','','UI',1],['SOPInstanceUID','00080018','','UI',1],['instanceAvailability','00080056','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0],"+
    " ['retrieveURL','00081190','','UR',0],['instanceNumber','00200013','','IS',1],['rows','0008103E','','US',0],['columns','00081190','','US',0],['bitsAllocated','00280100','','US',0],['numberOfFrames','00280008','','IS',0],['studyUID','0020000D','','UI',1],"+
    " ['seriesUID','0020000E','','UI',1],['retrieveAETitle','00080054','','AE',1]];var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];seriesUID='NA';if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];var i;"+
    " for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')"+
    " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}"+
    " key[t].vr=doc.dataset[t].vr||vr}else{if(required){key[t]={};key[t].vr=vr}}}"+
    " emit([studyUID,seriesUID,instanceUID,key],1)}}",
    'reduce':'_count()'
  }

}

fastify.register(require('./qido'))
fastify.register(require('./wado'))
fastify.register(require('./stow'))
fastify.register(require('./other'))

var studies_schema = require('./config/schemas/studies_output_schema.json');
var series_schema = require('./config/schemas/series_output_schema.json');
var instances_schema =require('./config/schemas/instances_output_schema.json');

//schemas
fastify.addSchema(studies_schema);
fastify.addSchema(series_schema);
fastify.addSchema(instances_schema);

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
    checkViews();
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
