var Datastore = require('nedb')
	, request = require('request')
	, helpers = require('../modules/helpers.js')
	, scrape = require('../modules/scrape.js').scrape;

var db = new Datastore({ filename: './datastore/data.db', autoload: true });

function pad(num) {
	var s = num + ''
		, origLength = s.length;
    while (s.length < ((4 + origLength) - origLength)) s = '0' + s;
    return s;
}

function setupDb(total) {

	var solSlides = []
		, weatherData, sol;

	function parseWeather(callback) {
		helpers.output('Requesting weather data ...');
		request('http://marsweather.ingenology.com/v1/archive/?sol=' + parseInt(sol, 10), callback);
	}

	function parseImageData(images) {
		if (images.length <= 0) {
			parseSlides();
			return;
		}

		var imgData = images.shift();		

		if (weatherData) imgData.weather = weatherData;

		scrape(imgData.url, function($) {
			imgData.description = $('a[href*="msl-raw-images"]').last().closest('td').text().replace('Full Resolution', '').trim();

			helpers.output('Inserting image record into database ... Remaining insertions: ' + images.length);

			db.insert(imgData, function() {
				parseImageData(images);
			});
		});
	}

	function parseImages(callback) {
		scrape('http://mars.jpl.nasa.gov/msl/admin/modules/multimedia/module/inc_ListImages_Raw4.cfm?s=' + parseInt(sol, 10), function($) {
			helpers.output('Parsing images ...');

			var images = [];
			$('.RawImageCaption').each(function() {
				var root = $(this)
					, imgLink = $(this).closest('td').find('a[href*="?rawid="]')
					, webImg = imgLink.find('img');

				var data = {
					sol: sol
					, url: 'http://mars.jpl.nasa.gov/msl/multimedia/raw/' + imgLink.attr('href').replace('./', '')
					, created_on: new Date().toISOString()
					, type: (webImg.attr('width') == 64 || webImg.attr('height') == 64) ? 'thumbnail' : 'full'
					, camera: webImg.attr('alt').replace('Image taken by ', '')
					, captured_time: $('.RawImageUTC', root).text().replace('Full Resolution', '').trim()
					, image: {
						raw: $('a:contains("Full Resolution")', root).attr('href')
						, web: webImg.attr('src')
					}
				};

				images.push(data);
			});

			parseImageData(images);
		});
	}

	function parseSlides() {
		if (solSlides.length <= 0) return;
		
		sol = solSlides.shift();
		helpers.output('Scraping ' + sol + ' ...');

		parseWeather(function(err, resp, data) {
			data = JSON.parse(data);
			if (data.count > 0) weatherData = data.results;
			parseImages();
		});
	
	}

	function startScraping(index) {
		helpers.output('Requesting latest rover data ...');
		scrape('http://mars.jpl.nasa.gov/msl/multimedia/raw/?s=', function($) {
			var items = $('.scroll-content-item').slice(index || 0);
			if (items.length > 0) {
				items.each(function() {
					solSlides.push($(this).text());
				});
				parseSlides();
			} else {
				// Up-to-date stuff
			}
		});
	}

	if (total > 0) {
		db.find({}).sort({ created_on: -1 }).limit(1).exec(function(err, docs) {
			startScraping(docs[0].sol);
		});
	} else {
		startScraping();
	}

}


function run() {
	// Is database setup?
	db.count({}, function(err, count) {
		helpers.output('Total items in database: ' + count);
		setupDb(count);
		//if (count <= 0) setupDb();
	});
}


/*
scrape('http://mars.jpl.nasa.gov/msl/multimedia/raw/?s=', function scrapeCallback($) {
	var latestSol = $('.scroll-content-item:last').text();
});
*/

exports.run = run;