var db = require('../config/driver').collection;

module.exports.getRoot = function(req, res, next) {
	res.send({
		stats: 'http://mars-rover-media-api/stats'
		, latest: 'http://mars-rover-media-api/latest'
	});
	return next();
}

module.exports.getMedia = function(req, res, next) {
	var urlParts = require('url').parse(req.url)
		, path = urlParts.pathname
		, qs = require('querystring').parse(urlParts.query)
		, reserved = ['lt', 'lte', 'gt', 'gte', 'in', 'ne', 'nin', 'exists', 'regex']
		, query = {
			$not: { stats: true }
		}
		, map = {
			camera: 'camera.clean'
			, width: 'properties.width'
			, height: 'properties.height'
			, filesize: 'properties.filesize'
			, site: 'location.site'
			, drive: 'location.drive'
			, width: 'properties.width'
			, pressure: 'weather.pressure'
			, wind_speed: 'weather.wind_speed'
			, min_temp: 'weather.min_temp'
			, max_temp: 'weather.max_temp'
			, min_temp_fahrenheit: 'weather.min_temp_fahrenheit'
			, max_temp_fahrenheit: 'weather.max_temp_fahrenheit'
		}

	if (qs.callback) delete qs.callback;

	for (var k in qs) {
		if (qs[k]) {
			if (reserved.indexOf(k) !== -1) {
				query.sol = query.sol || {};
				query.sol['$' + k] = qs[k];
			} else {
				if (map[k]) {
					if (k === 'camera') {
						query[map[k]] = qs[k];
					} else {
						var _qs = (k === 'filesize' || k === 'site' || k === 'drive') ? qs[k] : parseInt(qs[k], 10);
						query[map[k]] = { $lte: _qs };
					}
				} else {
					query[k] = qs[k];
				}
			}
		}
	}

	console.log(query)

	db.find(query, function(err, doc) {
		if (typeof doc === 'undefined') {
			res.jsonp({result: 'Invalid query'});
		} else {
			res.jsonp({
				count: doc.length
				, results: doc
			});
		}
	});
}

module.exports.getLatest = function(req, res, next) {
	require('../models/latest').get(function(data) {
		res.send(data);
	});

	return next();
}

module.exports.getStats = function(req, res, next) {
	require('../models/stats').get(function(data) {
		res.send(data);
	});

	return next();
}