'use strict';

var fs = require('fs')
	, path = require('path');

module.exports.log = function() {
	if (process.env.NOISY) console.log.apply(console, arguments);
}

module.exports.pad = function(originalNum, width, padChar) {
	var numAsString = originalNum.toString();
	
	// Return originalNum since its already at width
	if (numAsString.length >= width) return originalNum;

	return new Array(++width - numAsString.length).join(padChar || 0) + numAsString;
}

module.exports.walk = function(modulesPath, excludeDir, callback) {
	fs.readdirSync(modulesPath).forEach(function(file) {
		var newPath = path.join(modulesPath, file)
			, stat = fs.statSync(newPath);

		if (stat.isFile() && /(.*)\.(js|coffee)$/.test(file)) {
			callback(newPath);
		} else if (stat.isDirectory() && file !== excludeDir) {
			exports.walk(newPath, excludeDir, callback);
		}
	});
}