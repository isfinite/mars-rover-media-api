var mongojs = require('mongojs')
	, Datastore = require('nedb');

exports.loadDatabase = function(callback) {
	if (process.env.DB_URL) {
		exports.db = mongojs(process.env.DB_URL, ['mrma']).mrma;
	} else {
		exports.db = new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true });
	}
	callback();
}