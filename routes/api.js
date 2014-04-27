var Datastore = require('nedb')
	, helpers = require('../modules/helpers.js')
	, db = require('../modules/database.js').getDb();

exports.getMedia = function(req, res) {
	var params = req.url.split('/').slice(1)
		, paramObj = {}
		, weather = ['terrestrial_date', 'ls', 'min_temp', 'min_temp_fahrenheit', 'max_temp', 'max_temp_fahrenheit', 'pressure', 'pressure_string', 'abs_humidity', 'wind_speed', 'wind_direction', 'atmo_opacity', 'season', 'sunrise', 'sunset'];

	for (var i = 0, len = params.length; i < len; i++) {
		var param = params[i].split(':')
			, key = param.shift().split('?').shift()
			, val = param.shift();

		if (weather.indexOf(key) !== -1) {
			if (/^[0-9]+$/.test(val)) val = parseInt(val, 10);
			paramObj['weather.' + key] = val;
		} else {
			paramObj[key] = val || true;
		}
	}

	if ('sols' in paramObj && paramObj.sols === true) {
		db.find({ sol: { $exists: true }}, function(err, docs) {
			var sols = {}
				, results = docs.slice(0)
				, keys = []
				, output = [];

			do {
				var item = results.shift()
					, data = sols[item.sol] || {
						cameras: {}
					}

				data.cameras[item.camera.clean] = ++data.cameras[item.camera.clean] || 1;
				sols[item.sol] = data;
			} while (results.length > 0);

			for (k in sols) if (sols.hasOwnProperty(k)) keys.push(k);
			keys.sort();

			do {
				var key = keys.shift();
				output.push({
					sol: key
					, results: sols[key]
				});
			} while(keys.length > 0);

			res.jsonp(output);
		});
	} else if (paramObj.latest) {
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
	} else {
		db.find(paramObj, function(err, docs) {
			var i = 0, len = docs.length, sols = [];
			do {
				if (sols.indexOf(docs[i].sol) === -1) sols.push(docs[i].sol);
			} while(++i < len);
			res.jsonp({
				sols: sols.sort()
				, total: docs.length
				, results: docs
			});
		});
	}
};

exports.getStats = function(req, res) {
	db.findOne({ stats: true }, function(err, doc) {
		res.jsonp(doc);
	});
}