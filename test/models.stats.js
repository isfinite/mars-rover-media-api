var stats = require('../server/models/stats')
	, driver = require('../server/config/driver')
	, dotenv = require('dotenv').load();

///--- Tests

describe('Stats model', function() {
	describe('Stats.get', function() {
		before(function(done) {
			driver.reset();
			done();
		});
		it('should return a database error since it hasnt been loaded yet', function(done) {
			stats.get(function(data) {
				data.err.should.be.ok;
				done();
			});
		});
	});
});