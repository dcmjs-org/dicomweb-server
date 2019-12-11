/* eslint-disable */
var buildResponse = require('./buildResponse');

module.exports = function applyView(doc) {
    var tags = [
        ['charset', '00080005', '', 'CS', 1],
        ['SOPClassUID', '00080016', '', 'UI', 1],
        ['SOPInstanceUID', '00080018', '', 'UI', 1],
        ['instanceAvailability', '00080056', '', 'CS', 1],
        ['timezoneOffsetFromUTC', '00080201', '', 'SH', 0],
        ['retrieveURL', '00081190', '', 'UR', 1],
        ['instanceNumber', '00200013', '', 'IS', 1],
        ['rows', '00280010', '', 'US', 0],
        ['columns', '00280011', '', 'US', 0],
        ['bitsAllocated', '00280100', '', 'US', 0],
        ['numberOfFrames', '00280008', '', 'IS', 0],
        ['studyUID', '0020000D', '', 'UI', 1],
        ['seriesUID', '0020000E', '', 'UI', 1],
        ['retrieveAETitle', '00080054', '', 'AE', 1]
    ];

    var key = buildResponse(doc.dataset, tags);
    var studyUID = 'NA';
    var seriesUID = 'NA';
    var instanceUID = 'NA';

    if (doc.dataset['0020000D'].Value[0]) {
        studyUID = doc.dataset['0020000D'].Value[0];
    }
    
    if (doc.dataset['0020000E'].Value[0]) {
        seriesUID = doc.dataset['0020000E'].Value[0];
    }

    if (doc.dataset['00080018'].Value[0]) {
        instanceUID = doc.dataset['00080018'].Value[0];
    }

    emit([studyUID, seriesUID, instanceUID, key], 1)
}