'use strict';
/**
 * Wrapper for the Rackspace Cloud Queues API
 * 
 * @module  RacQ
 * @author Guy Vider
 * @copyright 2014 (c) Traveling Tech Guy LLC
 * @license  MIT
 * @see {@link http://docs.rackspace.com/queues/api/v1.0/cq-devguide/content/overview.html|Rackspace documentation}
 */

/**
 * @constructor 
 * 
 * @param {Object} [options] null, or an object containing the following properties:
 * 		@param {String} options.userName - Rackspace user name (specify here, or when calling {@link authenticate})
 * 		@param {String} options.apiKey	- Rackspace API key (specify here, or when calling {@link authenticate})
 * 		@param {String} [options.region] - Rackspace default region. Can be one of: iad, ord, dfw, hkg, lon, syd - defaults to dfw
 * 		@param {String} [options.clientId] - A GUID identifying the current queue client. Defaults to a random GUID
 * 		@param {String} [options.persistedTokenPath] - If provided, auth token will be persisted locally, and looked for at this path
 */
var RacQ = function(options) {
	//external libraries
	var util = require('util'),
		fs = require('fs'),
		guid = require('guid'),
		_ = require('lodash'),
		request = require('request'),
		debug = require('debug')('racq'),
		errors = require('./errors');
		
	//private variables
	var _userName,
		_apiKey,
		_token,
		_persistedTokenPath,
		_clientId,
		_defaultRegion,
		_authUrl,
		_queueUrl;

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

	var returnError = function(functionName, statusCode) {
		if(Object.keys(errors.shared).indexOf(statusCode) !== -1) {
			functionName = 'shared';
		}
		return new Error(errors[functionName][statusCode]);
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
		else {
			_defaultRegion = 'dfw';
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
	 * 
	 * Authenticates credentials against Rackspace auth endpoint, receiveing the auth token used in the rest of the calls.
	 * If a path has been specified in constructor, token will be taken from local file, 
	 * and received token will be persisted to local file.
	 * 
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
			if (!error && (response.statusCode === 200 || response.statusCode === 203)) {
				_token = body.access.token;
				debug(util.inspect(_token, true, null));
				if(_persistedTokenPath) {
					persistToken();
				}
				return callback(null);
			}
			else {
				_token = null;
				debug('authenticate: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('authenticate', response.statusCode), null);
			}
		});
	};
	
	///////////////////////
	// Queue operations  //
	///////////////////////
	/**
	 * List all queues in account, in alphabetical order
	 * 
	 * @param {Object} [parameters] - query parameters. Can be null, or an object with one or more of the following:
	 * 		@param {Integer} [parameters.limit] - limit number of queues returned (1-10, default: 10)
	 * 		@param {Integer} [parameters.marker] - The marker to use to get the next batch of messages
	 * 		@param {Boolean} [parameters.detailed] - should queue data include metadata (default: false)
	 * @param  {Function} callback - Returns with array of queues on success, or error object
	 */
	this.listQueues = function(parameters, callback) {
		var url = getQueueUrl();
		if(arguments.length === 1) {	//no parameters object supplied
			callback = parameters;
		}
		else {
			url += '?' + _.reduce(parameters, function(result, value, key) {
				return (value) ? (result += key + '=' + value + '&') : result;
			}, '').slice(0, -1);
			debug(url);
		}
		var options = {
				url: url,
				headers: getRequestHeaders()
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body).queues;
				debug(util.inspect(result));
				return callback(null, result);
			}
			else {
				debug('listQueues: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('listQueues', response.statusCode), null);
			}
		});
	};

	/**
	 * Create new queue
	 * @param  {String}   queueName
	 * @param  {Function} callback - Returns with null on success, or error object
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
				debug('createQueue: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('createQueue', response.statusCode));
			}
		});
	};

	/**
	 * Delete queue
	 * @param  {String}   queueName
	 * @param  {Function} callback - Returns with null on success, or error object
	 */
	this.deleteQueue = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName),
				headers: getRequestHeaders(false)
			};
		request.del(options, function(error, response) {
			if (!error && (response.statusCode === 200 || response.statusCode === 204)) {
				debug('queue %s deleted', queueName)
				return callback(null);
			}
			else {
				debug('deleteQueue: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('deleteQueue', response.statusCode));
			}
		});	
	};

	/**
	 * Checks whether a queue exists
	 * @param  {String}   queueName
	 * @param  {Function} callback - Returns with true if queue exists, false otherwise, or error object
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
				debug('queueExists: ' + error);
				return callback(error);
			}
		});	
	};

	/**
	 * Get queue statistics
	 * @param  {String}   queueName
	 * @param  {Function} callback - Returns with stats, or error object
	 */
	this.getQueueStats = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/stats',
				headers: getRequestHeaders(false)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body);
				debug('getQueueStats: %s', util.inspect(result));
				return callback(null, result);
			}
			else {
				debug('getQueueStats: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('getQueueStats', response.statusCode), null);
			}
		});	
	};
	
	/**
	 * Set queue metatdata
	 * 
	 * @param {String}   queueName
	 * @param {Object}   metadata
	 * @param {Function} callback - Returns null on success, or error object
	 */
	this.setQueueMetadata = function(queueName, metadata, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/metadata',
				headers: getRequestHeaders(false),
				json: metadata
			};
		request.put(options, function(error, response) {
			if (!error && response.statusCode === 204) {
				return callback(null);
			}
			else {
				debug('setQueueMetadata: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('setQueueMetadata', response.statusCode));
			}
		});	
	};

	/**
	 * Get queue metadata
	 * 
	 * @param  {String}   queueName
	 * @param  {Function} callback - Returns with queue metadata, or error object
	 */
	this.getQueueMetadata = function(queueName, callback) {
		var options = {
				url: getQueueUrl(queueName) + '/metadata',
				headers: getRequestHeaders(false)
			};
		request.get(options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = JSON.parse(body);
				debug('getQueueMetadata: %s', util.inspect(result));
				return callback(null, result);
			}
			else {
				debug('getQueueMetadata: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('getQueueMetadata', response.statusCode), null);
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
	 * 							@param {Integer} messages.ttl Time-To-Live for message in seconds (min. value 60)
	 *							@param {Object} messages.body A JSON message object
	 * @param  {Function} callback - Returns null if successful, or error object
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
			if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
				debug('postMessages: %s messages posted', messages.length);
				return callback(null);
			}
			else {
				debug('postMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('postMessages', response.statusCode));
			}
		});
	};

	/**
	 * Get messages from queue
	 * Can be invoked with 2, 3 or 4 parameters: queueName, [echo], [limit], callback
	 *  
	 * @param {String} queueName
	 * @param {Object} [parameters] - query parameters. Can be null, or an object with one or more of the following:
	 * 		@param {Integer} [parameters.limit] - limit number of messages returned (1-10, default: 10)
	 * 		@param {Integer} [parameters.marker] - The marker to use to get the next batch of messages
	 * 		@param {Boolean} [parameters.echo] - should messages put by this client be returned (default: false)
	 * 		@param {Boolean} [parameters.include_claimed] - should claimed messages be returned (default: false)
	 * @param {Function} callback - Returns array of message objects on success, or error object
	 */
	this.getMessages = function(queueName, parameters, callback) {
		var url = getQueueUrl(queueName, true);
		if(arguments.length === 2) {	//no parameters object supplied
			callback = parameters;
		}
		else {
			url += '?' + _.reduce(parameters, function(result, value, key) {
				return (value) ? (result += key + '=' + value + '&') : result;
			}, '').slice(0, -1);
			debug(url);
		}
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
				debug('getMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('getMessages', response.statusCode), null);
			}
		});
	};

	/**
	 * Get message/s by id/s
	 * 
	 * @param  {String}   queueName
	 * @param  {String}   messageIds - one or more message ids, seperated by comma
	 * @param  {Function} callback - Returns array of message objects on success, or error object
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
				debug('getMessageById: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('getMessagesById', response.statusCode), null);
			}
		});
	};

	/**
	 * Delete message from queue
	 * 
	 * @param  {String}   queueName
	 * @param  {String}   messageIds - one or more message ids, separated by comma
	 * @param {String} [claimId] - if provided, will provide the claim Id for a SINGLE message to be deleted
	 * @param  {Function} callback - Returns null on success, or error object
	 */
	this.deleteMessages = function(queueName, messageIds, claimId, callback) {
		var url = getQueueUrl(queueName, true) + '/' + messageIds;
		if(arguments.length === 3) {
			callback = claimId;
		}
		else {
			url += '?claim_id=' + claimId;
			debug(url);
		}
		var options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		request.del(options, function(error, response) {
			if(!error && (response.statusCode === 200 || response.statusCode === 204)) {
				debug('%s deleted from %s', messageIds, queueName);
				return callback(null);
			}
			else {
				debug('deleteMessgage: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('deleteMessage', response.statusCode));
			}
		});
	};

	/////////////
	// Claims  //
	/////////////
};

module.exports = RacQ;