var Datastore = require('nedb');

var db = new Datastore({ filename: './datastore/data.db', autoload: true });

exports.findBySol = function(req, res) {
	var sol = req.params.sol;
	db.find({ sol: sol }, function(err, docs) {
		res.send(docs);
	});
}