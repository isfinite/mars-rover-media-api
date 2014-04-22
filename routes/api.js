var Datastore = require('nedb')
	, helpers = require('../modules/helpers.js');

var db = new Datastore({ filename: './datastore/data.db', autoload: true });

exports.getMedia = function(req, res) {
	var params = req.url.split('/').slice(1)
		, paramObj = {}
		, weather = ['terrestrial_date', 'ls', 'min_temp', 'min_temp_fahrenheit', 'max_temp', 'max_temp_fahrenheit', 'pressure', 'pressure_string', 'abs_humidity', 'wind_speed', 'wind_direction', 'atmo_opacity', 'season', 'sunrise', 'sunset'];

	for (var i = 0, len = params.length; i < len; i++) {
		var param = params[i].split(':')
			, key = param.shift()
			, val = param.shift();

		if (weather.indexOf(key) !== -1) {
			if (/^[0-9]+$/.test(val)) val = parseInt(val, 10);
			paramObj['weather.' + key] = val;
		} else {
			paramObj[key] = val;
		}
	}

	db.find(paramObj, function(err, docs) {
		var i = 0, len = docs.length, sols = [];
		do {
			if (sols.indexOf(docs[i].sol) === -1) sols.push(docs[i].sol);
		} while(++i < len);
		res.send({
			sols: sols.sort()
			, total: docs.length
			, results: docs
		});
	});
};

exports.getStats = function(req, res) {

	var stats = {};

	db.count({}, function(err, count) {
		stats.totalImages = count;
		res.send(stats);
	});

}