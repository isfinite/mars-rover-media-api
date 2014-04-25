var Datastore = require('nedb')
	, request = require('request')
	, helpers = require('../modules/helpers.js')
	, scrape = require('../modules/scrape.js').scrape
	, db;

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
						media: {
							full: 0
							, thumbnail: 0
						}
						, camera: {}
					}
					, averages: {
						min_temp: []
						, max_temp: []
						, windSpeed: []
						, pressure: []
						, mediaPerSol: []
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
					var updateObj = {
						$set: {}
						, $push: {}
					};

					updateObj['$set']['totals.media.' + imgData.type] = ++doc.totals.media[imgData.type]

					if (doc.cameras.indexOf(imgData.camera) === -1) {
						updateObj['$push'] = {
							cameras: imgData.camera
						}
					};

					// helpers.output(doc);

					var cameraClean = [helpers.cleanString(imgData.camera)];
					updateObj['$set']['totals.camera.' + cameraClean] = ++doc.totals.camera[cameraClean] || 1;

					return updateObj;
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

				updateStats(function(doc) {
					var updateObj = {
						$addToSet: {}
					}
					updateObj['$addToSet']['averages.mediaPerSol'] = {
						sol: sol
						, length: imageEls.length
					}
					return updateObj;
				});

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
					} else {
						parseSlides();
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
			return {
				$addToSet: {
					sols: sol
				}
			}
		});

		parseWeather(function(err, resp, data) {
			data = JSON.parse(data);
			if (data.count > 0) weatherData = data.results;

			if (weatherData) {
				updateStats(function(doc) {
					var updateObj = {
						$addToSet: {}
					}
					if (weatherData.min_temp) {
						updateObj['$addToSet']['averages.min_temp'] = {
							sol: sol
							, min_temp: weatherData.min_temp
							, min_temp_fahrenheit: weatherData.min_temp_fahrenheit
						}
					}
					if (weatherData.max_temp) {
						updateObj['$addToSet']['averages.max_temp'] = {
							sol: sol
							, max_temp: weatherData.max_temp
							, max_temp_fahrenheit: weatherData.max_temp_fahrenheit
						}
					}
					if (weatherData.pressure) {
						updateObj['$addToSet']['averages.pressure'] = {
							sol: sol
							, pressure: weatherData.pressure
						}
					}
					if (weatherData.wind_speed) {
						updateObj['$addToSet']['averages.wind_speed'] = {
							sol: sol
							, wind_speed: weatherData.wind_speed
						}
					}
					return updateObj;
				});
			}

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
	db.count({}, function(err, count) {
		helpers.output('Total items in database: ' + count);
		setupDb(count);
	});
}

exports.loadDb = function(callback) {
	db = new Datastore({ filename: process.cwd() + '/datastore/data', autoload: true, onload: callback });
}

exports.getDb = function() {
	if (db) return db;
}

/*
scrape('http://mars.jpl.nasa.gov/msl/multimedia/raw/?s=', function scrapeCallback($) {
	var latestSol = $('.scroll-content-item:last').text();
});
*/