var mongojs = require('mongojs')
	, Datastore = require('nedb')
	, statsModel = require('../models/stats').stats
	, solsModel = require('../models/sols').sols
	, db;

function dbCursor(cursor, callback) {
	if (process.env.DB_URL) {
		cursor.toArray(callback);
	} else {
		cursor.exec(callback);
	}
}

function runDatabase() {
	dbCursor(db.find().sort({ _id: -1 }).limit(1), function(err, docs) {
		if (docs.length <= 0) {
			// No docs exists, insert the base models
			db.insert(new statsModel());
			db.insert(new solsModel());
		}
		require('./daemon').run();
	});
}

exports.loadDatabase = function(callback) {
	if (process.env.DB_URL) {
		exports.db = db = mongojs(process.env.DB_URL, ['mrma']).mrma;
	} else {
		exports.db = db = new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true });
	}
	runDatabase();
}