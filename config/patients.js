/* eslint-disable */
var buildResponse = require('./buildResponse');
var { patientTags } = require('./viewTags');

module.exports = function applyView(doc) {
    if (!doc.dataset) {
        return;
    }

    var key = buildResponse(doc.dataset, patientTags);

    emit(JSON.stringify([key['00080080'],key['00100020'],key['00100010'],key['00100030'],key['00100040'],key['00080005'],key['00081190']]), null)
}