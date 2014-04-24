var Datastore = require('nedb')
	, request = require('request')
	, helpers = require('../modules/helpers.js')
	, scrape = require('../modules/scrape.js').scrape;

var db = new Datastore({ filename: './datastore/data', autoload: true });

function setupDb(total) {

	var solSlides = []
		, weatherData, sol;

	function updateStats(callback) {
		db.findOne({ stats: true }, function(err, doc) {

			if (!doc) helpers.output('Could not locate the stats doc');
			if (!callback) helpers.output('Callback required to update stats doc');
			
			var updatedDoc = callback(doc);

			if (updatedDoc) {
				db.update({ _id: doc._id }, updatedDoc, {}, function() {
					helpers.output('Stats doc updated');
				});
			} else {
				helpers.output('You must return a stats doc for it to be updated');
			}
		});
	}

	function parseStats(callback) {
		db.findOne({ stats: true }, function(err, doc) {
			if (!doc) {
				db.insert({
					stats: true
					, cameras: []
					, sols: []
					, totals: {
						media: 0
						, camera: {}
					}
					, averages: {
						temp: 0
						, windSpeed: 0
						, pressure: 0
						, mediaPerSol: 0
					}
				}, function() {
					helpers.output('Stats doc created');
					callback();
				});
			} else {
				callback();
			}
		});
	}

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
				updateStats(function(doc) {
					return {
						$set: {
							totals: {
								media: ++doc.totals.media
							}
						}
					}
				});
				parseImageData(images);
			});
		});
	}

	function parseImages(callback) {
		scrape('http://mars.jpl.nasa.gov/msl/admin/modules/multimedia/module/inc_ListImages_Raw4.cfm?s=' + parseInt(sol, 10), function($) {
			helpers.output('Parsing images ...');

			var images = []
				, imageEls = []
				, jQuery = $
				, isIncomplete = false;

			$('.RawImageCaption').each(function() {
				imageEls.push($(this));
			});

			db.find({ sol: sol }, function(err, docs) {
				if (docs.length > imageEls.length) {
					helpers.output('Database discrepency found for sol ' + sol);
				} else if (docs.length < imageEls.length || docs.length <= 0) {
					isIncomplete = true;
				}

				function verifyImage() {
					if (imageEls.length <= 0) {
						parseImageData(images);
						return;
					}

					var img = imageEls.shift()
						, root = img
						, imgLink = img.closest('td').find('a[href*="?rawid="]')
						, webImg = imgLink.find('img')
						, imgUrl = 'http://mars.jpl.nasa.gov/msl/multimedia/raw/' + imgLink.attr('href').replace('./', '');

					var data = {
						sol: sol
						, url: imgUrl
						, created_on: new Date().toISOString()
						, type: (webImg.attr('width') == 64 || webImg.attr('height') == 64) ? 'thumbnail' : 'full'
						, camera: webImg.attr('alt').replace('Image taken by ', '')
						, captured_time: img.find('.RawImageUTC').text().replace('Full Resolution', '').trim()
						, image: {
							raw: img.find('a:contains("Full Resolution")').attr('href')
							, web: webImg.attr('src')
						}
					};

					if (isIncomplete) {
						db.find({ url: imgUrl }, function(err, docs) {
							if (docs.length <= 0) images.push(data);
							verifyImage();
						});
					}
				}

				verifyImage();
			});
			
		});
	}

	function parseSlides() {
		if (solSlides.length <= 0) return;
		
		sol = solSlides.shift();
		helpers.output('Scraping ' + sol + ' ...');

		updateStats(function(doc) {
			if (doc.sols.indexOf(sol) !== -1) return false;
			return {
				$push: {
					sols: sol
				}
			}
		});

		parseWeather(function(err, resp, data) {
			data = JSON.parse(data);
			if (data.count > 0) weatherData = data.results;
			parseImages();
		});
	
	}

	function startScraping(index) {
		helpers.output('Requesting latest rover data ...');
		scrape('http://mars.jpl.nasa.gov/msl/multimedia/raw/?s=', function($) {

			// Not every Sol has data so we need to find the element index
			// for where the database initialization left off
			if (index) {
				$('.scroll-content-item').each(function(i) {
					if ($(this).text() == index) {
						index = i;
						return;
					}
				});
			}

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

	parseStats(function() {
		if (total > 0) {
			db.find({}).sort({ created_on: -1 }).limit(1).exec(function(err, docs) {
				startScraping(docs[0].sol);
			});
		} else {
			startScraping();
		}
	});

}

exports.run = function() {
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