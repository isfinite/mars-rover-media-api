var restify = require('restify')
	, server = restify.createServer()
	, socketio = require('socket.io')
	, io = socketio.listen(server)
	, dotenv = require('dotenv').load();

io.set('log level', 1);

require('./server/config/driver').loadDatabase(function() {

	module.exports.server = server;
	require('./server/config/routes').routes();

	require('./server/config/daemon').run([
		{ name: 'opportunity', type: 'scrape' }
		, { name: 'spirit', type: 'scrape' }
		, { name: 'curiosity', type: 'manifest' }
	]);

});

server.listen(process.env.PORT);

/*
io.sockets.on('connection', function() {
	db.getDb().findOne({ stats: true }, function(err, doc) {
		io.sockets.emit('stats', doc);
	});
});
module.exports.io = io;
*/