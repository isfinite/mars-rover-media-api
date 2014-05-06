var mongojs = require('mongojs')
	, Datastore = require('nedb');

module.exports.load = function(callback) {
	if (exports.db) return exports.db;

	var db = (process.env.DB_URL)
		? mongojs(process.env.DB_URL, ['mrma'])
		: new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true })
		;

	if (process.env.DB_URL) {
		db.mrma.ensureIndex({ rover: 1 });
		exports.collection = db.mrma;
		exports.db = db;
	} else {
		exports.collection = db;
	}

	callback && callback();
}

module.exports.reset = function() {
	delete exports.db;
	delete exports.collection;
}