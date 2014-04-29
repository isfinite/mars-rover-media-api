var server = require('../server').server
	, v1_controller = require('./controllers/v1');

exports.routes = function(db) {
	server.get({ path: '/', version: ['1.0.0'] }, v1_controller.getRoot);
	server.get({ path: '/latest', version: ['1.0.0'] }, v1_controller.getLatest);
	server.get({ path: '/stats', version: ['1.0.0'] }, v1_controller.getStats);
	server.get({ path: '/sols', version: ['1.0.0'] }, v1_controller.getMedia);
}