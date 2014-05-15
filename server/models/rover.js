var http = require('http')
	, req = require('request')
	, $ = require('cheerio')
	, util = require('../config/util')
	, camerasRaw;

///--- Constants

var JPL_ROOT = 'http://mars.jpl.nasa.gov/'
	, ROVER_ROOT = 'http://marsrover.nasa.gov/'
	, MANIFEST_URL = '-raw-images/image/image_manifest.json'
	, SCRAPER_URL = ROVER_ROOT + 'gallery/all/'
	, SCRAPER_URL_EXT = '.html';

///--- Models

var _Image = require('../models/image');

///--- Private Methods

/**
* Create camera urls for the rover and Sol
*
* @method getCameraUrls
* @param {String} Rover to be used
* @param {Number} Sol to be used
* @return {Array} Url's for each camera of this Sol and rover
*/
function getCameraUrls(rover, sol) {
	// Rovers with manifests don't need these camera identifiers
	if (rover.type === 'manifest') return;

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

	for ( ; i < len; i++ ) urls.push(SCRAPER_URL + rover.name + '_' + cameraKeys[i].toLowerCase() + util.pad(sol, 3) + '_text' + SCRAPER_URL_EXT);
	
	return urls;
}

/**
* Retrieves the image width/height/filesize without retrieving the entire image
*
* @method getImageProperties
* @param {Object} Image data to be converted into a new object format
* @param {Function} Function to be called after request is completed
* @return {Object} Newly defined image data object
*/
function getImageProperties(url, callback) {
	var _req = http.get(url, function(resp) {
		require('imagesize')(resp, function(err, res) {
			_req.end();
			callback({
				filesize: resp.headers['content-length'] || null
				, width: res && res.width || null
				, height: res && res.height || null
			});
		});
	});
}

function parseImage(images, callback) {
	return function(getImageModel) {
		(function _parse() {

			if (!images.length) {
				callback();
				return;
			}

			var image = getImageModel( images.shift() );

			_Image.findOne({ 'url.raw': image.url.raw }, function(err, doc) {
				if (doc) {
					util.log('%s | Skipping image ... %d images remaining', image.rover, images.length);
					_parse();
					return;
				}

				getImageProperties(image.url.raw, function(props) {
					image.properties = {
						width: props.width >> 0
						, filesize: props.filesize >> 0
						, height: props.height >> 0
					}

					util.log('%s | Sol %d | Image added ... %d images remaining', image.rover, image.sol, images.length);
					image.save(_parse);
				});
			});

		})();
	}
}

var _Rover = function(name, callback) {

	if (!name) throw new Error('Cannot create an unnamed rover');

	var url = JPL_ROOT + name + MANIFEST_URL
		, self = this;

	this.name = name;

	// Determine if rover uses JSON manifest files, all others need to be scraped
	http.get(url, function(resp) {
		self.type = (resp.statusCode === 404) ? 'scrape' : 'manifest';
		callback && callback.call(self);
	});

};

_Rover.prototype.parseImages = function(urls, sol, callback) {

	var self = this;

	(function _run() {
		if (!urls.length) {
			callback();
			return;
		}

		var url = urls.shift();

		req(url, function(err, resp, body) {

			if (resp.statusCode !== 200) {
				_run();
				return;
			}

			if (self.type === 'manifest') {

				parseImage(JSON.parse(body).images, _run)(function(data) {
					return new _Image({
						rover: self.name
						, sol: sol
						, sclk: data.sclk >> 0
						, camera: data.instrument
						, url: {
							raw: data.urlList
							, site: JPL_ROOT + self.name + '/multimedia/raw/?rawid=' + data.itemName
							, label: data.pdsLabelUrl
						}
						, captured: data.utc
						, added: data.dateAdded
						, location: {
							site: data.site
							, drive: data.drive
						}
					});
				});

			} else {

				parseImage($.load(body)('a[href*="' + resp.req._header.match(/\d+/g).shift() + '/"]').toArray(), _run)(function(data) {

					var filenameParts = data.attribs.href.split('/').pop().split('.')
						, filename = { file: filenameParts.shift(), ext: '.' + filenameParts.shift() }
						, cameraIdent = filename.file.substr(1, 1)
						, rootUrl = SCRAPER_URL + (filename.file.substr(0, 1) >> 0) + '/' + cameraIdent.toLowerCase() + '/' + util.pad(sol, 3) + '/' + filename.file
						, sclk = filename.file.substr(2, 9) >> 0;

					return new _Image({
						rover: self.name
						, sol: sol
						, sclk: sclk
						, camera: camerasRaw[cameraIdent] + '_' + filename.file.substr(23, 1)
						, url: {
							raw: rootUrl + filename.ext
							, site: rootUrl + SCRAPER_URL_EXT.toUpperCase()
						}
						, location: {
							site: filename.file.substr(14, 2)
							, drive: filename.file.substr(16, 2)
						}

						// Using spacecraft clock as a base to calculate datetime image was taken
						, captured: new Date(new Date('January 1, 2000 11:58:55 UTC').setSeconds(sclk))
					});
				});

			}

		});
	})();
}

_Rover.prototype.buildManifest = function(callback) {

	var url = (this.type === 'scrape') ? SCRAPER_URL + this.name + SCRAPER_URL_EXT : JPL_ROOT + this.name + MANIFEST_URL
		, manifest = []
		, i = 0
		, len = 0
		, self = this;

	function _build(data) {

		if (data.splice) len = data.length;

		for ( ; i < len; i++ ) {
			manifest.push({
				sol: i
				, url: getCameraUrls(self, i) || [data[i].catalog_url]
			});
		}

		callback.call(self, manifest);

	}

	req(url, function(err, resp, body) {

		if (self.type === 'manifest') {

			_build(JSON.parse(body).sols);

		} else {

			// Opportunity/Spirit start at Sol 1 not 0
			++i;

			_build($.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0);
		}

	});

}

///--- Exports

module.exports = _Rover;