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
		res.jsonp({
			sols: sols.sort()
			, total: docs.length
			, results: docs
		});
	});
};

exports.getStats = function(req, res) {

	var stats = {
		cameras: [
			{
				clean: 'Front Hazcam: Right A'
				, raw: 'FHAZ_RIGHT_A'
			},
			{
				clean: 'Front Hazcam: Left A'
				, raw: 'FHAZ_LEFT_A'
			},
			{
				clean: 'Front Hazcam: Right B'
				, raw: 'FHAZ_RIGHT_B'
			},
			{
				clean: 'Front Hazcam: Left B'
				, raw: 'FHAZ_LEFT_B'
			},
			{
				clean: 'Rear Hazcam: Right A'
				, raw: 'RHAZ_RIGHT_A'
			},
			{
				clean: 'Rear Hazcam: Left A'
				, raw: 'RHAZ_LEFT_A'
			},
			{
				clean: 'Rear Hazcam: Right B'
				, raw: 'RHAZ_RIGHT_B'
			},
			{
				clean: 'Rear Hazcam: Left B'
				, raw: 'RHAZ_LEFT_B'
			},
			{
				clean: 'Navcam: Right A'
				, raw: 'NAV_RIGHT_A'
			},
			{
				clean: 'Navcam: Left A'
				, raw: 'NAV_LEFT_A'
			},
			{
				clean: 'Navcam: Right B'
				, raw: 'NAV_RIGHT_B'
			},
			{
				clean: 'Navcam: Left B'
				, raw: 'NAV_LEFT_B'
			},
			{
				clean: 'ChemCam: Remote Micro-Imager'
				, raw: 'CHEMCAM_RMI'
			},
			{
				clean: 'Mars Descent Imager'
				, raw: 'MARDI'
			},
			{
				clean: 'Mastcam: Right'
				, raw: 'MAST_RIGHT'
			},
			{
				clean: 'Mastcam: Left'
				, raw: 'MAST_LEFT'
			},
			{
				clean: 'Mars Hand Lens Imager'
				, raw: 'MAHLI'
			}
		]
	};

	db.count({}, function(err, count) {
		stats.totalImages = count;
		res.jsonp(stats);
	});

}