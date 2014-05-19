var http = require('http')
	, req = require('request')
	, mixin = require('../config/util').mixin
	, $ = require('cheerio')
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
* @function getCameraUrls
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
* @function getImageProperties
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

function _parseImage(images) {
	console.log(this);
	return function(getImageModel) {
		(function _parse() {

			if (!images.length) {
				callback();
				return;
			}

			var image = getImageModel( images.shift() );

			_Image.findOne({ 'url.raw': image.url.raw }, function(err, doc) {
				if (doc) {
					//util.log('%s | Skipping image ... %d images remaining', image.rover, images.length);
					_parse();
					return;
				}

				getImageProperties(image.url.raw, function(props) {
					image.properties = {
						width: props.width >> 0
						, filesize: props.filesize >> 0
						, height: props.height >> 0
					}

					//util.log('%s | Sol %d | Image added ... %d images remaining', image.rover, image.sol, images.length);
					image.save(_parse);
				});
			});

		})();
	}
}

function _parseUrls(urls) {

	function _parseUrl(url) {
		req(url, function(err, resp, body) {
			console.log('Remaining %d ...', urls.length);
			_parseUrls(urls);
		});
	}

	if (!urls.length) {
		console.log('Finished');
		return;
	}

	_parseUrl(urls.shift());

}

function _run() {
	if (!this.manifest.length) {
		var urls = [];
		this.on('manifest.done', function(manifests) {
			manifests.forEach(function(data) {
				urls = urls.concat(data.urls);
			});
			this.parseUrls(urls);
		});
	}
}

/**
* Normalizes a manifest for the rover instance regardless of its type
*
* @function _buildManifest
*/
function _buildManifest() {
	var url = (this.type === 'scrape') ? SCRAPER_URL + this.name + SCRAPER_URL_EXT : JPL_ROOT + this.name + MANIFEST_URL
		, manifest = []
		, i = 0
		, len = 0;

	function _build(data) {

		if (data.splice) len = data.length;

		for ( ; i < len; i++ ) {
			manifest.push({
				sol: data[i].sol || i
				, urls: getCameraUrls(this, i) || [data[i].catalog_url]
			});
		}

		this.trigger('manifest.done', manifest);

	}

	this.trigger('manifest.start');

	req(url, function(err, resp, body) {
		if (this.type === 'manifest') {

			_build.call(this, JSON.parse(body).sols);

		} else {

			// Opportunity/Spirit start at Sol 1 not 0
			++i;

			_build.call(this, $.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0);
		}
	}.bind(this));
}

var _roverProperties = {
	name: {
		value: ''
		, enumerable: true
		, writable: true
	}
	, type: {
		value: ''
		, enumerable: true
		, writable: true
	}
	, manifest: {
		value: []
		, enumerable: true
		, writable: true
	}
}

var _roverPrototype = {
	run: _run
	, parseUrls: _parseUrls
}

function rover(name) {
	if (!name) throw new Error('Cannot create an unnamed rover');

	// Mixin the pubsub methods to the rover prototype
	mixin(_roverPrototype, require('../config/pubsub'));

	var _roverInstance = Object.create(_roverPrototype, _roverProperties);
	
	_roverInstance.name = name;

	http.get(JPL_ROOT + name + MANIFEST_URL, function(resp) {
		_roverInstance.type = (resp.statusCode === 404) ? 'scrape' : 'manifest';
		_buildManifest.call(_roverInstance);
	});

	return _roverInstance;
}

///--- Exports

module.exports = rover;