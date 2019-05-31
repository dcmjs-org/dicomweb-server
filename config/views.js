module.exports.views = {
  wado_metadata: {
    map:
      "function(doc){var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];" +
      " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];" +
      " instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];" +
      " for(var t in doc.dataset){var fallback='';if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(doc.dataset[t].vr==='PN')" +
      " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}" +
      ' key[t].vr=doc.dataset[t].vr}}' +
      ' emit([studyUID,seriesUID,instanceUID],key);}}',
  },
  patients: {
    map:
      "function(doc){var tags=[['institution','00080080','','CS'],['patientID','00100020','','LO'],['patientName','00100010','','PN']" +
      " ,['patientBirthDate','00101030','','DA'],['patientSex','00100040','','CS'],['charset','00080005','','CS'],['retrieveURL','00081190','','UR']];var key={};" +
      ' if(doc.dataset){var i;for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};' +
      " if(doc.dataset[t].Value[0]!==''){if(vr==='PN')" +
      " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}" +
      ' key[t].vr=doc.dataset[t].vr||vr}else{key[t]={};' +
      ' key[t].vr=vr;}}' +
      ' emit(key,1)}}',
    reduce: '_count()',
  },
  qido_study_series: {
    map:
      "function(doc){if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];" +
      " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];" +
      " modality='NA'; if (doc.dataset['00080060'].Value[0]) modality=doc.dataset['00080060'].Value[0];" +
      ' emit([studyUID,modality,seriesUID],null)}}',
    reduce: '_approx_count_distinct()',
  },
  qido_study: {
    map:
      "function(doc){var studyTags=[['charset','00080005','','CS',1],['studyDate','00080020','','DA',1]," +
      " ['studyTime','00080030','','TM',1],['accessionNumber','00080050','','SH',1],['instanceAvailability','00080056','','CS',1]," +
      " ['modalitiesInStudy','00080061','','CS',1],['referringPhysicianName','00080090','','PN',1],['timezoneOffsetFromUTC','00080201','','SH',0]," +
      " ['retrieveURL','00081190','','UR',1],['patientName','00100010','','PN',1],['patientID','00100020','','LO',1],['patientBirthDate','00100030','','DA',1]," +
      " ['patientSex','00100040','','CS',1],['studyUID','0020000D','','UI',1],['studyID','00200010','','SH',1],['numberOfStudyRelatedSeries','00201206','','IS',1]," +
      " ['numberOfStudyRelatedInstances','00201208','','IS',1],['retrieveAETitle','00080054','','AE'],['studyDescription','00081030','','LO']];var studyKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];" +
      " var i;for(i=0;i<studyTags.length;i++){var tag=studyTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){if(doc.dataset[t].Value[0]!==''){studyKey[t]={};if(vr==='PN')" +
      " studyKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else studyKey[t].Value=[doc.dataset[t].Value[0]||fallback]}" +
      ' studyKey[t].vr=doc.dataset[t].vr||vr}else{if(required){studyKey[t]={};studyKey[t].vr=vr}}}' +
      ' emit([studyUID,studyKey],1)}}',
    reduce: '_count()',
  },
  qido_series: {
    map:
      "function(doc){var seriesTags=[['charset','00080005','','CS',1,],['modality','00080060','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0],['seriesDescription','0008103E','','LO',1],['retrieveURL','00081190','','UR',1]," +
      " ['seriesUID','0020000E','','UI',1],['seriesNumber','00200011','','IS',1],['numberOfSeriesRelatedInstances','00201209','','IS',1],['retrieveAETitle','00080054','','AE',0],['instanceAvailability','00080056','','CS',1],['studyUID','0020000D','','UI',0],['patientName','00100010','','PN',1],['patientID','00100020','','LO',1]];" +
      " var seriesKey={};if(doc.dataset){studyUID='NA'; if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];" +
      " seriesUID='NA'; if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];" +
      " var i;for(i=0;i<seriesTags.length;i++){var tag=seriesTags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){seriesKey[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')" +
      " seriesKey[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else seriesKey[t].Value=[doc.dataset[t].Value[0]||fallback]}" +
      ' seriesKey[t].vr=doc.dataset[t].vr||vr}else{if(required){seriesKey[t]={};seriesKey[t].vr=vr}}}' +
      ' emit([studyUID,seriesUID,seriesKey],1)}}',
    reduce: '_count()',
  },
  qido_instances: {
    map:
      "function(doc){var tags=[['charset','00080005','','CS',1],['SOPClassUID','00080016','','UI',1],['SOPInstanceUID','00080018','','UI',1],['instanceAvailability','00080056','','CS',1],['timezoneOffsetFromUTC','00080201','','SH',0]," +
      " ['retrieveURL','00081190','','UR',1],['instanceNumber','00200013','','IS',1],['rows','00280010','','US',0],['columns','00280011','','US',0],['bitsAllocated','00280100','','US',0],['numberOfFrames','00280008','','IS',0],['studyUID','0020000D','','UI',1]," +
      " ['seriesUID','0020000E','','UI',1],['retrieveAETitle','00080054','','AE',1]];var key={};if(doc.dataset){studyUID='NA';if (doc.dataset['0020000D'].Value[0]) studyUID=doc.dataset['0020000D'].Value[0];seriesUID='NA';if (doc.dataset['0020000E'].Value[0]) seriesUID=doc.dataset['0020000E'].Value[0];instanceUID='NA'; if (doc.dataset['00080018'].Value[0]) instanceUID=doc.dataset['00080018'].Value[0];var i;" +
      " for(i=0;i<tags.length;i++){var tag=tags[i];var name=tag[0];var t=tag[1];var fallback=tag[2];var vr=tag[3];var required=tag[4];if(doc.dataset[t]&&doc.dataset[t].Value&&doc.dataset[t].Value[0]){key[t]={};if(doc.dataset[t].Value[0]!==''){if(vr==='PN')" +
      " key[t].Value=[{'Alphabetic':doc.dataset[t].Value[0]||fallback}];else key[t].Value=[doc.dataset[t].Value[0]||fallback]}" +
      ' key[t].vr=doc.dataset[t].vr||vr}else{if(required){key[t]={};key[t].vr=vr}}}' +
      ' emit([studyUID,seriesUID,instanceUID,key],1)}}',
    reduce: '_count()',
  },
};
