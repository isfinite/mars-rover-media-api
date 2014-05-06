var stats = require('../server/models/stats')
	, driver = require('../server/config/driver')
	, dotenv = require('dotenv').load();

///--- Tests

module.exports.statsDbFailure = function(test) {
	stats.get(function(data) {
		test.ok(data.err, 'Error message exists');
		test.done();
	});
}

module.exports.statsDbSuccess = {
	setUp: function(callback) {
		driver.loadDatabase(callback);
	}
	, statsDbSuccess: function(test) {
		stats.get(function(data) {
			test.ok(data.count, 'Stats count exists');
			test.deepEqual(typeof data.count, 'number', 'Stats count is correct data type');
			test.done();
		});	
	}
	, tearDown: function(callback) {
		driver.db.close();
		callback();
	}
}