

// 	this.putMessages = function(queue, messages, callback) {
// 		var options = {
// 				url: getQueueUrl(queue) + '/messages',
// 				headers: getRequestHeaders(true),
// 				json: messages
// 			};
// 		request.post(options, function(error, response) {
// 			if (!error && response.statusCode === 201) {
// 				return callback(null);
// 			}
// 			else {
// 				console.error('putMessages: ' + (error || 'statusCode: ' + response.statusCode));
// 				return callback(error);
// 			}
// 		});
// 	};

// 	this.getMessages = function() {
// 		var queue = arguments[0],
// 			echo, limit, callback,
// 			url = getQueueUrl(queue) + '/messages';
// 		switch(arguments.length) {
// 			case 2:
// 				callback = arguments[1];
// 				break;
// 			case 3:
// 				echo = arguments[1];
// 				callback = arguments[2];
// 				url += '?echo=' + echo;
// 				break;
// 			case 4:
// 				echo = arguments[1];
// 				limit = arguments[2];
// 				callback = arguments[3];
// 				url += '?echo=' + echo + '&limit=' + limit;
// 				break;
// 			default:
// 				return callback({error: 'wrong number of arguments'}, null);
// 		}
// 		var options = {
// 				url: url,
// 				headers: getRequestHeaders(true)
// 			};
// 		request(options, function(error, response, body) {
// 			if (!error && response.statusCode === 200) {
// 				return callback(null, JSON.parse(body));
// 			}
// 			else {
// 				console.error('getMessages: ' + (error || 'statusCode: ' + response.statusCode));
// 				return callback(error, null);
// 			}
// 		});
// 	};

// 	this.claimMessage = function(queue, messageId, callback) {
// 		var options = {
// 				url: getQueueUrl(queue) + '/messages/' + messageId,
// 				headers: getRequestHeaders(true)
// 			};
// 	};

// 	this.deleteMessage = function(queue, messageId, callback) {
// 		var options = {
// 				url: getQueueUrl(queue) + '/messages/' + messageId,
// 				headers: getRequestHeaders(true)
// 			};
// 		request.del(options, function(error, response) {
// 			if(!error && response.statusCode === 204) {
// 				return callback(null);
// 			}
// 			else {
// 				console.error('deleteMessgage: ' + (error || 'statusCode: ' + response.statusCode));
// 				return callback(error);
// 			}
// 		});
// 	};
// };