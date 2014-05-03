var req = require('request')
	, cheerio = require('cheerio')
	, util = require('../config/util')
	, imgModel = require('../models/image').image
	, env = require('dotenv').load();

var camerasRaw = {
	'F': 'FHAZ'
	, 'R': 'RHAZ'
	, 'N': 'NAV'
	, 'P': 'PAN'
	, 'M': 'MICRO'
	, 'E': 'EDL'
}

/**
* Create camera urls for the rover and Sol
*
* @method getCameraUrls
* @param {String} Rover to be used
* @param {Number} Sol to be used
* @return {Array} Url's for each camera of this Sol and rover
*/
function getCameraUrls(rover, sol) {
	var cameraKeys = Object.keys(camerasRaw)
		, i = 0
		, len = cameraKeys.length
		, urls = [];

	for ( ; i < len; i++ ) urls.push(process.env.ROVER_URL + rover + '_' + cameraKeys[i].toLowerCase() + util.pad(sol, 3) + '_text' + process.env.ROVER_URL_EXT);
	
	return urls;
}

/**
* Create camera urls for the rover and Sol
*
* @method buildImageData
* @param {Node} Link element for the image
* @param {Number} Sol to be used
* @return {Object} Parsed image data
*/
function buildImageData(element, sol) {
	var img = new imgModel()
		, filenameParts = element.attribs.href.split('/').pop().split('.')
		, filename = { file: filenameParts.shift(), ext: '.' + filenameParts.shift() }
		, roverCode = filename.file.substr(0, 1)
		, cameraIdent = filename.file.substr(1, 1)
		, rootUrl = process.env.ROVER_URL + roverCode + '/' + cameraIdent.toLowerCase() + '/' + util.pad(sol, 3) + '/' + filename.file;

	// Camera name + camera eye
	img.camera.instrument = camerasRaw[cameraIdent] + '_' + filename.file.substr(23, 1);
	
	// Spacecraft clock, number of seconds since January 1, 2000 11:58:55.816 UTC, convert to `number`
	img.sclk = filename.file.substr(2, 9) >> 0;
	
	// Using spacecraft clock as a base calculate datetime image was taken
	img.timestamps.captured = new Date(new Date('January 1, 2000 11:58:55 UTC').setSeconds(img.sclk));
	
	img.location.site = filename.file.substr(14, 2);
	img.location.drive = filename.file.substr(16, 2);

	img.url.raw = rootUrl + filename.ext;
	img.url.site = rootUrl + process.env.ROVER_URL_EXT.toUpperCase();

	return img;
}

/**
* Images for the Spirit and Opportunity rovers are broken out into
* separate url's for each camera. This method takes an array of url's,
* tests them for OK and parses each image. After all the url's have
* been run returns the images data as an array.
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

		console.log('Processing url ' + url);

		var $ = cheerio.load(body)
		, imgElements = $('a[href*="' + resp.req._header.match(/\d+/g).shift() + '/"]');

		imgElements.each(function() {
			images.push( buildImageData(this, sol) );
		});

		getAllImages(images, urls, sol, callback);
	});
}

(function buildRoverManifest(rovers) {
	if (rovers.length <= 0) return;

	var rover = rovers.shift()
		, manifest = {
			rover: rover
			, latest_sol: null
			, num_images: 0
			, most_recent: null
			, manifest: true
			, sols: []
		};

	req(process.env.ROVER_URL + rover + process.env.ROVER_URL_EXT, function(err, resp, body) {
		manifest.latest_sol = cheerio.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0;

		var urls = []
			, allSols = new Array(manifest.latest_sol)
			, idx = 0;

		(function processSol() {
			if (allSols.length <= 0) {
				dbDriver.db.insert(manifest, function() {
					buildRoverManifest(rovers);
				});
				return;
			}

			allSols.shift();
			idx = manifest.latest_sol - allSols.length;

			console.log('Processing Sol ' + idx + ' ... ' + allSols.length + ' remaining');

			getAllImages([], getCameraUrls(rover, idx), idx, function(images) {
				manifest.sols.push({
					type: 'rover-images'
					, sol: idx
					, images: images
				});
				manifest.num_images += images.length;
				console.log(images.length + ' images added ... Total images ' + manifest.num_images);
				processSol();
			});
		})();
	});
})(['opportunity', 'spirit']);