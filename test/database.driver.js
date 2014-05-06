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
				driver.collection.should.be.ok;
				driver.db.should.be.ok;
				driver.db._name.should.be.ok;
				done();
			});
		});
	});
	///--- next();
	describe('NeDB', function() {
		before(function(done) {
			process.env.DB_URL_ORIG = process.env.DB_URL;
			delete process.env.DB_URL;
			driver.reset();
			done();
		});
		///--- next();
		it('should not have DB_URL in .env to load NeDB', function() {
			process.env.should.not.have.enumerable('DB_URL');
		});
		///--- next();
		it('should have reset driver exports', function() {
			driver.should.not.have.enumerable('db');
			driver.should.not.have.enumerable('collection');
		});
		///--- next();
		it('should load the database correctly with valid exports', function(done) {
			driver.load(function() {
				driver.collection.should.be.ok;
				driver.collection.filename.should.be.ok;
				done();
			});
		});
	});
});