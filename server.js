var express = require('express')
	, app = express()
	, server = require('http').createServer(app)
	, io = require('socket.io').listen(server)
	, helpers = require('./modules/helpers.js')
	, db = require('./modules/database.js');

io.set('log level', 1);

db.loadDb(function(err) {
	var api = require('./routes/api.js') // Has to be required here otherwise db wont be loaded
		, apiRouter = express.Router();

	// db.run();

	io.sockets.on('connection', function() {
		db.getDb().findOne({ stats: true }, function(err, doc) {
			io.sockets.emit('stats', doc);
		});
	});

	apiRouter.all('*', function(req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'X-Requested-With');
		next();
	});

	apiRouter.get('/', api.getRoot);
	apiRouter.get('/latest', api.getLatest);
	apiRouter.get('/stats', api.getStats);
	apiRouter.get('/*', api.getMedia);
		
	app.use('/v1', apiRouter);

	server.listen(3000);
});

module.exports.io = io;