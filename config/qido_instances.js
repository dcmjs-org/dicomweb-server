/* eslint-disable */
var buildResponse = require('./buildResponse');
var { instanceTags } = require('./viewTags');

module.exports = function applyView(doc) {
    
    var key = buildResponse(doc.dataset, instanceTags);
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

    emit([studyUID, seriesUID, instanceUID, JSON.stringify([key['00080005'],key['00080016'],key['00080018'],key['00080056'],key['00080201'],key['00081190'],key['00200013'],key['00280010'],key['00280011'],key['00280100'],key['00280008'],key['0020000D'],key['0020000E'],key['00080054']])], null)
}