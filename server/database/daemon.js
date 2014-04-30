var http = require('http')
	, req = require('request');

function getManifest(callback) {
	req('http://mars.jpl.nasa.gov/msl-raw-images/image/image_manifest.json', function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

function getSolManifest(manifest) {
	req(manifest.catalog_url, function(err, resp, body) {
		console.log(JSON.parse(body));
	});
}

exports.run = function() {
	getManifest(function(data) {
		var sols = data.sols.slice(0, 1);

		do {
			getSolManifest(sols.shift());
		} while (sols.length > 0);

	});
}