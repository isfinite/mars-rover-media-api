var driver = require('../server/config/driver')
	, dotenv = require('dotenv').load();

///--- Tests

describe('Database driver', function() {
	describe('MongoDB', function() {
		it('should have DB_URL in .env to load MongoDB', function() {
			process.env.DB_URL.should.be.ok;
		});
		///--- next();
		it('should have no current driver exports', function() {
			driver.should.not.have.enumerable('db');
			driver.should.not.have.enumerable('collection');
		});
		///--- next();
		it('should load the database correctly with valid exports', function(done) {
			driver.load(function() {
				driver.db.should.be.ok;
				done();
			});
		});
	});
});