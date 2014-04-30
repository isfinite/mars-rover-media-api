exports.image = function() {
	this.rover = '';
	this.url = {
		site: ''
		, raw: ''
		, label: ''
	}
	this.camera = {
		cameraModelComponentList: ''
		, cameraPosition: ''
		, cameraModelType: ''
		, cameraVector: ''
		, subframeRect: ''
		, mastEl: ''
		, mastAz: ''
		, instrument: ''
		, xyz: ''
	}
	this.properties = {
		type: ''
		, width: null
		, height: null
		, filesize: null
	}
	this.timestamps = {
		created: null
		, captured: null
		, added: null
	}
	this.location = {
		site: null
		, drive: null
	}
	this.sclk = '';
	this.attitude = '';
}