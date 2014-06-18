#Producer-Consumer Example
This example uses a queue in a simple producer-consumer scenario:

###The goal
Look for the number of occurrences of a certain word, in the main page of specified news sites.  
While there, also report on the size (in bytes) of the main page's payload, and the size of it's visible (i.e.e not HTML or JS) text.
Results will be outputed sorted by number of occurences of the word on the main page.

###The method

- The `sites.json` file containes an array of URLs to check.
- The main file (`index.js`) sets things up by creating a demo queue, running the producer, and a number of consumers in parallel.
- The `producer.js` file posts the list of files to the queue.
- The `consumer.js` tries to claim one message at a time, scrape the term specified from the site, and return results when no more sites are available to claim.

###How to run

1. In the `/examples` folder, verify that you've provided the user name and api key in the `config.json` file (or provide a path to a different config fle in the 3 .js files).
2. `cd` to the folder `/examples/producer-consumer`
3. Run `node index <term> <number of concurrent consumers>` - i.e. `node index iraq 2` will search for the word `iraq` (case insensitive) on all news sites, using 2 consumers.
4. If you do not provide the number of consumers parameter, 2 will be used.
5. To see the inner works of the example, provide the debug parameter. Try: `DEBUG=index,producer,consumer node index iraq 3`

###Comment

This example is meant to demonstrate the use of the RacQ module, **Not** to demonstrate effective, or even proper, web scraping.
Several decisions, such as not running consumers in separate processes, or only claiming one message at a time, were taken specifically so the example will be kept simple and readable.