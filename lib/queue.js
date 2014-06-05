'use strict';

var Queue = function(options) {
	var util = require('util'),
		fs = require('fs'),
		_ = require('lodash'),
		request = require('request'),
		debug = require('debug')('queue');
	
	var self = this;
	
	//persist user options
	var initialize = function(options) {
		if(options && options.userName) {
			self._userName = options.userName;
		}
		if(options && options.apiKey) {
			self._apiKey = options.apiKey;
		}
		if(options && options.persistedTokenPath) {
			self._persistedTokenPath = options.persistedTokenPath;
			self._token = getPersistedToken();
		}
		self._defaultRegion = 'dfw';
		if(options && options.region) {
			self._defaultRegion = options.region;
		}
		self._authUrl = 'https://identity.api.rackspacecloud.com/v2.0/tokens';	
		self._queueUrl = 'https://' + (self._defaultRegion) + '.queues.api.rackspacecloud.com/v1/queues';
		self._clientId = (options && options.clientId) ? options.clientId : require('guid').raw();
	};

	//persist auth token to file
	var persistToken = function() {
		fs.writeFileSync(self._persistedTokenPath, JSON.stringify(self._token), {encoding: 'utf-8'});
		debug('token persisted to file %s', self._persistedTokenPath);
	};

	//get auth token from file
	var getPersistedToken = function() {
		var token = null;
		if(self._persistedTokenPath) {
			if(fs.existsSync(self._persistedTokenPath)) {
				token = JSON.parse(fs.readFileSync(self._persistedTokenPath), {encoding: 'utf-8'});
				debug('token read from file %s', self._persistedTokenPath);
			}
			else {
				console.error('file %s does not exist', self._persistedTokenPath);
			}	
		}
		else {
			debug('no path provided');
		}
		return token;
	};

	//build url for queue/message operations
	var getQueueUrl = function(queue, messages) {
		var url = self._queueUrl;
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
			'X-Auth-Token': self._token.id,
			'Content-type': 'application/json',
			'Client-ID': self._clientId
		};
		return headers;
	};

	//return clien ID
	this.getClientId = function() {
		return self._clientId;
	};

	//authenticate api calls
	this.authenticate = function(userName, apiKey, callback) {
		//if userName and apiKey have been provided earlier
		if(arguments.length === 1) {
			userName = self._userName;
			apiKey = self._apiKey;
			callback = arguments[0];
		}
		//if we already have a valid token, return
		if(self._token && (new Date(self._token.expires)) > Date.now()) {
			return callback(null);
		}
		
		var options = {
				url: self._authUrl,
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
				self._token = body.access.token;
				// debug(util.inspect(self._token, true, null));
				if(self._persistedTokenPath) {
					persistToken();
				}
				return callback(null);
			}
			else {
				self._token = null;
				console.error('authenticate: ' + (error || 'statusCode: ' + response.statusCode));
				return callback(error);
			}
		});
	};
	
	//list queues
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

	//create queue
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

	//check queue existence
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