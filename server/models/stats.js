var driver = require('../config/driver');

var Stats = (function() {

	var _statsData = function(callback) {
		driver.db.aggregate([
			{
				$unwind: '$images'
			}
			, {
				$group: {
					_id: 'total_images'
					, count: {
						$sum: 1
					}
				}
			}
		], function(err, doc) {
			if (err) callback(err);
			if (doc) {
				callback(doc.shift());
			} else {
				callback({
					err: 'Unable to find stats document'
				});
			}
		});
	}

	return {
		get: _statsData
	}
})();

module.exports = Stats;