/* eslint-disable */
var buildResponse = require('./buildResponse');
var { seriesTags } = require('./viewTags');

module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var seriesKey = buildResponse(doc.dataset, seriesTags);
    var studyUID = 'NA';
    var seriesUID = 'NA';

    if (doc.dataset['0020000D'].Value[0]) {
        studyUID = doc.dataset['0020000D'].Value[0];
    }
    
    if (doc.dataset['0020000E'].Value[0]) {
        seriesUID = doc.dataset['0020000E'].Value[0];
    }

    emit([studyUID, seriesUID, JSON.stringify([seriesKey['00080005'],seriesKey['00080060'],seriesKey['00080201'],seriesKey['0008103E'],seriesKey['00081190'],seriesKey['0020000E'],seriesKey['00200011'],seriesKey['00201209'],seriesKey['00080054'],seriesKey['00080056'],seriesKey['0020000D'],seriesKey['00100010'],seriesKey['00100020']])], null)
}