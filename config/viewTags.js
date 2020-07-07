/* eslint-disable */
const studyTags = [
    ['studyUID', '0020000D', '', 'UI', 1],
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
    ['studyID', '00200010', '', 'SH', 1],
    ['numberOfStudyRelatedSeries', '00201206', '', 'IS', 1],
    ['numberOfStudyRelatedInstances', '00201208', '', 'IS', 1],
    ['retrieveAETitle', '00080054', '', 'AE', 0],
    ['studyDescription', '00081030', '', 'LO', 1],
  ];

var seriesTags = [
    ['charset', '00080005', '', 'CS', 1,],
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

var instanceTags = [
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

var patientTags = [
    ['institution', '00080080', '', 'CS'],
    ['patientID', '00100020', '', 'LO'],
    ['patientName', '00100010', '', 'PN'],
    ['patientBirthDate', '00100030', '', 'DA'],
    ['patientSex', '00100040', '', 'CS'],
    ['charset', '00080005', '', 'CS'],
    ['retrieveURL', '00081190', '', 'UR']
];


module.exports = {
    studyTags,
    seriesTags,
    instanceTags,
    patientTags
}