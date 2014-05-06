var driver = require('../server/config/driver')
	, dotenv = require('dotenv').load();

///--- Tests

module.exports.loadMongoDB = {
	setUp: function(callback) {
		callback();
	}
	, loadMongoDB: function(test) {
		if (process.env.DB_URL) {
			test.ok(process.env.DB_URL, 'MongoDB loaded');

			driver.loadDatabase(function() {
				test.ok(driver.collection, 'DB added to module exports');
				test.done();
			});
		} else {
			test.done();
		}
	}
	, tearDown: function(callback) {
		driver.db.close();
		driver.db = null;
		callback();
	}
}

module.exports.loadNeDB = {
	setUp: function(callback) {
		this.url = process.env.DB_URL;
		delete process.env.DB_URL;
		callback();
	}
	, loadDb: function(test) {
		test.ok(!process.env.DB_URL, 'DB does not exist in .env');
		driver.loadDatabase(function() {
			test.ok(driver.collection, 'DB added to module exports');
			test.done();
		});
	}
	, tearDown: function(callback) {
		process.env.DB_URL = this.url;
		driver.db = null;
		callback();
	}
}