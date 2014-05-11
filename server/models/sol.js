var mongoose = require('mongoose')
	, Schema = mongoose.Schema;

var solSchema = new Schema({
	sol: Number
	, rover: String
	, weather: {
		ls: Number
		, min_temp: Number
		, min_temp_fahrenheit: Number
		, max_temp: Number
		, max_temp_fahrenheit: Number
		, pressure: Number
		, pressure_string: String
		, abs_humidity: Number
		, wind_speed: Number
		, wind_direction: String
		, atmo_opacity: String
		, season: String
		, sunrise: Date
		, sunset: Date
	} 
});

var _Sol = mongoose.model('Sol', solSchema);

module.exports = _Sol;