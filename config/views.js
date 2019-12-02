const wado = require('./wado.js');
const qido_study_series = require('./qido_study_series.js');
const qido_study = require('./qido_study.js');
const qido_series = require('./qido_series.js');
const qido_instances = require('./qido_instances.js');
const patients = require('./patients.js');
const buildResponse = require('./buildResponse');
const returnValueFromVR = require('./returnValueFromVR');
const btoa = require('./btoa');
const getBulkDataURI = require('./getBulkDataURI');

function stringifyViewWithDependencies(func) {
  return `
    function(doc) {
      ${btoa.toString()}
      ${getBulkDataURI.toString()}
      ${returnValueFromVR.toString()}
      ${buildResponse.toString()}
      ${func.toString()}

      return applyView(doc);
    }
  `
}

module.exports.views = {
  wado_metadata: {
    map: stringifyViewWithDependencies(wado)
  },
  patients: {
    map: stringifyViewWithDependencies(patients),
    reduce: '_count()',
  },
  qido_study_series: {
    map: stringifyViewWithDependencies(qido_study_series),
    reduce: '_count()',
  },
  qido_study: {
    map: stringifyViewWithDependencies(qido_study),
    reduce: '_count()',
  },
  qido_series: {
    map: stringifyViewWithDependencies(qido_series),
    reduce: '_count()',
  },
  qido_instances: {
    map: stringifyViewWithDependencies(qido_instances),
    reduce: '_count()',
  },
};
