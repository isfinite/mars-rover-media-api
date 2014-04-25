var constants = require('../modules/constants.js');

exports.output = function(msg) {
	if (!constants.DEBUG) return;
	console.log(msg);
}

exports.pad = function(num) {
	var s = num + ''
		, origLength = s.length;
    while (s.length < ((4 + origLength) - origLength)) s = '0' + s;
    return s;
}

exports.cleanString = function(str) {
	return str.replace(/ /g, '_').replace(/:/g, '');
}