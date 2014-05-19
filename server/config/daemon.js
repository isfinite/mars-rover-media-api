var http = require('http')
	, req = require('request')
	, dbDriver = require('../config/driver')
	, cheerio = require('cheerio')
	, util = require('../config/util')
	, server = require('../../server')
	, stats = require('../models/stats')
	, rover = require('../models/rover');

///--- Models

var _Sol = require('../models/sol');

///--- Private Methods

function runManifest(manifest) {

	var self = this;

	(function _run() {

		if (!manifest.length) {
			util.log(self.rover + ' finished');
			return;
		};

		var sol = manifest.shift()
			, idx = manifest[manifest.length-1].sol - manifest.length;

		_Sol.findOne({ rover: self.name, sol: idx }, function(err, doc) {
			if (doc) {
				util.log(self.name + ' | Skipping sol %d', idx);
				_run();
				return;
			}

			var newSol = new _Sol({
				sol: idx
				, rover: self.name
			});

			if (self.name === 'msl') {
				req('http://marsweather.ingenology.com/v1/archive/?sol=' + idx, function(err, resp, body) {
					var weather = JSON.parse(body);

					if (weather.count > 0) newSol.weather = weather.results.shift();

					self.parseImages(sol.url, idx, function() {
						newSol.save(_run);
					});
				});
			} else {
				self.parseImages(sol.url, idx, function() {
					newSol.save(_run);
				});
			}

		});

	})();
}

function _runSol(data) {

	var urls = data.urls.slice();

	this.runUrl(urls);

	function _runUrl() {
		if (!urls.length) {
			return;
		}

		var url = urls.shift();

		req(url, function(err, resp, body) {

		});
	}

}

var Daemon = (function _Daemon() {

	var _rovers = process.env.ROVERS && process.env.ROVERS.split(',') || ['msl'];

	if (dbDriver.db) {
		_rovers.forEach(function(name) {

			var _rover = rover(name).run();

			util.log('Processing %s images ...', name);
		});
	} else {
		util.log('No database loaded, unable to start daemon');
	}

	return false;

})();

///--- Exports

module.exports = Daemon;