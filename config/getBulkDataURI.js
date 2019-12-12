/* eslint-disable */
module.exports = function getBulkDataURI(studyUID, seriesUID, instanceUID, tag) {
    // e.g. http://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs/studies/1.2.840.113619.2.5.1762583153.215519.978957063.78/series/1.2.840.113619.2.5.1762583153.215519.978957063.121/instances/1.2.840.113619.2.5.1762583153.215519.978957063.128/bulkdata/00431029
    var server = '';
    var bulkDataURI = server;
    bulkDataURI += '/studies/' + studyUID;
    bulkDataURI += '/series/' + seriesUID;
    bulkDataURI += '/instances/' + instanceUID;
    bulkDataURI += '/bulkdata/' + tag.toUpperCase();

    return bulkDataURI;
}
