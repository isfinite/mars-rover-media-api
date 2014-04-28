Mars Rover Media API (MRMA)
====================

The Mars Rover Media API (MRMA) is an open-source REST API built on top of node.js and the Express framework. In addition it uses NeDB for filesystem database storage and Socket.io for realtime data access. MRMA gathers data from a variety of sources and compiles them together to provide a rich data API for the images currently being gathered by the rovers.

Currently MRMA is optimized for localhost only, however, MongoDB support will be arriving shortly.

## Quickstart
	
	node server.js
	
## Database

MRMA uses NeDB to provide a filesystem database based on MongoDB to allow you to easily run a copy of the API via localhost. The first time you run the API a new data file will be created for you and will begin getting all of the rover data starting from Sol 0000.

If you would like to skip this process you can simply unzip the data.zip file and place the data file into ./datastore

## API Examples

Show all the images in Site 031 AND Drive 1256

	http://localhost:3000/v1/sols?site=031&drive=1256

Show all the images in Site 031 with a pixel width less than or equal to 100 and a filesize less than 1000 bytes

	http://localhost:3000/v1/sols?site=031&width=100&filesize=1000

Show all the images in Sols 600 - 615 with pressure less than 1000 and a maximum temperature of less than -18

	http://localhost:3000/v1/sols?gte=0600&lte=0615&pressure=1000&max_temp_fahrenheit=-18
	
## Roadmap

* MongoDB support
* Convert DB daemon to only use public json data
* More accurate location data for each image
* Better filename parsing
* Export result set to CSV option
* Adding data for Odyssey

## License

MIT
