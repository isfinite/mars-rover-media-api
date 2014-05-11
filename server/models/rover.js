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
	, SCRAPER_URL_EXT = '.html'
	, MAAS_URL = 'http://marsweather.ingenology.com/v1/archive/?sol=';

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

var _Rover = function(name, callback) {

	if (!name) throw new Error('Cannot create an unnamed rover');

	var url = JPL_ROOT + name + '-raw-images/image/image_manifest.json'
		, self = this;

	this.name = name;

	// Determine if rover uses JSON manifest files, all others need to be scraped
	http.get(url, function(resp) {
		self.type = (resp.statusCode === 404) ? 'scrape' : 'manifest';
		callback && callback.call(self);
	});

};

_Rover.prototype.runUrls = function() {
	console.log('test')
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

			self.manifest = manifest;

			callback.call(self);

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

			self.manifest = manifest;

			callback.call(self, manifest);

			return;

		}

	});

}

///--- Exports

module.exports = _Rover;