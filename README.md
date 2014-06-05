#RacQ.js (pronounced 'rak js')
This module is a Node.js wrapper for the Rackspace Cloud Queues API.

##What are cloud queues
Cloud queues are scalable message queues, built on Rackspace's scalable cloud platform. They can be used in either pub-sub or producer-consumer configurations. You can read more about them on  
* [the Rackspace site](http://www.rackspace.com/cloud/queues/)
* [full documentation of the API](http://docs.rackspace.com/queues/api/v1.0/cq-devguide/content/overview.html) 

###Pricing
As for pricing, currently you get **free** unlimited queues, unlimited messages (at max 256kb/msg), and 1 million API calls a month.  
A $0.01 per 10,000 API requests fee after the first million calls, and a standard bandwidth charges apply.

##How to use this module
1. Install the module into your project:
`npm install racq`
2. Use the following code, providing your credentials and preferred region:
```
var Queue = require('racq'),
	options = {
		userName: '<my Rackspace user name>',
		apiKey: '<my Rackspace apiKey>',
		region: 'dfw'
	},
	myQ = new Queue(options);

myQ.authenticate(function(error) {
	if(!error) {
		myQ.createQueue('demoQueue123', function(error) {
			if(!error) {
				//do something with the queue...
			}
		});
	}
});
```
