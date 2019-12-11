/* eslint-disable */

// Doesn't seem to be supported in CouchDB
// https://github.com/jo/couch64/issues/1
// var btoa = require('./btoa.js');

/**
 * Binary to ASCII (encode data to Base64)
 * @param {String} data
 * @returns {String}
 *
 * https://base64.guru/developers/javascript/examples/polyfill
 */
module.exports = function btoa(data) {
  var ascii = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var len = data.length - 1;
  var i = -1;
  var b64 = '';

  while (i < len) {
    var code = (data.charCodeAt(++i) << 16) | (data.charCodeAt(++i) << 8) | data.charCodeAt(++i);
    b64 +=
      ascii[(code >>> 18) & 63] +
      ascii[(code >>> 12) & 63] +
      ascii[(code >>> 6) & 63] +
      ascii[code & 63];
  }

  var pads = data.length % 3;
  if (pads > 0) {
    b64 = b64.slice(0, pads - 3);

    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
  }

  return b64;
};
