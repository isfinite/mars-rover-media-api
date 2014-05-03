var restify = require('restify')
	, server = restify.createServer()
	, socketio = require('socket.io')
	, io = socketio.listen(server)
	, dotenv = require('dotenv').load();

io.set('log level', 1);
require('./server/database/driver').loadDatabase();
module.exports.server = server;
require('./server/config/routes').routes();

server.listen(process.env.PORT);

/*
io.sockets.on('connection', function() {
	db.getDb().findOne({ stats: true }, function(err, doc) {
		io.sockets.emit('stats', doc);
	});
});
module.exports.io = io;
*/