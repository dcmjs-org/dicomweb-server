/* eslint-disable */
var buildResponse = require('./buildResponse');

module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var seriesTags = [
        ['charset', '00080005', '', 'CS', 1,],
        ['modality', '00080060', '', 'CS', 1],
        ['timezoneOffsetFromUTC', '00080201', '', 'SH', 0],
        ['seriesDescription', '0008103E', '', 'LO', 1],
        ['retrieveURL', '00081190', '', 'UR', 1],
        ['seriesUID', '0020000E', '', 'UI', 1],
        ['seriesNumber', '00200011', '', 'IS', 1],
        ['numberOfSeriesRelatedInstances', '00201209', '', 'IS', 1],
        ['retrieveAETitle', '00080054', '', 'AE', 0],
        ['instanceAvailability', '00080056', '', 'CS', 1],
        ['studyUID', '0020000D', '', 'UI', 0],
        ['patientName', '00100010', '', 'PN', 1],
        ['patientID', '00100020', '', 'LO', 1]
    ];

    var seriesKey = buildResponse(doc.dataset, seriesTags);
    var studyUID = 'NA';
    var seriesUID = 'NA';

    if (doc.dataset['0020000D'].Value[0]) {
        studyUID = doc.dataset['0020000D'].Value[0];
    }
    
    if (doc.dataset['0020000E'].Value[0]) {
        seriesUID = doc.dataset['0020000E'].Value[0];
    }

    emit([studyUID, seriesUID, seriesKey], 1)
}