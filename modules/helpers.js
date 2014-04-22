var constants = require('../modules/constants.js');

function output(msg) {
	if (!constants.DEBUG) return;
	console.log(msg);
}

exports.output = output;