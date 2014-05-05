var dotenv = require('dotenv').load();

///--- Tests

module.exports.env_variables = function(test) {
	test.ok(process.env.PORT, 'PORT exists in .env');
	test.ok(process.env.NOISY, 'NOISY exists in .env');
	if (process.env.DB_URL) test.ok(process.env.DB_URL, 'DB_URL exists in .env');
	test.ok(process.env.CURIOSITY_MANIFEST, 'CURIOSITY_MANIFEST exists in .env');
	test.ok(process.env.ROVER_URL, 'ROVER_URL exists in .env');
	test.ok(process.env.ROVER_URL_EXT, 'ROVER_URL_EXT exists in .env');
	test.ok(process.env.MAAS_URL, 'MAAS_URL exists in .env');
	test.done();
}