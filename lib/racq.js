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
		_ = require('lodash'),
		request = require('request'),
		dbg = require('debug'),
		debug = dbg('racq'),
		statistics = dbg('racq:statistics'),
		errors = require('./errors');

	//private variables
	var _userName,
		_apiKey,
		_token,
		_persistedTokenPath,
		_clientId,
		_defaultRegion,
		_authUrl,
		_queueUrl,
		_statistics;

	///////////////////////
	// Private function  //
	///////////////////////
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

	//Request wrapper, enabling statistics capture
	var httpRequest = function(method, options, callback) {
		var objectLength = function(o) {
			var length = 0;
			if(!_.isNull(o) && !_.isUndefined(o)) {
				if(_.isString(o)) {
					length = o.length;
				}
				else if(_.isObject(o)) {
					length = JSON.stringify(o).length;
				}
				else {
					debug('object type: %s', typeof o);
				}
			}
			return length;
		};

		var func = request[method];
		func(options, function(error, response, body) {
			_statistics.calls++;
			_statistics.bytesReceived += objectLength(body);
			_statistics.bytesSent += objectLength(options.json);
			statistics('Statistics:', _statistics);
			return callback(error, response, body);
		});
	};

	//return error object for function, based on response status code
	var returnError = function(functionName, statusCode) {
		statusCode = statusCode.toString();
		debug('Error: function=%s, status=%s', functionName, statusCode);
		if(Object.keys(errors.shared).indexOf(statusCode) !== -1) {
			return new Error(errors.shared[statusCode]);
		}
		else if(errors[functionName] && Object.keys(errors[functionName]).indexOf(statusCode) !== -1) {
			return new Error(errors[functionName][statusCode]);
		}
		else {
			return new Error('Status code: ' + statusCode);
		}
	};

	//turn a JSON object into a query string
	var objectToQueryString = function(obj) {
		return _.reduce(obj, function(result, value, key) {
				return (!_.isNull(value) && !_.isUndefined(value)) ? (result += key + '=' + value + '&') : result;
		}, '').slice(0, -1);
	};

	//get value from a query string
	var getValueFromQueryString = function(url, key) {
		return (new RegExp('[?|&]' + key + '=' + '([^&;]+?)(&|#|;|$)').exec(url) || [,""])[1].replace(/\+/g, '%20') || null;
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
	var getRequestHeaders = function(includeClientId) {
		var headers = {
			'Content-type': 'application/json',
			'Accept': 'application/json',
			'X-Auth-Token': _token.id
		};
		if(includeClientId) {
			headers['Client-ID'] = _clientId;
		}
		return headers;
	};

	//parse body and return messages object
	var processMessages = function(body) {
		var messages = JSON.parse(body),
			result = {
				messages: [],
				marker: getValueFromQueryString(_.findWhere(messages.links, {rel: 'next'}).href, 'marker')
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

	//parse body and return messages object
	var processClaims = function(body) {
		var claims = body || [],
			result = [];
		for(var i = 0; i < claims.length; i++) {
			var claim = claims[i];
			result.push({
				id: claim.href.split('/').pop().split('?')[0],
				claimId: getValueFromQueryString(claim.href, 'claim_id'),
				body: claim.body,
				ttl: claim.ttl,
				age: claim.age
			});
		}
		return result;
	};

	//constructor - process user options
	(function(options) {
		var guid = require('guid'),
			urls = require('./urls');

		_defaultRegion =  (options && options.region) ? options.region : 'dfw';
		_authUrl = urls.authUrl;
		_queueUrl = urls.queueUrl.replace('REGION', _defaultRegion);
		_clientId = (options && options.clientId) ? options.clientId : guid.raw();
		_statistics = {
			calls: 0,
			bytesReceived: 0,
			bytesSent: 0
		};
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
	}(options));

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
	 * Deletes the currently used token, making it possible to re-authenticate even if the actual token hasn't expired yet
	 */
	this.deleteToken = function() {
		_token = null;
	};

	/**
	 * Get current network statistics (for accounting purposes)
	 * @return {Object} statistics object containing number of calls, bytes sent, and bytes recieved so far
	 */
	this.getStatistics = function() {
		return _statistics;
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
		httpRequest('post', options, function(error, response, body) {
			if (!error && (response.statusCode === 200 || response.statusCode === 203)) {
				_token = body.access.token;
				debug('authenticate: ' + util.inspect(_token, true, null));
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
			url += '?' + objectToQueryString(parameters);
			debug(url);
		}
		var options = {
				url: url,
				headers: getRequestHeaders(false)
			};
		httpRequest('get', options, function(error, response, body) {
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
		httpRequest('put', options, function(error, response) {
			if (!error && (response.statusCode === 201 || response.statusCode === 204)) {
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
		httpRequest('del', options, function(error, response) {
			if (!error && (response.statusCode === 200 || response.statusCode === 204)) {
				debug('queue %s deleted', queueName);
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
		httpRequest('get', options, function(error, response) {
			if (!error  && (response.statusCode === 204 || response.statusCode === 404)) {
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
				debug('queueExists: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('queueExists', response.statusCode));
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
		httpRequest('get', options, function(error, response, body) {
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
		httpRequest('put', options, function(error, response) {
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
		httpRequest('get', options, function(error, response, body) {
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
		httpRequest('post', options, function(error, response) {
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
			url += '?' + objectToQueryString(parameters);
			debug(url);
		}
		var options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		httpRequest('get', options, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				var result = processMessages(body);
				debug('getMessages: %s messages retrieved', result.length);
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
        var separator = messageIds.indexOf(',') > -1 ? '?ids=' : '/',
            options = {
				url: getQueueUrl(queueName, true) + separator + messageIds,
				headers: getRequestHeaders(true)
			};
		httpRequest('get', options, function(error, response, body) {
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
        var separator = messageIds.indexOf(',') > -1 ? '?ids=' : '/',
            claim = messageIds.indexOf(',') > -1 ? '&' : '?',
            url = getQueueUrl(queueName, true) + separator + messageIds;

		if(arguments.length === 3) {
			callback = claimId;
		}
		else {
			url += claim + 'claim_id=' + claimId;
			debug(url);
		}
		var options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		httpRequest('del', options, function(error, response) {
			if(!error && (response.statusCode === 200 || response.statusCode === 204)) {
				debug('%s deleted from %s', messageIds, queueName);
				return callback(null);
			}
			else {
				debug('deleteMessage: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('deleteMessage', response.statusCode));
			}
		});
	};

	/////////////
	// Claims  //
	/////////////
	/**
	 * Claim messages: a client can mark messages it's handling with a claim, delete them upon process end,
	 * or releasing the claim if it takes too long to process
	 *
	 * @param  {String}   queueName
	 * @param  {Object}   [parameters] - claim paramters:
	 *					@param {Integer} [parameters.limit] maximum number of messages to claim. Can be 1-20, default 10
	 *					@param {Integer} [parameters.ttl]	time before server releases the claim. Can be 60-43200 seconds (12 hours), default 60
	 *					@param {Integer} [parameters.grace] grace period to extend claimed message's life. Can be 60-43200 seconds (12 hours), default 60
	 * @param  {Function} callback - Returns array of message objects on success, or error object
	 */
	this.claimMessages = function(queueName, parameters, callback) {
		var url = getQueueUrl(queueName) + '/claims';
		if(arguments.length === 2) {
			callback = parameters;
		}
		else {
			url += '?limit=' + parameters.limit;
		}
		var options = {
			url: url,
			headers: getRequestHeaders(true),
			json: parameters
		};
		httpRequest('post', options, function(error, response, body) {
			if(!error && response.statusCode === 201) {
				//debug('claimMessages: %s', util.inspect(body, true, 2));
				var claims = processClaims(body);
				debug('claimMessages: %s messages claimed', claims.length);
				return callback(null, claims);
			}
			else if(response.statusCode === 204) {
				debug('claimMessages: no messages claimed');
				return callback(null, null);
			}
			else {
				debug('claimMessages: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('claimMessages', response.statusCode), null);
			}
		});
	};

	/**
	 * Check which massages are claimed by claim ids
	 *
	 * @param  {String}   queueName
	 * @param  {String}   claimIds - one, or more claim ids to verify, separated by comma
	 * @param  {Function} callback - Returns array of message objects on success, or error object
	 */
	this.queryClaims = function(queueName, claimIds, callback) {
		var url = getQueueUrl(queueName, false) + '/claims/' + claimIds,
			options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		debug(url);
		httpRequest('get', options, function(error, response, body) {
			if(!error && response.statusCode === 200) {
				var messages = JSON.parse(body).messages || [];
				debug('queryClaims: %s messages claimed', messages.length);
				return callback(null, processClaims(messages));
			}
			else {
				debug('queryClaims: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('queryClaims', response.statusCode), null);
			}
		});
	};

	/**
	 * Update the TTL and grace period of claimed messages
	 *
	 * @param  {String}   queueName
	 * @param  {String}   claimIds - one, or more claim ids to verify, separated by comma
	 * @param  {Object}   parameters
	 * 			@param {Integer} parameters.ttl	time before server releases the claim. Can be 60-43200 seconds (12 hours), default 60
	 *			@param {Integer} parameters.grace grace period to extend claimed message's life. Can be 60-43200 seconds (12 hours), default 60
	 * @param  {Function} callback - Returns null on success, or error object
	 */
	this.updateClaims = function(queueName, claimIds, parameters, callback) {
		var url = getQueueUrl(queueName) + '/claims/' + claimIds,
			options = {
				url: url,
				headers: getRequestHeaders(true),
				json: parameters
			};
		httpRequest('patch', options, function(error, response) {
			debug('updateClaims: ' + response.statusCode);
			if(!error && (response.statusCode === 200 || response.statusCode === 204)) {
				return callback(null);
			}
			else {
				debug('updateClaims: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('updateClaims', response.statusCode));
			}
		});

	};

	/**
	 * Release claim on messages, allowing them to be claimed by a different client
	 *
	 * @param  {String}   queueName
	 * @param  {String}   claimIds - one, or more claim ids to verify, separated by comma
	 * @param  {Function} callback - Returns null on success, or error object
	 */
	this.releaseClaims = function(queueName, claimIds, callback) {
		var url = getQueueUrl(queueName) + '/claims/' + claimIds,
			options = {
				url: url,
				headers: getRequestHeaders(true)
			};
		httpRequest('del', options, function(error, response) {
			if(!error && (response.statusCode === 200 || response.statusCode === 204)) {
				return callback(null);
			}
			else {
				debug('releaseClaims: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error || returnError('releaseClaims', response.statusCode));
			}
		});
	};
};

module.exports = RacQ;