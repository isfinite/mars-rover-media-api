var http = require('http')
	, req = require('request')
	, imgModel = require('../models/image').image
	, dbDriver = require('./driver');

/**
* Get JSON from url
*
* @method getJSON
* @param {Function} function to be called after request is completed
* @return {Object} Parsed JSON object for the rover manifest
*/
function getJSON(url, callback) {
	req(url, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

/**
* Get weather data from MAAS Api
*
* @method getWeatherData
* @param {String} Sol for which weather data is being requested
* @param {Function} Function to be called after request is completed
* @return {Object} Parsed JSON object for the weather data received
*/
function getWeatherData(sol, callback) {
	req('http://marsweather.ingenology.com/v1/archive/?sol=' + sol, function(err, resp, body) {
		callback(JSON.parse(body));
	});
}

/**
* Gets and parses specific image data
*
* @method getImageData
* @param {Object} Image data to be converted into a new object format
* @param {Function} Function to be called after request is completed
* @return {Object} Newly defined image data object
*/
function getImageData(image, callback) {
	var newImage =  new imgModel();
	var _req = require('http').get(image.urlList, function(resp) {
		require('imagesize')(resp, function(err, res) {
			_req.abort();

			// Skip this image, it isnt responding with a filesize
			if (!resp.headers['content-length']) callback();

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
			newImage.properties.width = res && res.width || null;
			newImage.properties.height = res && res.height || null;
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

/**
* Parses data for each image in that Sol
*
* @method processSolData
* @param {Object} Sol data from manifest file
* @param {Function} Function to be called after request is completed
* @return {void}
*/
function processSolData(item, callback) {
	getWeatherData(item.sol, function(weather) {
		getJSON(item.catalog_url, function(data) {

			var images = data.images.slice(0)
				, imageDataToAdd = [];

			(function processImage() {

				console.log('Processing image for Sol ' + item.sol + ' ... ' + images.length + ' remaining');

				getImageData(images.shift(), function(img) {

					if (img) imageDataToAdd.push(img);

					if (images.length <= 0) {
						var solData = {
							sol: item.sol
							, weather: (weather.count > 0) ? weather : null
							, images: imageDataToAdd
						}

						dbDriver.db.update({ sol: item.sol }, solData, { upsert: true }, callback);
					} else {
						processImage();
					}
				});

			})();
		});
	});
}

///--- Exports

exports.run = function(sol, len) {
	getJSON(process.env.CURIOSITY_MANIFEST, function(data) {
		
		var sols = data.sols.slice(0);

		(function processSol() {

			// No Sols left to process
			if (sols.length <= 0) {
				console.log('Finished updating all Sol images');
				return;
			}
			
			// Retrieve next Sol data from beginning of array
			var item = sols.shift();
			
			// Manifest shows no images for this Sol so skip it
			if (item.num_images <= 0) {
				processSol();
				return;
			}

			console.log('Processing sol ' + item.sol + ' ... ' + sols.length + ' remaining');

			// Get stored data for this Sol
			dbDriver.db.findOne({ sol: item.sol }, function(err, doc) {
				// Test if manifest and db Sol data is out of sync
				// If out of sync [re]process that Sol data
				// If db and manifest match skip to next Sol
				(doc && doc.images.length === item.num_images) ? processSol(): processSolData(item, processSol);
			});

		})();
	});
}