/** @module pubsub */

function pubsub() {

	var _subscribers = {};

	/**
	 * Creates or adds a new subscriber 
	 * @param {string} Name of subscriber to listen for
	 * @param {function} Callback to be executed
	 */
	function _on(name, callback) {
		if (callback) {
			_subscribers[name] = _subscribers[name] || [];
			_subscribers[name].push({
				fn: callback
				, context: this
			});
		}
		return this;
	}

	/**
	 * Executes any attached subscribers 
	 * @param {string} Name of subscriber to execute callbacks for
	 */
	function _trigger(name) {
		if (_subscribers[name]) {
			var args = Array.prototype.slice.call(arguments, 1);
			_subscribers[name].forEach(function(subscriber) {
				subscriber.fn.apply(subscriber.context, args);
			});
		}
	}

	return {
		on: _on
		, trigger: _trigger
	}
}

module.exports = pubsub();