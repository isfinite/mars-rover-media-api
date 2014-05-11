var dotenv = require('dotenv').load();

///--- Tests

describe('Environment variables', function() {
	describe('dotenv is loading variables into process.env', function() {
		it('should be loading variables', function() {
			process.env.PORT.should.be.ok;
			process.env.NOISY.should.be.ok;
		});
	});
});