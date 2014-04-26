var Datastore = require('nedb')
	, request = require('request')
	, helpers = require('../modules/helpers.js')
	, scrape = require('../modules/scrape.js').scrape
	, server = require('../server.js')
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
					db.findOne({ stats: true }, function(err, doc) {
						server.io.sockets.emit('stats', doc);
					});
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
					, sols: []
					, totals: {
						media: {
							full: 0
							, thumbnail: 0
						}
						, cameras: {}
					}
					, averages: {}
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

	function parseImageData(images, stats) {
		if (images.length <= 0) {
			db.update({ stats: true }, { $set: {
				totals: stats.totals
			}});
			parseSlides();
			return;
		}

		var imgData = images.shift();		

		if (weatherData) imgData.weather = weatherData;

		helpers.output('Inserting image record into database ... Remaining insertions: ' + images.length);

		db.insert(imgData, function(newDoc) {
			db.findOne({ stats: true }, function(err, doc) {
				stats = stats || doc;

				stats.totals.media[imgData.type] = ++stats.totals.media[imgData.type] || 1;
				stats.totals.cameras[imgData.camera.clean] = ++stats.totals.cameras[imgData.camera.clean] || 1;

				parseImageData(images, stats);
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
						, imgLinkQS = imgLink.attr('href').split('=')[1]
						, webImg = imgLink.find('img')
						, imgUrl = 'http://mars.jpl.nasa.gov/msl/multimedia/raw/' + imgLink.attr('href').replace('./', '')
						, imgRawUrl = img.find('a:contains("Full Resolution")').attr('href')
						, cameraType = webImg.attr('alt').replace('Image taken by ', '');

					helpers.output('Requesting image ' + imgLinkQS + ' | ' + imageEls.length + ' images remaining');

					var req = require('http').get(imgRawUrl, function(resp) {
						require('imagesize')(resp, function(err, res) {

							var parseFilename = imgLinkQS.split('_').length > 2;

							var data = {
								sol: sol
								, url: {
									site: imgUrl
									, raw: imgRawUrl
									, web: webImg.attr('src')
								}
								, type: (webImg.attr('width') == 64 || webImg.attr('height') == 64) ? 'thumbnail' : 'full'
								, camera: {
									pretty: cameraType
									, clean: helpers.cleanString(cameraType)
									, raw: {
										instrument: parseFilename && imgLinkQS.slice(0, 2) || null
										, config: parseFilename && imgLinkQS.slice(2, 3) || null
									}
								}
								, properties: {
									width: res && res.width || null
									, height: res && res.height || null
									, filesize: resp && resp.headers && resp.headers['content-length'] || null
								}
								, timestamps: {
									created: new Date().toISOString()
									, captured: img.find('.RawImageUTC').text().replace('Full Resolution', '').trim()
								}
								, sclk: parseFilename && imgLinkQS.slice(4,13) || null
								, location: {
									site: parseFilename && imgLinkQS.slice(18,21) || null
									, drive: parseFilename && imgLinkQS.slice(21,25) || null
								}
								, seqid: parseFilename && imgLinkQS.slice(25,34) || null
								, samp: parseFilename && imgLinkQS.slice(17,18) || null
							};

							if (isIncomplete) {
								db.find({ url: imgUrl }, function(err, docs) {
									if (docs.length <= 0) images.push(data);
									verifyImage();
								});
							} else {
								parseSlides();
							}

							req.abort();
						});
					});
					
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
			
			if (data.count > 0) weatherData = data.results.shift();

			if (weatherData) {
				updateStats(function(doc) {
					var updateObj = { $addToSet: {} }
					for (var k in  weatherData) {
						if (k === 'terrestrial_date' || k === 'sol' || k === 'ls') continue;
						var dataToAdd = { sol: sol };
						dataToAdd[k] = weatherData[k];
						updateObj['$addToSet']['averages.' + k] = dataToAdd;
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
			db.find({ $not: { stats: true }}).sort({ sol: -1 }).limit(1).exec(function(err, docs) {
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