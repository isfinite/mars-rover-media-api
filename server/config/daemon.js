var http = require('http')
	, req = require('request')
	, dbDriver = require('../config/driver')
	, cheerio = require('cheerio')
	, util = require('../config/util')
	, server = require('../../server')
	, camerasRaw;

/**
* Create camera urls for the rover and Sol
*
* @method getCameraUrls
* @param {String} Rover to be used
* @param {Number} Sol to be used
* @return {Array} Url's for each camera of this Sol and rover
*/
function getCameraUrls(rover, sol) {
	camerasRaw = camerasRaw || {
		'F': 'FHAZ'
		, 'R': 'RHAZ'
		, 'N': 'NAV'
		, 'P': 'PAN'
		, 'M': 'MICRO'
		, 'E': 'EDL'
	};

	var cameraKeys = Object.keys(camerasRaw)
		, i = 0
		, len = cameraKeys.length
		, urls = [];

	for ( ; i < len; i++ ) urls.push(process.env.ROVER_URL + rover + '_' + cameraKeys[i].toLowerCase() + util.pad(sol, 3) + '_text' + process.env.ROVER_URL_EXT);
	
	return urls;
}

/**
* Gets and parses specific image data
*
* @method getImageData
* @param {Object} Image data to be converted into a new object format
* @param {Function} Function to be called after request is completed
* @return {Object} Newly defined image data object
*/
function getImageProperties(url, callback) {
	var _req = http.get(url, function(resp) {
		require('imagesize')(resp, function(err, res) {
			_req.abort();
			callback({
				filesize: resp.headers['content-length'] || null
				, width: res && res.width || null
				, height: res && res.height || null
			});
		});
	})
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
	req(process.env.MAAS_URL + item.sol, function(err, resp, body) {
		var weather = JSON.parse(body);

		req(item.catalog_url, function(err, resp, body) {
			data = JSON.parse(body);

			var images = data.images.slice(0)
				, imageDataToAdd = [];

			(function processImage() {

				util.log('Processing image for Sol ' + item.sol + ' ... ' + images.length + ' remaining');

				var img = images.shift();

				img.rover = 'Curiosity';
				img.timestamps = {
					created: new Date().toISOString()
					, captured: img.utc
					, added: img.dateAdded
				}
				img.url = {
					raw: img.urlList
					, site: 'http://mars.jpl.nasa.gov/msl/multimedia/raw/?rawid=' + img.itemName
					, label: img.pdsLabelUrl
				}
				
				getImageProperties(img.url.raw, function(props) {
					img.properties = {
						type: img.sampleType
						, filesize: props.filesize
						, width: props.width
						, height: props.height
					}

					imageDataToAdd.push(img);

					if (images.length <= 0) {
						dbDriver.db.update({
							sol: item.sol 
						}
						, {
							sol: item.sol
							, weather: (weather.count > 0) ? weather : null
							, images: imageDataToAdd
						}
						, {
							upsert: true
						}
						, callback);
					} else {
						processImage();
					}
				});
			})();
		});
	});
}

/**
* Manifest files for these rovers do exist so the data can be
* extracted directly from the JSON files themeselves
*
* @method buildRoverManifest
* @param {String} Name of rover that need manifests built
* @param {Function} Function to be called
* @return {void}
*/
function parseRoverManifest(rover, callback) {
	req(process.env[rover.toUpperCase() + '_MANIFEST'], function(err, resp, body) {
		data = JSON.parse(body);
		
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

/**
* Images for the Spirit and Opportunity rovers are broken out into
* separate url's for each camera. This method takes an array of url's,
* tests them for statusCode 200 and parses each image. After all the url's have
* been run returns the images data as an array
*
* @method getAllImages
* @param {Array} Images array to be returned in the callback
* @param {Array} Url's to parse images from
* @param {Number} Sol to be used
* @param {Function} Callback function
* @return {Array} Parsed image data
*/
function getAllImages(images, urls, sol, callback) {
	if (urls.length <= 0) {
		callback(images);
		return;
	}

	var url = urls.shift();

	req(url, function(err, resp, body) {
		if (resp.statusCode !== 200) {
			getAllImages(images, urls, sol, callback);
			return;
		}

		util.log('Processing url ' + url);

		require('../models/stats').stats(function(data) {
			server.io.sockets.emit('stats', data);
		});

		var imgElements = cheerio.load(body)('a[href*="' + resp.req._header.match(/\d+/g).shift() + '/"]').toArray();

		(function parseImageData() {
			if (imgElements.length <= 0) {
				getAllImages(images, urls, sol, callback);
				return;
			}

			var element = imgElements.shift()
				, img = {}
				, filenameParts = element.attribs.href.split('/').pop().split('.')
				, filename = { file: filenameParts.shift(), ext: '.' + filenameParts.shift() }
				, roverCode = filename.file.substr(0, 1) >> 0
				, cameraIdent = filename.file.substr(1, 1)
				, rootUrl = process.env.ROVER_URL + roverCode + '/' + cameraIdent.toLowerCase() + '/' + util.pad(sol, 3) + '/' + filename.file;

			img.rover = (roverCode === 1) ? 'opportunity' : 'spirit';

			// Camera name + camera eye
			img.camera = {
				instrument: camerasRaw[cameraIdent] + '_' + filename.file.substr(23, 1)
			}
			
			// Spacecraft clock, number of seconds since January 1, 2000 11:58:55.816 UTC, convert to `number`
			img.sclk = filename.file.substr(2, 9) >> 0;
			
			// Using spacecraft clock as a base to calculate datetime image was taken
			img.timestamps = {
				captured: new Date(new Date('January 1, 2000 11:58:55 UTC').setSeconds(img.sclk))
				, created: new Date().toISOString()
			}

			img.location = {
				site: filename.file.substr(14, 2)
				, drive: filename.file.substr(16, 2)
			}

			img.url = {
				raw: rootUrl + filename.ext
				, site: rootUrl + process.env.ROVER_URL_EXT.toUpperCase()
			}

			getImageProperties(img.url.raw, function(props) {
				img.properties = {
					filesize: props.filesize
					, width: props.width
					, height: props.height
				}
				images.push(img);
				util.log('Image added ... %d images remaining', imgElements.length);
				parseImageData();
			});
		})();

	});
}

/**
* Manifest files for these rovers don't exist so the data needs to
* be scraped from the html
*
* @method buildRoverManifest
* @param {String} Name of rover that need manifests built
* @param {Function} Function to be called
* @return {void}
*/
function buildRoverManifest(rover, callback) {
	req(process.env.ROVER_URL + rover + process.env.ROVER_URL_EXT, function(err, resp, body) {
		
		var urls = []
			, latest_sol = cheerio.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0
			, allSols = new Array(latest_sol)
			, idx = 0;

		dbDriver.db.find({ rover: rover }).sort({ sol: -1 }).limit(1, function(err, manifest) {
			(function processSol() {
				if (allSols.length <= 0) {
					callback(rovers);
					return;
				};

				allSols.shift();
				idx = latest_sol - allSols.length;

				if (idx <= (manifest[0] && manifest[0].sol || 0)) {
					util.log('Skipping sol %d', idx);
					processSol();
					return;
				}

				util.log('Processing Sol %d ... %d remaining', idx, allSols.length);

				getAllImages([], getCameraUrls(rover, idx), idx, function(images) {
					dbDriver.db.update({
						sol: idx
					}
					, {
						sol: idx
						, rover: rover
						, weather: null
						, images: images
					}
					, {
						upsert: true
					}
					, processSol);
				});
			})();
		});
	});
}

/**
* Determines which methods to use based on the rover type
*
* @method parseRoverData
* @param {Array} Array of rover object data
* @return {void}
*/
function parseRoverData(rovers) {
	if (rovers.length <= 0) {
		util.log('Finished parsing data for all rovers');
		return;
	}

	var rover = rovers.shift();

	util.log('Processing %s images ...', rover.name);

	if (rover.type === 'scrape') {
		buildRoverManifest(rover.name, function() {
			parseRoverData(rovers);
		});
	} else if (rover.type === 'manifest') {
		parseRoverManifest(rover.name, function() {
			parseRoverData(rovers);
		});
	} else {
		util.log('Invalid or missing rover daemon type');
	}

}

///--- Exports

module.exports.run = function(rovers) {
	if (dbDriver.db) {
		parseRoverData(rovers);
	} else {
		util.log('No database loaded, unable to start daemon');
	}
}