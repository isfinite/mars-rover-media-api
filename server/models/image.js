var mongoose = require('mongoose')
	, Schema = mongoose.Schema;

var imageSchema = new Schema({
	sol: Number
	, rover: String
	, camera: String
	, sclk: Number
	, captured: Date
	, added: Date
	, location: {
		site: String
		, drive: String
	}
	, url: {
		raw: String
		, site: String
		, label: String
	}
	, properties: {
		filetype: String
		, filesize: Number
		, width: Number
		, height: Number
	}
}, {
	strict: true
});

var _Image = mongoose.model('Image', imageSchema);

module.exports = _Image;