'use strict';

var jobsQueue = "myqueue",
	term = process.argv[2],
	numOfConsumers = parseInt(process.argv[3]) || 2;


(function() {
	var async = require('async'),
		debug = require('debug')('index'),
		Producer = require('./producer'),
		Consumer = require('./consumer'),
		RacQ = require('../../lib/racq'),
		config = require('../testConfig'),
		queue = new RacQ(config);
		
	var consume = function(done) {
		var consumer = new Consumer();
		consumer.start(jobsQueue, done);
	};

	var processResults = function(results) {
		//concat result arrays
		var result = results.reduce(function(a, b) {return a.concat(b);});
		//sort by occurrences, descending
		result = result.sort(function(a, b) {return b.occurrences - a.occurrences;});
		//currently, just print results to console. Ideally, do something else
		console.log(result);
	};
	
	debug('looking for %s with %s consumers', term, numOfConsumers);

	async.series([
		function authenticate(done) {
			debug('authenticated');
			queue.authenticate(done);
		},
		function createQueue(done) {
			queue.createQueue(jobsQueue, function(error) {
				if(!error) {
					debug('queue %s created', jobsQueue);
					done(null);
				}
				else if(error.toString().indexOf('exists') !== -1) {
					debug('queue %s already exists', jobsQueue);
					done(null);
				}
				else {
					done(error);
				}
			});
		},
		function produce(done) {
			var producer = new Producer();
			producer.start(jobsQueue, term, done);
		},
		function consumers(done) {
			//add as many consumers as needed, or logic to multiply them into an array
			var consumersArray = Array.apply(null, Array(numOfConsumers)).map(function(){return consume;});
			async.parallel(consumersArray, function(error, results) {
				processResults(results);
				done(null);
			});
		},
		function deleteQueue(done) {
			debug('queue %s deleted', jobsQueue);
			queue.deleteQueue(jobsQueue, done);
		}
	],
	function allDone(error) {
		if(error) {
			console.error(error);
		}
		else {
			debug('done!');
		}
	});
}());