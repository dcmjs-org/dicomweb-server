module.exports = function (doc) {
    var tags = [
        ['institution', '00080080', '', 'CS'],
        ['patientID', '00100020', '', 'LO'],
        ['patientName', '00100010', '', 'PN'],
        ['patientBirthDate', '00101030', '', 'DA'],
        ['patientSex', '00100040', '', 'CS'],
        ['charset', '00080005', '', 'CS'],
        ['retrieveURL', '00081190', '', 'UR']
    ];
    var key = {};
    if (doc.dataset) {
        var i;
        for (i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var name = tag[0];
            var t = tag[1];
            var fallback = tag[2];
            var vr = tag[3];
            if (doc.dataset[t] && doc.dataset[t].Value && doc.dataset[t].Value[0]) {
                key[t] = {};
                if (doc.dataset[t].Value[0] !== '') {
                    if (vr === 'PN') key[t].Value = [{
                        'Alphabetic': doc.dataset[t].Value[0] || fallback
                    }];
                    else key[t].Value = [doc.dataset[t].Value[0] || fallback]
                }
                key[t].vr = doc.dataset[t].vr || vr
            } else {
                key[t] = {};
                key[t].vr = vr;
            }
        }
        emit(key, 1)
    }
}