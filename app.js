// NPM Modules
var express = require('express')
	, api = require('./routes/api.js');

// Custom Modules
//var db = require('./modules/database.js').run();


// Initializing methods
var app = express();

app.get('/api/sol/:sol', api.findBySol);

app.listen(3000);