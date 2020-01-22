/* eslint-disable */
module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var tags = [
        ['institution', '00080080', '', 'CS'],
        ['patientID', '00100020', '', 'LO'],
        ['patientName', '00100010', '', 'PN'],
        ['patientBirthDate', '00100030', '', 'DA'],
        ['patientSex', '00100040', '', 'CS'],
        ['charset', '00080005', '', 'CS'],
        ['retrieveURL', '00081190', '', 'UR']
    ];

    var key = buildResponse(doc.dataset, tags);

    emit(key, 1)
}