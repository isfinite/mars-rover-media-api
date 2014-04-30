var http = require('http')
	, req = require('request');

function getManifest(callback) {
	req('http://mars.jpl.nasa.gov/msl-raw-images/image/image_manifest.json', function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

function getSolManifest(manifest, callback) {
	req(manifest.catalog_url, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

function getWeatherData(sol, callback) {
	req('http://marsweather.ingenology.com/v1/archive/?sol=' + sol, callback);
}

exports.run = function() {
	getManifest(function(data) {
		var sols = data.sols.slice(0, 1);

		do {
			var item = sols.shift();
			getWeatherData(item.sol, function(err, resp, body) {
				var weather = JSON.parse(body);
				getSolManifest(item, function(data) {
					var images = data.images.slice(0);
					do {
						var image = images.shift();
						console.log(image);
					} while (images.length > 0);
				});
			});
		} while (sols.length > 0);

	});
}