var express = require('express')
	, app = express()
	, helpers = require('./modules/helpers.js')
	, api = require('./routes/api.js');

// Custom Modules
//var db = require('./modules/database.js').run();

var apiRouter = express.Router();

apiRouter.get('/*', api.findMedia);

app.use('/api', apiRouter);

app.listen(3000);