var request = require('request')
	, cheerio = require('cheerio');

function scrape(url, callback) {
	request(url, function(err, resp, body) {
		callback(cheerio.load(body));
	});
}

exports.scrape = scrape;