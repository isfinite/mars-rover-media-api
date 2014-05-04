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

	io.sockets.on('connection', function() {
		require('./server/models/stats').stats(function(data) {
			io.sockets.emit('stats', data);
		});
	});
	module.exports.io = io;

});

server.listen(process.env.PORT);