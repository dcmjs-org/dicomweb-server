module.exports = function (doc) {
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
    var key = {};
    var studyUID;
    var seriesUID;
    var instanceUID;
    if (doc.dataset) {
        studyUID = 'NA';
        if (doc.dataset['0020000D'].Value[0]) studyUID = doc.dataset['0020000D'].Value[0];
        seriesUID = 'NA';
        if (doc.dataset['0020000E'].Value[0]) seriesUID = doc.dataset['0020000E'].Value[0];
        instanceUID = 'NA';
        if (doc.dataset['00080018'].Value[0]) instanceUID = doc.dataset['00080018'].Value[0];
        var i;
        for (i = 0; i < tags.length; i++) {
            var tag = tags[i];
            var name = tag[0];
            var t = tag[1];
            var fallback = tag[2];
            var vr = tag[3];
            var required = tag[4];
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
                if (required) {
                    key[t] = {};
                    key[t].vr = vr
                }
            }
        }
        emit([studyUID, seriesUID, instanceUID, key], 1)
    }
}