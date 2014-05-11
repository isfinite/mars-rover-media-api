var mongoose = require('mongoose')
	, Schema = mongoose.Schema;

var imageSchema = new Schema({
	sol: Number
	, rover: String
	, camera: {
		instrument: String
	}
	, sclk: Number
	, captured: Date
	, added: Date
	, location: {
		site: String
		, driver: String
	}
	, url: {
		raw: String
		, site: String
		, label: String
	}
	, properties: {
		filesize: Number
		, width: Number
		, height: Number
		, type: String
	}
});

var _Image = mongoose.model('Image', imageSchema);

module.exports = _Image;