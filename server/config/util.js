'use strict';

var fs = require('fs')
	, path = require('path');

exports.walk = function(modulesPath, excludeDir, callback) {
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