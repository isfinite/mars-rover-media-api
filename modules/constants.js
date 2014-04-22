function define(name, val) {
	Object.defineProperty(exports, name, {
		value: val
		, enumerable: true
	});
}

define('DEBUG', true);