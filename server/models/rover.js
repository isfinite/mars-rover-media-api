var http = require('http')
	, req = require('request')
	, pad = require('../config/util').pad
	, log = require('../config/util').log
	, mixin = require('../config/util').mixin
	, EventEmitter = require('events').EventEmitter
	, $ = require('cheerio')
	, camerasRaw;

///--- Constants

var JPL_ROOT = 'http://mars.jpl.nasa.gov/'
	, ROVER_ROOT = 'http://marsrover.nasa.gov/'
	, MANIFEST_URL = '-raw-images/image/image_manifest.json'
	, SCRAPER_URL = ROVER_ROOT + 'gallery/all/'
	, SCRAPER_URL_EXT = '.html'
	, MAAS_API = 'http://marsweather.ingenology.com/v1/archive/?sol=';

///--- Models

var Media = require('../models/image')
	, Sol = require('../models/sol');

///--- Private Methods

/**
* Create camera urls for the rover and Sol
*
* @function _getCameraUrls
* @param {String} Rover to be used
* @param {Number} Sol to be used
* @return {Array} Url's for each camera of this Sol and rover
*/
function _getCameraUrls(rover, sol) {
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

	for ( ; i < len; i++ ) urls.push(SCRAPER_URL + rover.name + '_' + cameraKeys[i].toLowerCase() + pad(sol, 3) + '_text' + SCRAPER_URL_EXT);
	
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
function _getImageProperties(url, callback) {
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

function _getScrapedImageModel(data) {
	var filenameParts = data.image.shift().attribs.href.split('/').pop().split('.')
		, sol = data.sol >> 0
		, filename = { file: filenameParts.shift(), ext: '.' + filenameParts.shift() }
		, cameraIdent = filename.file.substr(1, 1)
		, rootUrl = SCRAPER_URL + (filename.file.substr(0, 1) >> 0) + '/' + cameraIdent.toLowerCase() + '/' + pad(sol, 3) + '/' + filename.file
		, sclk = filename.file.substr(2, 9) >> 0;

	return new Media({
		sol: sol
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
}

function _getManifestImageModel(data) {
	return new Media({
		sol: data.sol >> 0
		, sclk: data.sclk >> 0
		, camera: data.instrument
		, url: {
			raw: data.urlList
			, site: JPL_ROOT + this.name + '/multimedia/raw/?rawid=' + data.itemName
			, label: data.pdsLabelUrl || ''
		}
		, captured: data.utc
		, added: data.dateAdded
		, location: {
			site: data.site || ''
			, drive: data.drive || ''
		}
	});
}

function _parseImages(images, lastSol) {

	var _image;

	if (!images.length) {
		this.events.emit('images.done');
		return;
	}

	function _save(props) {
		_image.properties = {
			width: props.width >> 0
			, filesize: props.filesize >> 0
			, height: props.height >> 0
		}
		_image.rover = this.name;
		_image.save(_parseImages.bind(this, images, _image.sol));

		if (lastSol && _image.sol !== lastSol || !images.length) {
			var _sol = new Sol({ sol: lastSol, rover: this.name });

			if (this.name === 'msl') {
				req(MAAS_API + _sol.sol, function(err, resp, body) {
					var weather = JSON.parse(body);

					if (weather.count > 0) _sol.weather = weather.results.shift();

					_sol.save();
				});
			} else {
				_sol.save();
			}

			log('%s | Sol %d saved ...', this.name, lastSol);
		}

		log('%s | Image saved ... %d remaining', this.name, images.length);
	}

	function _dbFoundMedia(err, doc) {
		if (doc) {
			log('%s | Skipping image ... %d remaining', this.name, images.length);
			_parseImages.call(this, images);
			return;
		}

		_getImageProperties(_image.url.raw, _save.bind(this));
	}

	(function _parseImage(image) {

		// Retrieve the mongoose model for this image based on the rover type
		_image = (this.type === 'manifest') ? _getManifestImageModel(image) : _getScrapedImageModel(image);

		// Check to see if this image is already in the database
		Media.findOne({ 'url.raw': _image.url.raw }, _dbFoundMedia.bind(this));

	}).call(this, images.shift());
}

function _parseUrls(urls, images) {

	function _urlResponse(err, resp, body) {
		if (!images) images = [];

		// Spirit/Opportunity need to keep track of the Sol for each image
		var _images = { sol: resp.req._header.match(/\d+/g).shift() }
		_images.image = $.load(body)('a[href*="' + _images.sol + '/"]').toArray();

		// Combine the images[] currently set with the new images retrieved from this url based on the rover type
		if (resp.statusCode === 200) images = images.concat((this.type === 'manifest') ? JSON.parse(body).images : _images);

		// Recurse
		_parseUrls.call(this, urls, images);
	}

	if (!urls.length) {
		this.events.emit('urls.done', images);
		return;
	}

	log('%s | Parsing URL\'s ... %d remaining', this.name, urls.length);
	req(urls.shift(), _urlResponse.bind(this));

}

function _run(callback) {
	if (!this.manifest.length) {
		var urls = [];
		
		// Once manifest is built build an array of urls and begin parsing them
		this.events.on('manifest.done', function(manifests) {
			manifests.forEach(function(data) {
				urls = urls.concat(data.urls);
			});
			this.parseUrls(urls);
		}.bind(this));
		
		this.events.on('urls.done', this.parseImages.bind(this));
		
		this.events.on('images.done', callback);
	}
}

/**
* Normalizes a manifest for the rover instance regardless of its type
*
* @function _buildManifest
*/
function _buildManifest() {
	var manifest = []
		, currentSol = 0
		, sols;

	function _build(data) {

		if (!sols) sols = (data.splice) ? data : new Array(data);

		if (!sols.length) {
			this.events.emit('manifest.done', manifest);
			return;
		}

		var _sol = sols.shift();

		function _buildManifest(err, doc) {

			if (doc || typeof _sol === 'object' && !_sol.num_images) {

				log('%s | Skipping sol %d', this.name, currentSol);

			} else {

				// Scraped rovers need their urls created for each individual camera
				// If the rover doesnt need individual camera urls _getCameraUrls will return `null`
				// In that case just grab the url directly from the JSON manifest
				manifest.push({ sol: currentSol, urls: _getCameraUrls(this, currentSol) || [_sol.catalog_url] });

				log('%s | Adding sol %d', this.name, currentSol);

			}

			++currentSol;
			_build.call(this);
		}

		Sol.findOne({ rover: this.name, sol: currentSol }, _buildManifest.bind(this));

	}

	this.events.emit('manifest.start');
	log('%s | Building manifest ...', this.name);

	req((this.type === 'scrape') ? SCRAPER_URL + this.name + SCRAPER_URL_EXT : JPL_ROOT + this.name + MANIFEST_URL, function(err, resp, body) {
		
		// Opportunity/Spirit start at Sol 1 not 0
		if (this.type !== 'manifest') ++currentSol;

		_build.call(this, (this.type === 'manifest') ? JSON.parse(body).sols : $.load(body)('p:contains("Sol"):first-child').text().match(/\d+/g).shift() >> 0);

	}.bind(this));
}

function rover(name) {
	if (!name) throw new Error('Cannot create an unnamed rover');

	var _roverInstance = Object.create({
		run: _run
		, events: new EventEmitter()
		, parseUrls: _parseUrls
		, parseImages: _parseImages
	}
	, {
		name: {
			value: name
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
	});
	
	http.get(JPL_ROOT + name + MANIFEST_URL, function(resp) {
		_roverInstance.type = (resp.statusCode === 404) ? 'scrape' : 'manifest';
		_buildManifest.call(_roverInstance);
	});

	return _roverInstance;
}

///--- Exports

module.exports = rover;