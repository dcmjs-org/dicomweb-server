const wado = require('./wado.js');
const qido_study_series = require('./qido_study_series.js');
const qido_study = require('./qido_study.js');
const qido_series = require('./qido_series.js');
const qido_instances = require('./qido_instances.js');
const patients = require('./patients.js');

module.exports.views = {
  wado_metadata: {
    map: wado.toString()
  },
  patients: {
    map: patients.toString(),
    reduce: '_count()',
  },
  qido_study_series: {
    map: qido_study_series.toString(),
    reduce: '_count()',
  },
  qido_study: {
    map: qido_study.toString(),
    reduce: '_count()',
  },
  qido_series: {
    map: qido_series.toString(),
    reduce: '_count()',
  },
  qido_instances: {
    map: qido_instances.toString(),
    reduce: '_count()',
  },
};
