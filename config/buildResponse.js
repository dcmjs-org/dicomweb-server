/* eslint-disable */
const returnValueFromVR = require('./returnValueFromVR');

module.exports = function buildResponse(dataset, fields) {
	var response = {};
	var val;
	
	if (fields && fields.length) {
		for (var i = 0; i < fields.length; i++) {
	        var tag = fields[i];
	        var t = tag[1];
	        var fieldVR = tag[3];
	        var required = tag[4];

	        val = returnValueFromVR(dataset, dataset[t], t, fieldVR, required);

	        if (val) {
	        	response[t] = val;	
	        }
	    }
	} else {
		for (var t in dataset) {
	        val = returnValueFromVR(dataset, dataset[t], t, dataset[t].vr, false, true);

	        if (val) {
	        	response[t] = val;	
	        }
	    }
	}

	return response;
}