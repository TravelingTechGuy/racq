'use strict';


/**
 * Main Queue class wrapping the Rackspace Cloud Queues API
 * For further documentation: http://docs.rackspace.com/queues/api/v1.0/cq-devguide/content/overview.html
 *
 * @class Queue
 * @constructor 
 * @param {Object} [options] contains the following properties:
 * 	userName {String}	- Rackspace user name
 * 	apiKey {String}		- Rackspace API key
 * 	region {String}		- Rackspace default region. Can be one of: iad, ord, dfw, hkg, lon, syd - defaults to dfw
 * 	clientId {String}	- A GUID identifying the current queue client. Defaults to a random GUID
 *	persistedTokenPath {String} - If provided, auth token will be persisted locally
 */
var Queue = function(options) {
	//external libraries
	var util = require('util'),
		fs = require('fs'),
		guid = require('guid'),
		_ = require('lodash'),
		request = require('request'),
		debug = require('debug')('queue');
		
	//private variables
	var _userName,
		_apiKey,
		_token,
		_persistedTokenPath,
		_clientId,
		_defaultRegion,
		_authUrl,
		_queueUrl,
		self = this;

	//persist auth token to file
	var persistToken = function() {
		fs.writeFileSync(_persistedTokenPath, JSON.stringify(_token), {encoding: 'utf-8'});
		debug('token persisted to file %s', _persistedTokenPath);
	};

	//get auth token from file
	var getPersistedToken = function() {
		var token = null;
		if(_persistedTokenPath) {
			if(fs.existsSync(_persistedTokenPath)) {
				token = JSON.parse(fs.readFileSync(_persistedTokenPath), {encoding: 'utf-8'});
				debug('token read from file %s', _persistedTokenPath);
			}
			else {
				debug('file %s does not exist', _persistedTokenPath);
			}	
		}
		else {
			debug('no path provided');
		}
		return token;
	};

	var returnError = function(statusCode) {
		return new Error('status code: ' + statusCode);
	};

	//process user options
	(function(options) {
		if(options && options.userName) {
			_userName = options.userName;
		}
		if(options && options.apiKey) {
			_apiKey = options.apiKey;
		}
		if(options && options.persistedTokenPath) {
			_persistedTokenPath = options.persistedTokenPath;
			_token = getPersistedToken();
		}
		if(options && options.region) {
			_defaultRegion = options.region;
		}
		var urls = require('./urls');
		_authUrl = urls.authUrl;	
		_queueUrl = urls.queueUrl.replace('REGION', _defaultRegion);
		_clientId = (options && options.clientId) ? options.clientId : guid.raw();
	}(options));

	//build url for queue/message operations
	var getQueueUrl = function(queue, messages) {
		var url = _queueUrl;
		if(queue) {
			url += '/' + queue;
		}
		if(messages) {
			url += '/messages';
		}
		return url;
	};

	//set default request headers
	var getRequestHeaders = function() {
		var headers = {
			'Content-type': 'application/json',
			'X-Auth-Token': _token.id,
			'Client-ID': _clientId
		};
		return headers;
	};

	//parse body and return messages object
	var processMessages = function(body) {
		var getMarker = function(marker) {
			var link = _.findWhere(messages.links, {rel: marker});
			if(link) {
				link = link.href;
				var index = link.indexOf('marker') + 'marker'.length + 1;
				return link.substring(index, link.indexOf('&', index));
			}
			return null;
		};
		var messages = JSON.parse(body),
			result = {
				messages: [],
				marker: getMarker('next')
			};
		for(var i = 0; i < messages.messages.length; i++) {
			var message = messages.messages[i];
			result.messages.push({
				id: message.href.split('/').pop(),
				body: message.body,
				ttl: message.ttl,
				age: message.age
			});
		}
		return result;
	};

	/////////////////////
	// Authentication  //
	/////////////////////
	/**
	 * Get current client ID
	 * @return {String} client ID GUID
	 */
	this.getClientId = function() {
		return _clientId;
	};

	/**
	 * Authenticate API calls
	 * Authenticates credentials against Rackspace auth endpoint, receiveing the auth token used in the rest of the calls
	 * If a path has been specified in constructor, persisted token will taken from local file, 
	 * and received token will be persisted to local file.
	 * @param {String} [userName] - Rackspace user name (if not provided to constructor)
	 * @param {String} [apiKey] - Rackspace user name (if not provided to constructor)
	 * @param {Function} callback - the function to call when authentication ends. Returns with null on success, or error object
	 */
	this.authenticate = function(userName, apiKey, callback) {
		//if userName and apiKey have been provided earlier
		if(arguments.length === 1) {
			userName = _userName;
			apiKey = _apiKey;
			callback = arguments[0];
		}
		//if we already have a valid token, return
		if(_token && (new Date(_token.expires)) > Date.now()) {
			return callback(null);
		}
		
		var options = {
				url: _authUrl,
				json: {
					auth: {
						'RAX-KSKEY:apiKeyCredentials': {
							'username': userName, 
							'apiKey': apiKey
						}
					}
				}
			};		
		request.post(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				_token = body.access.token;
				debug(util.inspect(_token, true, null));
				if(_persistedTokenPath) {
					persistToken();
				}
				return callback(null);
			}
			else {
				_token = null;
				console.error('authenticate: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});
	};
	
	///////////////////////
	// Queue operations  //
	///////////////////////
	/**
	 * List all queues in account
	 * 
	 * @param  {Function} callback. Returns with array of queues on success, or error object
	 */
	this.listQueues = function(callback) {
		var options = {
				url: getQueueUrl(),
				headers: getRequestHeaders()
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body).queues;
				debug(util.inspect(result));
				return callback(null, result);
			}
			else {
				console.error('listQueues: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});
	};

	/**
	 * Create new queue
	 * @param  {String}   queueName
	 * @param  {Function} callback. Returns with null on success, or error object
	 */
	this.createQueue = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName),
				headers: getRequestHeaders(false)
			};
		request.put(options, function(error, response) {
			if (!error && response.statusCode === 201) {
				return callback(null);
			}
			else {
				if(response.statusCode === 204) {
					debug('queue %s already exists', queueName);
					return callback(new Error('queue ' + queueName + ' already exists'));
				}
				else {
					console.error('createQueue: ' + (error || 'statusCode: ' + response.statusCode));
					return callback(error || returnError(response.statusCode));
				}
			}
		});
	};

	/**
	 * Delete queue
	 * @param  {String}   queueName
	 * @param  {Function} callback. Returns with null on success, or error object
	 */
	this.deleteQueue = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName),
				headers: getRequestHeaders(false)
			};
		request.del(options, function(error, response) {
			if (!error && response.statusCode === 204) {
				debug('queue %s deleted', queueName)
				return callback(null);
			}
			else {
				console.error('deleteQueue: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode));
			}
		});	
	};

	/**
	 * Checks whether a queue exists
	 * @param  {String}   queueName
	 * @param  {Function} callback. Returns with true if queue exists, false otherwise, or error object
	 */
	this.queueExists = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName),
				headers: getRequestHeaders(false)
			};
		request.get(options, function(error, response) {
			if (!error) {
				if(response.statusCode === 204) {
					debug('queue %s exists', queueName);
					return callback(null, true);
				}
				else if(response.statusCode === 404) {
					debug('queue %s does not exist', queueName);
					return callback(null, false);
				}
			}
			else {
				console.error('queueExists: ' + error);
				return callback(error || returnError(response.statusCode));
			}
		});	
	};

	/**
	 * Get queue statistics
	 * @param  {String}   queueName
	 * @param  {Function} callback. Returns with stats, or error object
	 */
	this.getQueueStats = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/stats',
				headers: getRequestHeaders(false)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body);
				debug(util.inspect(result));
				return callback(null, result);
			}
			else {
				console.error('getQueueStats: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});	
	};
	
	/**
	 * Get queue metadata
	 * @param  {String}   queueName
	 * @param  {Function} callback. Returns with queue metadata, or error object
	 */
	this.getQueueMetadata = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/metadata',
				headers: getRequestHeaders(false)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body);
				debug(util.inspect(result));
				return callback(null, result);
			}
			else {
				console.error('getQueueMetadata: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});	
	};
	
	/**
	 * Set queue metatdata
	 * @param {String}   queueName
	 * @param {Object}   metadata
	 * @param {Function} callback. Returns null on success, or error object
	 */
	this.setQueueMetadata = function(queueName, metadata, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/metadata',
				headers: getRequestHeaders(false),
				json: metadata
			};
		request.put(options, function(error, response, body) {
			if (!error && response.statusCode === 204) {
				return callback(null);
			}
			else {
				console.error('setQueueMetadata: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode));
			}
		});	
	};

	//////////////////////////
	// Message operations   //
	//////////////////////////
	/**
	 * Put message/s in queue
	 * 
	 * @param  {String}			queueName
	 * @param  {Object|Array}	messages - Object, or Array of Objects, 1-10 messages in the following format:
	 * 							{
	 *								ttl: {Integer},
	 *								body: {Object}
	 *							}
	 * @param  {Function} callback. Returns null if successful, or error object
	 */
	this.postMessages = function(queueName, messages, callback) {
		if(!_.isArray(messages)) {
			debug('single message posted');
			messages = [messages];
		}
		var options = {
				url: getQueueUrl(queueName, true),
				headers: getRequestHeaders(true),
				json: messages
			};
		request.post(options, function(error, response) {
			if (!error && response.statusCode === 201) {
				return callback(null);
			}
			else {
				console.error('postMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode));
			}
		});
	};

	/**
	 * Get messages from queue
	 * Can be invoked with 2, 3 or 4 parameters: queueName, [echo], [limit], callback
	 *  
	 * @param {String} queueName
	 * @param {Object} parameters - query parameters. Can be null, or an object with one or more of the following:
	 * 			limit {Integer} - limit number of messages returned (1-10, default 10)
	 * 			marker {Integer} - The marker to use to get the next/prev messages - used for paging
	 * 			echo {Boolean} - should messages put by this client be returned (default false)
	 * 			include_claimed {Boolean} - should claimed messages be returned (default false)
	 * @param {Function} callback. Returns array of message objects on success, or error object
	 */
	this.getMessages = function(queueName, parameters, callback) {
		var url = getQueueUrl(queueName, true);
		if(parameters) {
			url += '?' + _.reduce(parameters, function(result, value, key) {
				return (value) ? (result += key + '=' + value + '&') : result;
			}, '').slice(0, -1);
		}
		debug(url);
		var options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = processMessages(body);
				return callback(null, result);
			}
			else {
				console.error('getMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});
	};

	/**
	 * Get message/s by id/s
	 * 
	 * @param  {String}   queueName
	 * @param  {String}   messageIds - one or more message ids, seperated by ,
	 * @param  {Function} callback. Returns array of message objects on success, or error object
	 */
	this.getMessagesById = function(queueName, messageIds, callback) {
		var options = {
				url: getQueueUrl(queueName, true) + '/' + messageIds,
				headers: getRequestHeaders(true)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				return callback(null, JSON.parse(body));
			}
			else {
				console.error('getMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode), null);
			}
		});
	};

	/**
	 * Delete message from queue
	 * 
	 * @param  {String}   queueName
	 * @param  {String}   messageId
	 * @param  {Function} callback. Returns null on success, or error object
	 */
	this.deleteMessage = function(queueName, messageId, callback) {
		var options = {
				url: getQueueUrl(queueName, true) + '/' + messageId,
				headers: getRequestHeaders(true)
			};
		request.del(options, function(error, response) {
			if(!error && response.statusCode === 204) {
				debug('message %s deleted from %s', messageId, queueName);
				return callback(null);
			}
			else {
				console.error('deleteMessgage: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError(response.statusCode));
			}
		});
	};

	/////////////
	// Claims  //
	/////////////
};


module.exports = Queue;