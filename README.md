#RacQ.js (pronounced 'rak js')
This module is a Node.js wrapper for the Rackspace Cloud Queues API.

##Rackspace Cloud Queues
Cloud queues are scalable message queues, built on Rackspace's scalable cloud platform. They can be used in either pub-sub or producer-consumer configurations. You can read more about them on  
* [the Rackspace site](http://www.rackspace.com/cloud/queues/)
* [full documentation of the API](http://docs.rackspace.com/queues/api/v1.0/cq-devguide/content/overview.html) 

###Pricing
Currently (6/2014) you get **free** unlimited queues, unlimited messages (at max 256kb/msg), and 1 million API calls a month.  
A $0.01 per 10,000 API requests fee after the first million calls, and a standard bandwidth charges apply.

##Quick start
1. Install the module into your project: `npm install racq` or clone [this repository](https://github.com/travelingtechguy/racq.git)
2. Install all dependency modules: `npm install`
2. Use the following code, providing your credentials and preferred region:
```
var Queue = require('racq'),
	options = {
		userName: '<my Rackspace user name>',
		apiKey: '<my Rackspace apiKey>',
		region: 'dfw'
	},
	message = {
		body: {text: 'my first message!'},
		ttl: 60
	},
	queueName = 'demoQueue123',
	myQ = new Queue(options);

myQ.authenticate(function(error) {
	if(!error) {
		console.log('authenticated!');
		myQ.createQueue(queueName, function(error) {
			if(!error) {
				console.log('queue %s created', queueName);
				myQ.putMessages(queueName, message, function(error) {
					if(!error) {
						console.log('posted my first message to %s!', queueName);
						myQ.deleteQueue(queueName, function(error) {
							if(!error) {
								console.log('queue %s deleted', queueName);
							}
						});
					}
				});
			}
		});
	}
});
```

Since the library is mostly asynchronous, you can use a tool like [async](https://github.com/caolan/async), or [q](https://github.com/kriskowal/q) to get around callback hell.

##Available methods
###Constructor
You can initialize the class with an `options` object, containing the following parameters:
- `options.userName` - Rackspace user name
- `options.apiKey` - Rackspace API key
- `options.region` - Rackspace default region. Can be one of: iad, ord, dfw, hkg, lon, syd
- `options.clientId` - A GUID identifying the current queue client. Required for posting/getting/deleting messages
- `options.persistedTokenPath` - If provided, auth token will be persisted locally, and looked for at this path

If an options object is not provided, you'd need to prvide user name/ api key when calling `authenticate` and the following defaults will be assumed:
- `region` will be 'dfw'
- `clientId` will be a randomly generated GUID
- `persistedTokenPath` will be `null`, so the token wil not be persisted, and every call to `authenticate` will get to the server

###Authentication
* `authenticate(userName, apiKey, callback)` - user name and apiKey can be skipped if provided at class initialization.
If `persistedTokenPath` has been provided to constructor, the auth token will be saved to a local file, and read from it the next time `suthenticate is called. This could sae network calls, and speed future operatiosn. Auth tokens are good for 24 hours. 
* `getClientId()` - return the client id of the queue. Useful if you've generated a random client id.

###Queue operations
* `createQueue(queueName, callback)` - creates a new queue. Name must be no longer than 64 characters.
* `deleteQueue(queueName, callback)` - deletes a queue.
* `queueExists(queueName, callback)` - checks is a specific queue exists.
* `listsQueues(paramteres, callback)` - returns list of existing queues per account, 10 at a time, alphabetically sorted
The optional paramteres object allows paging through queues, and specifies whether detailed information be retrieved.
* `getQueueStats(queueName, callback)` - gets specific queue's statistics.
* `setQueueMetadata(queueName, metadata, callback)` - attach an informational object to a queue.
* `getQueueMetadata(queueName, callback)` - gets the queue's metadata.

###Message operations
* `postMessages(queueName, messages, callback)` - posts 1-10 messages to a queue. A message has a `body`, which can be any JSON object smaller than 256KB in size, and a `TTL` speficied in seconds (min. 60), dictating the message's time to live.
* `getMessages(queueName, parameters, callback)` - gets up to 10 messgaes at a time, depending on the paramteres specified.
* `getMessagesById(queueName, messageIds, callback)` - gets one, or more, messages, by their id.
* `deleteMessages(queueName, messageIds, claimId, callback)` - deletes one, or more, messages, by their id. Allows proviing a claim id for a claimed message to be deleted.

###Claims operations
Not implemented yet - **TBD**.

##Demo
To see the code in action, look at the unit-test files in the `/test` folder. See 'Tests' below on how to run the code.

##Tests
1. To run tests, first, create a file called `testConfig.json` in the `/test` folder, containing the following:
```
{
	"userName": "Your User Name",
	"apiKey": "Your API Key",
	"region": "dfw"
}
```
2. In the top folder, run the command `npm test` to have all tests run.
3. To run a specific set of tests, run this command at the top level:
`node test authenticate` (you can provide any of the test files available under `/test`).
4. Alternatively, you can run `mocha test/authenticate` if you'd like to provide mocha specific parameters (see [mocha](https://github.com/visionmedia/mocha) for more documenation).
5. If you want to see debug messages from tests, or modules, provide the `DEBUG` parameter, and the module name, at the beginning of the line:
`DEBUG=racq,authenticate npm test`.

## License
Copyright (c) 2014 Guy Vider, [Traveling Tech Guy LLC](http://www.TravelingTechGuy.com)  
Licensed under the MIT license.