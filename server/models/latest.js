var driver = require('../config/driver');

var Latest = (function() {

	var _latestData = function(callback) {
		if (!driver.collection) {
			callback({ err: 'Unable to find database' });
			return;
		}

		driver
			.collection
			.aggregate([
				{ $sort: { _id: -1 }}
				, { $group: { _id: '$rover', results: { $first: '$images' }}}
			], function(err, docs) {
				if (err) callback(err);
				if (docs) {
					callback(docs);
				} else {
					callback({
						err: 'Unable to find stats document'
					});
				}
			});
	}

	return {
		get: _latestData
	}
})();

module.exports = Latest;