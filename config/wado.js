/* eslint-disable */
var buildResponse = require('./buildResponse');

module.exports = function applyView(doc) {
  if (!doc.dataset) {
    return;
  }

  var studyUID = "NA";
  var seriesUID = "NA";
  var instanceUID = "NA";

  if (doc.dataset["0020000D"].Value[0]) {
    studyUID = doc.dataset["0020000D"].Value[0];
  }

  if (doc.dataset["0020000E"].Value[0]) {
    seriesUID = doc.dataset["0020000E"].Value[0];
  }

  if (doc.dataset["00080018"].Value[0]) {
    instanceUID = doc.dataset["00080018"].Value[0];
  }

  var key = buildResponse(doc.dataset);

  emit([studyUID, seriesUID, instanceUID], key);
}