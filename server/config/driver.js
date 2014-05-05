var mongojs = require('mongojs')
	, Datastore = require('nedb');

module.exports.loadDatabase = function(callback) {
	exports.db = (process.env.DB_URL)
		? mongojs(process.env.DB_URL, ['mrma']).mrma
		: new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true })
		;

	exports.db.ensureIndex({ rover: 1 });

	callback && callback();
}