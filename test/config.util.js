var util = require('../server/config/util');

///--- Tests

exports.pad = function(test) {
	test.equal(util.pad(001, 3), '001', '001 gets reduced to 1 pad should be an additional 2');
	test.equal(util.pad(1, 4), '0001', 'Starts from 1 pad should be an additional 3');
	test.equal(util.pad('01', 5), '00001', 'Padded typeof string gets correct pad');
	test.equal(util.pad(001, 3, '@'), '@@1', '001 gets reduced to 1 resulting in a pad of 2');
	test.equal(util.pad('01', 4, '@'), '@@01', 'String holds its length so pad should be 2');
	test.equal(util.pad('000001', 4, '@'), '000001', 'Pad exceeds width so should return original value');
	test.done();
}