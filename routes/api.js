var Datastore = require('nedb')
	, helpers = require('../modules/helpers.js')
	, db = require('../modules/database.js').getDb();

exports.getMedia = function(req, res) {
	
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
					query[map[k]] = qs[k];
				} else {
					query[k] = qs[k];
				}
			}
		}
	}

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
};

exports.getLatest = function(req, res) {
	db.find({ $not: { stats: true }}).sort({ sol: -1 }).limit(1).exec(function(err, docs) {
		db.find({ sol: docs[0].sol }, function(err, doc) {
			var cameras = {}
				, results = doc.slice(0);

			do {
				var item = results.shift();
				if (!cameras[item.camera.clean]) cameras[item.camera.clean] = item;
			} while(results.length > 0);
			
			res.jsonp(cameras);
		});
	});
}

exports.getStats = function(req, res) {
	db.findOne({ stats: true }, function(err, doc) {
		res.jsonp(doc);
	});
}