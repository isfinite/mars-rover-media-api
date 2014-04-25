var express = require('express')
	, app = express()
	, helpers = require('./modules/helpers.js')
	, db = require('./modules/database.js');

db.loadDb(function(err) {
	var api = require('./routes/api.js') // Has to be required here otherwise db wont be loaded
		, apiRouter = express.Router();

	db.run();

	apiRouter
		.get('/stats', api.getStats);

	apiRouter
		.get('/*', api.getMedia);

	app.use('/api', apiRouter);

	app.listen(3000);
});
