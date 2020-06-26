/* eslint-disable */
var buildResponse = require('./buildResponse');
var { studyTags } = require('./viewTags');

module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var studyKey = buildResponse(doc.dataset, studyTags);
    var studyUID = 'NA';
    
    if (doc.dataset['0020000D'].Value[0]) {
        studyUID = doc.dataset['0020000D'].Value[0];
    }
    var seriesUID = 'NA';
    var modality = 'NA';
    if (doc.dataset['0020000E'].Value[0]) {
        seriesUID = doc.dataset['0020000E'].Value[0];
    }
    if (doc.dataset['00080060'].Value[0]) {
        modality = doc.dataset['00080060'].Value[0];
    }

    emit([studyUID, modality, seriesUID, JSON.stringify([studyKey['0020000D'],studyKey['00080005'], studyKey['00080020'],studyKey['00080030'],studyKey['00080050'],studyKey['00080056'],studyKey['00080061'], studyKey['00080090'], studyKey['00080201'],studyKey['00081190'], studyKey['00100010'] , studyKey['00100020'],studyKey['00100030'],studyKey['00100040'], studyKey['00200010'], studyKey['00201206'] , studyKey['00201208'], studyKey['00080054'],  studyKey['00081030']])], null)
}