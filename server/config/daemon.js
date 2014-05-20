var dbDriver = require('../config/driver')
	, log = require('../config/util').log
	, rover = require('../models/rover');

var Daemon = (function _Daemon() {

	var _rovers = process.env.ROVERS && process.env.ROVERS.split(',') || ['msl'];

	if (dbDriver.db) {
		_rovers.forEach(function(name) {
			var _rover = rover(name).run(function() {
				log('-- DONE --');
			});
		});
	} else {
		log('No database loaded, unable to start daemon');
	}

	return false;

})();

///--- Exports

module.exports = Daemon;