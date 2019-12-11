const wado = require('./wado.js');
const qidoStudySeries = require('./qido_study_series.js');
const qidoStudy = require('./qido_study.js');
const qidoSeries = require('./qido_series.js');
const qidoInstances = require('./qido_instances.js');
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
  `;
}

module.exports.views = {
  wado_metadata: {
    map: stringifyViewWithDependencies(wado),
  },
  patients: {
    map: stringifyViewWithDependencies(patients),
    reduce: '_count()',
  },
  qido_study_series: {
    map: stringifyViewWithDependencies(qidoStudySeries),
    reduce: '_count()',
  },
  qido_study: {
    map: stringifyViewWithDependencies(qidoStudy),
    reduce: '_count()',
  },
  qido_series: {
    map: stringifyViewWithDependencies(qidoSeries),
    reduce: '_count()',
  },
  qido_instances: {
    map: stringifyViewWithDependencies(qidoInstances),
    reduce: '_count()',
  },
};
