var driver = require('../config/driver');

exports.stats = function(callback) {
	driver.db.aggregate([
		{ $unwind: '$images' }
		, { $group: { _id: 'total_images', count: { $sum: 1 } }}
	], function(err, doc) {
		callback(doc.shift());
	});
}