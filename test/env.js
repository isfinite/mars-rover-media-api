var dotenv = require('dotenv').load();

///--- Tests

describe('Environment variables', function() {
	describe('dotenv is loading variables into process.env', function() {
		it('should be loading variables', function() {
			process.env.PORT.should.be.ok;
			process.env.NOISY.should.be.ok;
			process.env.CURIOSITY_MANIFEST.should.be.ok;
			process.env.ROVER_URL.should.be.ok;
			process.env.ROVER_URL_EXT.should.be.ok;
			process.env.MAAS_URL.should.be.ok;
		});
	});
});