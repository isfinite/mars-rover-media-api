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

	for ( ; i < len; i++ ) urls.push(SCRAPER_URL + rover + '_' + cameraKeys[i].toLowerCase() + util.pad(sol, 3) + '_text' + SCRAPER_URL_EXT);
	
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
			_req.abort();
			callback({
				filesize: resp.headers['content-length'] || null
				, width: res && res.width || null
				, height: res && res.height || null
			});
		});
	});
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
			
			try {

				var imagesData = JSON.parse(body).images;

				(function _parseImage() {

					if (!imagesData.length) {
						_run();
						return;
					}

					var imageData = imagesData.shift();

					_Image.findOne({ 'url.raw': imageData.urlList }, function(err, doc) {
						if (doc) {
							util.log('%s | Skipping image ... %d images remaining', self.name, imagesData.length);
							_parseImage();
							return;
						}

						getImageProperties(imageData.urlList, function(props) {
							var image = new _Image({
								rover: self.name
								, sol: sol
								, sclk: imageData.sclk
								, camera: imageData.instrument
								, url: {
									raw: imageData.urlList
									, site: JPL_ROOT + self.name + '/multimedia/raw/?rawid=' + imageData.itemName
									, label: imageData.pdsLabelUrl
								}
								, captured: imageData.utc
								, added: imageData.dateAdded
								, location: {
									site: imageData.site
									, drive: imageData.drive
								}
								, properties: {
									filetype: imageData.sampleType
									, width: props.width >> 0
									, filesize: props.filesize >> 0
									, height: props.height >> 0
								}
							});

							util.log('%s | Sol %d | Image added ... %d images remaining', self.name, sol, imagesData.length);
							image.save(_parseImage);

						});
					});
				})();

				return;

			} catch(e) {

				if (resp.statusCode !== 200) {
					_run();
					return;
				}

				var imageElements = $.load(body)('a[href*="' + resp.req._header.match(/\d+/g).shift() + '/"]').toArray();

				(function _parseImage() {

					if (!imageElements.length) {
						_run();
						return;
					}

					var element = imageElements.shift()
						, filenameParts = element.attribs.href.split('/').pop().split('.')
						, filename = { file: filenameParts.shift(), ext: '.' + filenameParts.shift() }
						, roverCode = filename.file.substr(0, 1) >> 0
						, cameraIdent = filename.file.substr(1, 1)
						, rootUrl = SCRAPER_URL + roverCode + '/' + cameraIdent.toLowerCase() + '/' + util.pad(sol, 3) + '/' + filename.file
						, sclk = filename.file.substr(2, 9) >> 0;

					_Image.findOne({ 'url.raw': rootUrl + filename.ext }, function(err, doc) {
						if (doc) {
							util.log('%s | Skipping image ... %d images remaining', self.name, imageElements.length);
							_parseImage();
							return;
						}

						getImageProperties(rootUrl + filename.ext, function(props) {
							var image = new _Image({
								rover: self.name
								, sol: sol
								, sclk: sclk
								, camera: camerasRaw[cameraIdent] + '_' + filename.file.substr(23, 1)

								// Using spacecraft clock as a base to calculate datetime image was taken
								, captured: new Date(new Date('January 1, 2000 11:58:55 UTC').setSeconds(sclk))

								, location: {
									site: filename.file.substr(14, 2)
									, drive: filename.file.substr(16, 2)
								}
								, url: {
									raw: rootUrl + filename.ext
									, site: rootUrl + SCRAPER_URL_EXT.toUpperCase()
								}
								, properties: {
									width: props.width >> 0
									, filesize: props.filesize >> 0
									, height: props.height >> 0
								}
							});

							util.log('%s | Sol %d | Image added ... %d images remaining', self.name, sol, imageElements.length);
							image.save(_parseImage);

						});
					});

				})();

				return;

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

	req(url, function(err, resp, body) {

		try {

			var sols = JSON.parse(body).sols.slice(0);

			len = sols.length;

			for ( ; i < len; i++ ) {
				manifest.push({
					sol: i
					, url: [
						sols[i].catalog_url
					]
				});
			}

			callback.call(self, manifest);

			return;

		} catch(e) {

			i = 1;
			len = $.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0;

			for ( ; i < len; i++ ) {
				manifest.push({
					sol: i
					, url: getCameraUrls(self.name, i)
				});
			}

			callback.call(self, manifest);

			return;

		}

	});

}

///--- Exports

module.exports = _Rover;