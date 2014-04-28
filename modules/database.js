var Datastore = require('nedb')
	, request = require('request')
	, helpers = require('../modules/helpers.js')
	, scrape = require('../modules/scrape.js').scrape
	, server = require('../server.js')
	, db;

function setupDb(total) {

	var solSlides = []
		, weatherData, sol, mslLocations;

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

	function saveImageDataToDb(images, stats) {
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

				saveImageDataToDb(images, stats);
			});
		});
	}

	function getRoverLocationData(drive) {
		if (mslLocations) {
			var mslLocationsClone = mslLocations.slice(0)
				, roverLocationData = false;

			do {
				var item = mslLocationsClone.shift();
				if (parseInt(item.drive[0], 10) == parseInt(drive, 10)) {
					roverLocationData = item;
					break;
				}
			} while(mslLocationsClone.length > 0);

			return roverLocationData;
		}
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
					
					// Finished parsing images, cleanup and move on to inserting in db
					if (imageEls.length <= 0) {
						var i = images.length - 1
							, loc;

						// Search for an image with location data 
						do {
							if (images[i].location.site && images[i].location.drive) {
								loc = images[i].location;
								i = images.length - 1;
								break;
							}
						} while (--i >= 0);

						// Found an image with location data, now apply to other images in sequence with missing data
						if (loc) {
							var roverLocData = getRoverLocationData(loc.drive);
							do {
								if (roverLocData) {
									images[i].rover = {
										x: roverLocData.x || null
										, y: roverLocData.y || null
										, z: roverLocData.z || null
										, rot: roverLocData.rot || null
										, lat: roverLocData.lat || null
										, lon: roverLocData.lon || null
										, mapPixelH: roverLocData.mapPixelH || null
										, mapPixelV: roverLocData.mapPixelV || null
									}
								}
								if (!images[i].location.site || !images[i].location.drive) images[i].location = loc;
							} while (--i >= 0);
						}

						saveImageDataToDb(images);
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

							var filename = imgLinkQS.split('&').shift()
								, isSISFilename = imgLinkQS.split('_').length > 2
								, inst = null
								, config = null
								, sclk = null
								, samp = null
								, site = null
								, drive = null
								, seqid = null;

							if (isSISFilename) {
								inst = filename.slice(0, 2);
								config = filename.slice(2, 3);
								sclk = filename.slice(4, 13);
								samp = filename.slice(17, 18);
								site = filename.slice(18, 21);
								drive = filename.slice(21, 25);
								seqid = filename.slice(25, 34);
							} else if (filename.length < 25) {
								inst = filename.slice(4, 6);
								seqid = filename.slice(6, 16);
								samp = filename.slice(16, 17);
							} else if (filename.length > 29 && filename.length < 32) {
								inst = filename.slice(4, 6);
								seqid = filename.slice(6, 12);
								samp = filename.slice(22, 23);
							}

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
										instrument: inst
										, config: config
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
								, sclk: sclk
								, location: {
									site: site
									, drive: drive
								}
								, seqid: seqid
								, samp: samp
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

		sol = solSlides.pop();
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

	function getLocationData(callback) {
		
		helpers.output('Requesting historical rover location data ...');
		require('http').get('http://mars.jpl.nasa.gov/msl-raw-images/locations.xml', function(res) {
			var body = '';

			res
				.on('data', function(chunk) {
					body += chunk;
				})
				.on('end', function() {
					var parseString = require('xml2js').parseString;
					parseString(body, function (err, result) {
						mslLocations = result.msl.location;
						callback();
					});
				});

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
		getLocationData(function() {
			if (total > 0) {
				db.find({ $not: { stats: true }}).sort({ sol: -1 }).limit(1).exec(function(err, docs) {
					startScraping(docs[0] && docs[0].sol || '0000');
				});
			} else {
				startScraping();
			}
		});
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