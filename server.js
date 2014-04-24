var express = require('express')
	, app = express()
	, helpers = require('./modules/helpers.js')
	, api = require('./routes/api.js');

var db = require('./modules/database.js').run();

var apiRouter = express.Router();

apiRouter
	.get('/stats', api.getStats);

apiRouter
	.get('/*', api.getMedia);

app.use('/api', apiRouter);

app.listen(3000);