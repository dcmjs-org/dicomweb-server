/* eslint-disable */
module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var studyUID = 'NA';
    var seriesUID = 'NA';
    var modality = 'NA';

    if (doc.dataset['0020000D'].Value[0]) {
        studyUID = doc.dataset['0020000D'].Value[0];
    }
    
    if (doc.dataset['0020000E'].Value[0]) {
        seriesUID = doc.dataset['0020000E'].Value[0];
    }

    if (doc.dataset['00080060'].Value[0]) {
        modality = doc.dataset['00080060'].Value[0];
    }

    emit([studyUID, modality, seriesUID], null)
}