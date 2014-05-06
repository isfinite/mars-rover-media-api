var util = require('../server/config/util');

///--- Tests

describe('Utilities helpers', function() {
	describe('Pad (string|number) to specified length', function() {
		it('should get padded to 3 places starting with 2 leading 0\'s', function() {
			util.pad(001, 3).should.be.exactly('001');
		});
		///--- next();
		it('should get padded to 4 places', function() {
			util.pad(1, 4).should.be.exactly('0001');
		});
		///--- next();
		it('should get padded to 5 places with a string as the original val', function() {
			util.pad('01', 5).should.be.exactly('00001');
		});
		///--- next();
		it('should get padded to 3 places with custom pad character', function() {
			util.pad(001, 3, '@').should.be.exactly('@@1');
		});
		///--- next();
		it('should not be padded since its already at the correct length', function() {
			util.pad('01', 4, '@').should.be.exactly('@@01');
		});
		///--- next();
		it('should not be padded since it already exceeds the correct length', function() {
			util.pad('000001', 4, '@').should.be.exactly('000001');
		});
	});
});