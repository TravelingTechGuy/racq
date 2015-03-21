###[Project page](https://travelingtechguy.github.io/racq/) | [npm page](https://www.npmjs.org/package/racq) | [Traveling Tech Guy](http://TravelingTechGuy.com)

# RacQ.js (pronounced 'rak js') [![Build Status](https://travis-ci.org/TravelingTechGuy/racq.svg?branch=master)](https://travis-ci.org/TravelingTechGuy/racq)
 [![NPM](https://nodei.co/npm/racq.png)](https://nodei.co/npm/racq/)

RacQ is a Node.js wrapper for the Rackspace Cloud Queues API.

##Rackspace Cloud Queues
Cloud queues are scalable message queues, built on Rackspace's scalable cloud platform. They can be used in either pub-sub or producer-consumer configurations. You can read more about them on:
* [The Rackspace site](http://www.rackspace.com/cloud/queues/) - info and pricing
* [Full documentation of the API](http://docs.rackspace.com/queues/api/v1.0/cq-devguide/content/overview.html)

##Quick start
1. Install the module into your project: `npm install racq`
2. Alternatively, clone [this repository](https://github.com/travelingtechguy/racq.git) and install all dependency modules: `npm install`
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
				myQ.postMessages(queueName, message, function(error) {
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

**For further documentation, see the [JSDoc generated documentation](https://travelingtechguy.github.io/racq/jsdoc/module-RacQ-RacQ.html).**

###Constructor
You can initialize the class with an `options` object, containing the following parameters:
- `options.userName` - Rackspace user name
- `options.apiKey` - Rackspace API key
- `options.region` - Rackspace default region. Can be one of: iad, ord, dfw, hkg, lon, syd
- `options.clientId` - A GUID identifying the current queue client. Required for posting/getting/deleting messages
- `options.persistedTokenPath` - If provided, auth token will be persisted locally, and looked for at this path

If an options object is not provided, you'd need to provide user name/ api key when calling `authenticate` and the following defaults will be assumed:
- `region` will be 'dfw'
- `clientId` will be a randomly generated GUID
- `persistedTokenPath` will be `null`, so the token wil not be persisted, and every call to `authenticate` will get to the server

###Authentication
* `authenticate(userName, apiKey, callback)` - user name and apiKey can be skipped if provided at class initialization.
If `persistedTokenPath` has been provided to constructor, the auth token will be saved to a local file, and read from it the next time `authenticate` is called. This could save network calls, and speed future operations. Auth tokens are good for 24 hours.
* `getClientId()` - return the client id of the queue. Useful if you've generated a random client id.
* `deleteToken()` - deletes the currently used token, making it possible to re-authenticate even if the actual token hasn't expired yet.

###Queue operations

* `createQueue(queueName, callback)` - creates a new queue. Name must be no longer than 64 characters.
* `deleteQueue(queueName, callback)` - deletes a queue.
* `queueExists(queueName, callback)` - checks is a specific queue exists.
* `listsQueues(paramteres, callback)` - returns list of existing queues per account, 10 at a time, alphabetically sorted
The optional paramteres object allows paging through queues, and specifies whether detailed information be retrieved.
* `getQueueStats(queueName, callback)` - gets specific queue's statistics.
* `setQueueMetadata(queueName, metadata, callback)` - attach an informational object to a queue.
* `getQueueMetadata(queueName, callback)` - gets the queue's metadata.

**Comment:** A queue name must not exceed 64 bytes in length, and it is limited to US-ASCII letters, digits, underscores, and hyphens.

###Message operations

* `postMessages(queueName, messages, callback)` - posts 1-10 messages to a queue. A message has a `body`, which can be any JSON object, and a `ttl` specified in seconds, dictating the message's time to live.
* `getMessages(queueName, parameters, callback)` - gets up to 10 messages at a time, depending on the parameters specified.
* `getMessagesById(queueName, messageIds, callback)` - gets one, or more, messages, by their id.
* `deleteMessages(queueName, messageIds, claimId, callback)` - deletes one, or more, messages, by their id. Allows proving a claim id for a claimed message to be deleted.

**Comments:**

1. A meesage `body` can be any JSON object, smaller than 256KB in size.
2. The `ttl` value must be between 60 and 43200 seconds (12 hours). You must include a value with your message.

###Claims operations

* `claimMessages(queueName, parameters, callback)` - a client can claim (mark) messages it's handling with a claim, delete them upon process end, or release the claim if it takes too long to process them
* `queryClaims(queueName, claimIds, callback)` - check which massages are claimed by claim ids
* `updateClaims(queueName, claimIds, parameters, callback)` - update the TTL and grace period of claimed messages
* `releaseClaims(queueName, claimIds, callback)` - release claim on messages, allowing them to be claimed by a different client

###Statistics
The cost of cloud queus is measured by 2 factors: number of calls (first million a month are free), and payload.

`getStatistics()` will return an object containing: # of calls, sent bytes and received bytes.

Every module contains a `:statistics` DEBUG qualifier. To see this in action, specify `DEBUG=modulename:statistics` to get statistics from the main library or a test module, or specify `DEBUG=*:statistics` to get statistics from all modules.

##Examples
Look in the `/examples` folder for some code samples, as well as a config file sample.
You can run each file on its own. The files make use of async to control flow, but it's not mandatory.

##Tests

Before you run tests, **you must provide your own user name and API key**. You can do it in one of 2 ways:

1. Provide the parameters in environment variables, e.g. `USERNAME=myusername APIKEY=myapikey npm test`.
2. Create a file called `testConfig.json` in the `/test` folder (or just copy the file `/examples/testConfig.json` to `/test`, and fill in the values).

```
{
	"userName": "Your User Name",
	"apiKey": "Your API Key",
	"region": "dfw"
}
```

Once you provided the parameters:

1. In the top folder, run the command `npm test` to have all tests run.
2. To run a specific set of tests, run this command at the top level:
`node test authenticate` (you can provide any of the test files available under `/test`).
3. Alternatively, you can run `mocha test/authenticate` if you'd like to provide mocha specific parameters (see [mocha](https://github.com/visionmedia/mocha) for more documentation).
4. If you want to see debug messages from tests, or modules, provide the `DEBUG` parameter, and the module name, at the beginning of the line:
`DEBUG=racq,authenticate npm test`.
5. If you want to see statistics messages from tests, or modules, provide the `DEBUG` parameter, and `modulename:statistics`, at the beginning of the line:
`DEBUG=racq:statistics,authenticate:statistics npm test`.

## License
Copyright (c) 2014 Guy Vider, [Traveling Tech Guy LLC](http://www.TravelingTechGuy.com)  
Licensed under the MIT license.