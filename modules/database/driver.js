var mongojs = require('mongojs')
	, Datastore = require('nedb');

exports.loadDatabase = function(callback) {
	if (process.env.DB_TYPE === 'mongodb') {
		exports.db = mongojs(process.env.DB_URL);
		callback();
	} else if (process.env.DB_TYPE === 'nedb') {
		exports.db = new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true, onload: callback });
	}
}