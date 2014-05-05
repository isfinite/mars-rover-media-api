var driver = require('../server/config/driver')
	, dotenv = require('dotenv').load();

///--- Tests

module.exports.loadMongoDB = function(test) {
	if (process.env.DB_URL) {
		test.ok(process.env.DB_URL, 'MongoDB loaded');

		driver.loadDatabase(function() {
			test.ok(driver.db, 'DB added to module exports');
			test.done();
		});
	} else {
		test.done();
	}
}

module.exports.loadNeDB = {
	setUp: function(callback) {
		delete process.env.DB_URL;
		callback();
	}
	, loadDb: function(test) {
		test.ok(!process.env.DB_URL, 'DB does not exist in .env');
		driver.loadDatabase(function() {
			test.ok(driver.db, 'DB added to module exports');
			test.done();
		});
	}
}