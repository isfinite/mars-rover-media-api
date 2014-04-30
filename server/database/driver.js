var mongojs = require('mongojs')
	, Datastore = require('nedb')
	, statsModel = require('../models/stats')
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
		console.log(docs);
		if (docs.length <= 0) {
			// No docs exists, insert the stats model
			db.insert(statsModel);
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