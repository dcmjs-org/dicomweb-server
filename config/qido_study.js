module.exports = function (doc) {
    var studyUID;
    var studyTags = [
        ['charset', '00080005', '', 'CS', 1],
        ['studyDate', '00080020', '', 'DA', 1],
        ['studyTime', '00080030', '', 'TM', 1],
        ['accessionNumber', '00080050', '', 'SH', 1],
        ['instanceAvailability', '00080056', '', 'CS', 1],
        ['modalitiesInStudy', '00080061', '', 'CS', 1],
        ['referringPhysicianName', '00080090', '', 'PN', 1],
        ['timezoneOffsetFromUTC', '00080201', '', 'SH', 0],
        ['retrieveURL', '00081190', '', 'UR', 1],
        ['patientName', '00100010', '', 'PN', 1],
        ['patientID', '00100020', '', 'LO', 1],
        ['patientBirthDate', '00100030', '', 'DA', 1],
        ['patientSex', '00100040', '', 'CS', 1],
        ['studyUID', '0020000D', '', 'UI', 1],
        ['studyID', '00200010', '', 'SH', 1],
        ['numberOfStudyRelatedSeries', '00201206', '', 'IS', 1],
        ['numberOfStudyRelatedInstances', '00201208', '', 'IS', 1],
        ['retrieveAETitle', '00080054', '', 'AE'],
        ['studyDescription', '00081030', '', 'LO']
    ];
    var studyKey = {};
    if (doc.dataset) {
        studyUID = 'NA';
        if (doc.dataset['0020000D'].Value[0]) studyUID = doc.dataset['0020000D'].Value[0];
        var i;
        for (i = 0; i < studyTags.length; i++) {
            var tag = studyTags[i];
            var name = tag[0];
            var t = tag[1];
            var fallback = tag[2];
            var vr = tag[3];
            var required = tag[4];
            if (doc.dataset[t] && doc.dataset[t].Value && doc.dataset[t].Value[0]) {
                if (doc.dataset[t].Value[0] !== '') {
                    studyKey[t] = {};
                    if (vr === 'PN') studyKey[t].Value = [{
                        'Alphabetic': doc.dataset[t].Value[0] || fallback
                    }];
                    else studyKey[t].Value = [doc.dataset[t].Value[0] || fallback]
                }
                studyKey[t].vr = doc.dataset[t].vr || vr
            } else {
                if (required) {
                    studyKey[t] = {};
                    studyKey[t].vr = vr
                }
            }
        }
        emit([studyUID, studyKey], 1)
    }
}