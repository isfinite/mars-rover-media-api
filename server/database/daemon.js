var http = require('http')
	, req = require('request')
	, imgModel = require('../models/image').image
	, solModel = require('../models/sol').sol
	, dbDriver = require('./driver');

/**********
* Get JSON from url
*
* @param {Function} function to be called after request is completed
* @return {Object} Parsed JSON object for the rover manifest
*
**********/
function getJSON(url, callback) {
	req(url, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

/**********
* Get weather data from MAAS Api
*
* @param {String} Sol for which weather data is being requested
*      - {Function} Function to be called after request is completed
* @return {Object} Parsed JSON object for the weather data received
*
**********/
function getWeatherData(sol, callback) {
	req('http://marsweather.ingenology.com/v1/archive/?sol=' + sol, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

/**********
* Gets and parses specific image data
*
* @param {Object} Image data to be converted into a new object format
*      - {Function} Function to be called after request is completed
* @return {Object} Newly defined image data object
*
**********/
function getImageData(image, callback) {
	var newImage =  new imgModel();
	var _req = require('http').get(image.urlList, function(resp) {
		require('imagesize')(resp, function(err, res) {
			_req.abort();

			newImage.rover = 'msl';
			newImage.sclk = image.sclk;
			newImage.attitude = image.attitude;

			newImage.url.raw = image.urlList;
			newImage.url.site = 'http://mars.jpl.nasa.gov/msl/multimedia/raw/?rawid=' + image.itemName;
			newImage.url.label = image.pdsLabelUrl;

			newImage.location.site = image.site;
			newImage.location.drive = image.drive;
			
			newImage.timestamps.created = new Date().toISOString();
			newImage.timestamps.captured = image.utc;
			newImage.timestamps.added = image.dateAdded;
			
			newImage.properties.type = image.sampleType;
			newImage.properties.width = res.width;
			newImage.properties.height = res.height;
			newImage.properties.filesize = resp.headers['content-length'];

			newImage.camera.instrument = image.instrument;
			newImage.camera.cameraModelComponentList = image.cameraModelComponentList;
			newImage.camera.cameraPosition = image.cameraPosition;
			newImage.camera.cameraModelType = image.cameraModelType;
			newImage.camera.cameraVector = image.cameraVector;
			newImage.camera.subframeRect = image.subframeRect;
			newImage.camera.mastEl = image.mastEl;
			newImage.camera.mastAz = image.mastAz;
			newImage.camera.xyz = image.xyz;

			callback(newImage);
		});
	});
}

///--- Exports

exports.run = function() {
	getJSON('http://mars.jpl.nasa.gov/msl-raw-images/image/image_manifest.json', function(data) {
		var sols = data.sols.slice(0);

		dbDriver.db.find({ stats: true }, function(err, doc) {
			var stats = doc.shift();
			(function processSol() {
				if (sols.length <= 0) {
					dbDriver.db.update({ stats: true }, stats, {});
					return;
				}
				var item = sols.shift();
				if (item.num_images > 0) {
					getWeatherData(item.sol, function(weather) {
						var solData = new solModel();

						console.log('Processing sol ... ' + sols.length + ' remaining');

						solData.sol = item.sol;
						solData.weather = (weather.count > 0) ? weather : null;

						getJSON(item.catalog_url, function(data) {
							var images = data.images.slice(0);

							(function processImage() {
								getImageData(images.shift(), function(img) {
									console.log('Processing image ... ' + images.length + ' remaining');
									
									// Update global stats
									stats.totals.media[img.properties.type]++;
									stats.totals.cameras[img.camera.instrument] = ++stats.totals.cameras[img.camera.instrument] || 1;

									// Insert new image data into current sol images array
									solData.images.push(img);


									if (images.length <= 0) {
										dbDriver.db.update({ sols: { $exists: true } }, { $push: { sols: solData } }, {}, processSol);
									} else {
										processImage();
									}
								});
							})();
						});
					});
				}
			})();
		});
	});
}