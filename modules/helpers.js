var constants = require('../modules/constants.js');

function output(msg) {
	if (!constants.DEBUG) return;
	console.log(msg);
}

function pad(num) {
	var s = num + ''
		, origLength = s.length;
    while (s.length < ((4 + origLength) - origLength)) s = '0' + s;
    return s;
}

exports.toObject = function(arr) {
	var obj = {};
	for (var i = 0, len = arr.length; i < len; i++) obj[i] = arr[i];
	return obj;
}

exports.output = output;