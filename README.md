Mars Rover Media API (MRMA)
====================

The Mars Rover Media API (MRMA) is an open-source REST API built on top of node.js and the Express framework. It uses NeDB for filesystem database storage and Socket.io for exposing. MRMA gathers data from a variety of sources and compiles them together to provide a rich data API for the images currently being gathered by the rovers.

## API Examples

Show all the images in Site 031 AND Drive 1256

	http://localhost:3000/v1/sols?site=031&drive=1256

Show all the images in Site 031 with a pixel width less than or equal to 100 and a filesize less than 1000 bytes

	http://localhost:3000/v1/sols?site=031&width=100&filesize=1000

Show all the images in Sols 600 - 615 with pressure less than 1000 and a maximum temperature of less than -18

	http://localhost:3000/v1/sols?gte=0600&lte=0615&pressure=1000&max_temp_fahrenheit=-18

## License

MIT