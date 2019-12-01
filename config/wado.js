module.exports = function (doc) {
  if (!doc.dataset) {
    return;
  }

  // Doesn't seem to be supported in CouchDB
  // https://github.com/jo/couch64/issues/1
  // const btoa = require('./btoa.js');

  /**
   * Binary to ASCII (encode data to Base64)
   * @param {String} data
   * @returns {String}
   *
   * https://base64.guru/developers/javascript/examples/polyfill
   */
  function btoa (data) {
    var ascii = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var len = data.length - 1;
    var i = -1;
    var b64 = "";

    while (i < len) {
      var code = data.charCodeAt(++i) << 16 | data.charCodeAt(++i) << 8 | data.charCodeAt(++i);
      b64 += ascii[(code >>> 18) & 63] + ascii[(code >>> 12) & 63] + ascii[(code >>> 6) & 63] + ascii[code & 63];
    }

    var pads = data.length % 3;
    if (pads > 0) {
      b64 = b64.slice(0, pads - 3);

      while (b64.length % 4 !== 0) {
        b64 += "=";
      }
    }

    return b64;
  }

  function getBulkDataURI(studyUID, seriesUID, instanceUID, tag) {
    // e.g. http://server.dcmjs.org/dcm4chee-arc/aets/DCM4CHEE/rs/studies/1.2.840.113619.2.5.1762583153.215519.978957063.78/series/1.2.840.113619.2.5.1762583153.215519.978957063.121/instances/1.2.840.113619.2.5.1762583153.215519.978957063.128/bulkdata/00431029
    var server = '';
    var bulkDataURI = server;
    bulkDataURI += '/studies/' + studyUID;
    bulkDataURI += '/series/' + seriesUID;
    bulkDataURI += '/instances/' + instanceUID;
    bulkDataURI += '/bulkdata/' + tag.toUpperCase();

    return bulkDataURI;
  }

  var key = {};
  var studyUID = "NA";
  var seriesUID = "NA";
  var instanceUID = "NA";
  var fallback = "";

  if (doc.dataset["0020000D"].Value[0]) {
    studyUID = doc.dataset["0020000D"].Value[0];
  }

  if (doc.dataset["0020000E"].Value[0]) {
    seriesUID = doc.dataset["0020000E"].Value[0];
  }

  if (doc.dataset["00080018"].Value[0]) {
    instanceUID = doc.dataset["00080018"].Value[0];
  }

  for (var t in doc.dataset) {
      var dataset = doc.dataset[t];
      if (!dataset || !dataset.Value || !dataset.Value.length) {
        continue;
      }

      var vr = dataset.vr;
      var Value = dataset.Value;
      key[t] = {
        vr: vr
      };

      if (Value[0] === "") {
        continue;
      }

      console.log(Value);

      switch (vr) {
        case "PN":
          key[t].Value = [{
            "Alphabetic": Value[0] || fallback
          }];
          break;
        case "DS":
          // Note: Some implementations, such as dcm4chee,
          // include .0 on all decimal strings, but we don't.
          key[t].Value = Value.map(parseFloat);  
          break;
        case "IS":
          key[t].Value = Value.map(function(a) {
            return parseInt(a, 10)
          });
          
          break;
        case "UN":
          // TODO: Not sure what the actual limit should be,
          // but dcm4chee will use BulkDataURI if the Value
          // is too large. We should do the same
          if (Value[0].length < 100) {
            key[t].InlineBinary = btoa(Value[0]);
          } else {
            key[t].BulkDataURI = getBulkDataURI(studyUID, seriesUID, instanceUID, t);
          }

          break;
        case "OW":
          key[t].BulkDataURI = getBulkDataURI(studyUID, seriesUID, instanceUID, t);
          break;
        default:
          key[t].Value = Value;
      }
  }

  emit([studyUID, seriesUID, instanceUID], key);
}