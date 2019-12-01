module.exports = function (doc) {
    var seriesTags = [
        ['charset', '00080005', '', 'CS', 1, ],
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
    var seriesKey = {};
    var studyUID;
    var seriesUID;
    if (doc.dataset) {
        studyUID = 'NA';
        if (doc.dataset['0020000D'].Value[0]) studyUID = doc.dataset['0020000D'].Value[0];
        seriesUID = 'NA';
        if (doc.dataset['0020000E'].Value[0]) seriesUID = doc.dataset['0020000E'].Value[0];
        var i;
        for (i = 0; i < seriesTags.length; i++) {
            var tag = seriesTags[i];
            var name = tag[0];
            var t = tag[1];
            var fallback = tag[2];
            var vr = tag[3];
            var required = tag[4];
            if (doc.dataset[t] && doc.dataset[t].Value && doc.dataset[t].Value[0]) {
                seriesKey[t] = {};
                if (doc.dataset[t].Value[0] !== '') {
                    if (vr === 'PN') seriesKey[t].Value = [{
                        'Alphabetic': doc.dataset[t].Value[0] || fallback
                    }];
                    else seriesKey[t].Value = [doc.dataset[t].Value[0] || fallback]
                }
                seriesKey[t].vr = doc.dataset[t].vr || vr
            } else {
                if (required) {
                    seriesKey[t] = {};
                    seriesKey[t].vr = vr
                }
            }
        }
        emit([studyUID, seriesUID, seriesKey], 1)
    }
}