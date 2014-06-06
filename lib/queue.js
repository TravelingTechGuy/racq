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
				console.error('file %s does not exist', _persistedTokenPath);
			}	
		}
		else {
			debug('no path provided');
		}
		return token;
	};

	//persist user options
	var initialize = function(options) {
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
		_clientId = (options && options.clientId) ? options.clientId : require('guid').raw();
	};

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
				// debug(util.inspect(_token, true, null));
				if(_persistedTokenPath) {
					persistToken();
				}
				return callback(null);
			}
			else {
				_token = null;
				console.error('authenticate: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error);
			}
		});
	};
	
	/**
	 * List all queues in account
	 * @param  {Function} callback. Returns with array of queus on success, or error object
	 */
	this.listQueues = function(callback) {
		var options = {
				url: getQueueUrl(),
				headers: getRequestHeaders()
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				return callback(null, JSON.parse(body).queues);
			}
			else {
				console.error('listQueues: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error, null);
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
					return callback({error: 'queue exists'});
				}
				else {
					console.error('createQueue: ' + (error || 'statusCode: ' + response.statusCode));
					return callback(error);
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
				return callback(null);
			}
			else {
				console.error('deleteQueue: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error);
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
					return callback(null, true);
				}
				else if(response.statusCode === 404) {
					return callback(null, false);
				}
			}
			else {
				console.error('queueExists: ' + error);
				return callback(error);
			}
		});	
	};

	
	initialize(options);
};


module.exports = Queue;