var mongoose = require('mongoose')
	, Datastore = require('nedb');

module.exports.load = function(callback) {
	if (exports.db) return exports.db;

	if (process.env.DB_URL) {
		exports.db = mongoose.connect(process.env.DB_URL).connection.once('open', function() {
			callback && callback();
		});
	}
	
}

module.exports.reset = function() {
	delete exports.db;
	delete exports.collection;
}