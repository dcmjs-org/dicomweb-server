/* eslint-disable */
var getBulkDataURI = require('./getBulkDataURI');
var btoa = require('./btoa.js');

module.exports = function returnValueFromVR(dataset, field, tag, fieldVR, required, withVR) {
  if (!field && fieldVR && !!required) {
    if (withVR) {
      // Special case for things like numberOfStudyRelatedSeries
      // which are built after the view
      return {
        'vr': fieldVR
      };
    }
    return;
  } else if (!field) {
    return;
  }

  var Value = field.Value;
  var vr = field.vr;

  var result = '';
  if (withVR) {
    result = {
      'vr': vr
    };
  }

  var studyUID = 'NA';
  var seriesUID = 'NA';
  var instanceUID = 'NA';

  if (dataset['0020000D'].Value[0]) {
    studyUID = dataset['0020000D'].Value[0];
  }

  if (dataset['0020000E'].Value[0]) {
    seriesUID = dataset['0020000E'].Value[0];
  }

  if (dataset['00080018'].Value[0]) {
    instanceUID = dataset['00080018'].Value[0];
  }

  switch (vr) {
    case "PN":
      if (Value && Value[0]) {
        if (withVR) {          
          if (Value[0].Alphabetic)
            result.Value = [
              {
                Alphabetic: Value[0].Alphabetic,
              },
            ];
          else
            result.Value = [
              {
                "Alphabetic": Value[0]
              },
            ];
        } else result = Value;
      }
      break;
    case "DS":
      // Note: Some implementations, such as dcm4chee,
      // include .0 on all decimal strings, but we don't.
      if (withVR) result.Value = Value.map(parseFloat);
      else result = Value.map(parseFloat);
      break;
    case "IS":
      if (withVR)
        result.Value = Value.map(function(a) {
          return parseInt(a, 10);
        });
      else
        result = Value.map(function(a) {
          return parseInt(a, 10);
        });
      break;
    case "UN":
      // TODO: Not sure what the actual limit should be,
      // but dcm4chee will use BulkDataURI if the Value
      // is too large. We should do the same
      if (Value[0].length < 100) {
        var converted = btoa(Value[0]);
        if (converted) {
          if (withVR) result.InlineBinary = converted;
          else result = converted;
        }
      } else {
        if (withVR) result.BulkDataURI = getBulkDataURI(studyUID, seriesUID, instanceUID, tag);
        else result = getBulkDataURI(studyUID, seriesUID, instanceUID, tag);
      }

      break;
    case "OW":
      if (withVR) result.BulkDataURI = getBulkDataURI(studyUID, seriesUID, instanceUID, tag);
      else result = getBulkDataURI(studyUID, seriesUID, instanceUID, tag);
      break;
    default:
      if (
        Value &&
        Value.length &&
        !(Value.length === 1 && (Value[0] === undefined || Value[0] === ''))
      ) {
        if (withVR) result.Value = Value;
        else result = Value;
      }
  }

  return result;
};
