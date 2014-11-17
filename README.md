Selenium Sauce
==============

[ ![Codeship Status for alexbrombal/selenium-sauce](https://codeship.com/projects/f911c670-503c-0132-33dc-66df49ff6485/status)](https://codeship.com/projects/47985)

Easily run your Selenium tests on SauceLabs using Node.js.

http://npmjs.org/package/selenium-sauce

## Quick Start

Install & add environment variables:

```bash
$ npm install selenium-sauce
$ export SAUCE_USERNAME=******
$ export SAUCE_ACCESS_KEY=******
```

Configure:

`se-sauce.config.js`:

```javascript
module.exports = {
    quiet: false,           // Silences the console output
    webdriver: {            // Options for Selenium WebDriver (WebdriverIO)
        user: process.env.SAUCE_USERNAME,
        key: process.env.SAUCE_ACCESS_KEY,
        desiredCapabilities = [{
            browserName: 'chrome',
            version: '27',
            platform: 'XP',
            tags: ['examples'],
            name: 'This is an example test'
        }]
    },
    httpServer: {           // Options for local http server (npmjs.org/package/http-server)
        port: 8080              // Non-standard option; it is passed into the httpServer.listen() method
    },
    sauceLabs: {            // Options for SauceLabs API wrapper (npmjs.org/package/saucelabs)
        username: process.env.SAUCE_USERNAME,
        password: process.env.SAUCE_ACCESS_KEY
    },
    sauceConnect: {         // Options for SauceLabs Connect (npmjs.org/package/sauce-connect-launcher)
        username: process.env.SAUCE_USERNAME,
        accessKey: process.env.SAUCE_ACCESS_KEY
    },
    selenium: {             // Options for Selenium Standalone Server (npmjs.org/package/selenium-standalone). Only used if you need Selenium running locally.
        args: []                // options to pass to `java -jar selenium-server-standalone-X.XX.X.jar`
    }
};
```

Create test:

`test.js`:

```javascript

var SeSauce = require('selenium-sauce');

// Loads the config file and invokes the callback once for each browser
SeSauce.init(require('./se-sauce.config'), function(browser, browserComplete) {

    // Initialize the browser
    browser.init(function(err) {
        if(err) throw err;

        // Load a url into the browser
        browser.url('http://localhost:8080/test.html', function() {

            // Tell SauceLabs that the test was successful
            SeSauce.sauceLabs.updateJob(browser.requestHandler.sessionID, {
                passed: true,
                public: true
            }, function(err, res) {
                // Close the browser
                browser.end(function() {

                    // Call the callback when you are done with this browser
                    browserComplete();
                });
            });
        });
    });
});

```

Run:

```bash
$ node test.js
```


## About

This Node.js utility is a wrapper API around a set of technologies intended to make it just a little bit easier to run Selenium tests on SauceLabs. In addition, the tests will run locally by default if the info necessary to connect to SauceLabs is not provided.

Running Selenium tests on SauceLabs is not incredibly difficult, but there are a lot of moving parts: 
- SauceLabs has an API for managing jobs and running browsers
- SauceLabs' instances function as Selenium servers with their own set of APIs
- Browsers on SauceLabs need access to load webpages from the same machine running the tests, which is done using Sauce Connect to establish a private network tunnel. 

On top of that, developing and testing locally requires a local Selenium server, and the SauceLabs features listed above would need to be bypassed.

**Selenium Sauce** provides a simple API that encapsulates all of these features, by reusing existing tools and orchestrating their functionality. Below are the tools that are used:

- [**WebdriverIO**](#webdriverio)
  Provides the API for issuing commands to the Selenium Server (on SauceLabs or locally)
- [**SauceLabs**](#saucelabs)  
  A Node.js wrapper for the SauceLabs API (listing job IDs, updating jobs, etc.)
- [**HttpServer**](#httpserver)  
  Creates a local web server so that browsers can load webpages from your local machine.
- [**Sauce Connect Launcher**](#sauce-connect-launcher)  
  Provides a secure tunnel between SauceLabs and your machine so that SauceLabs' browsers can load webpages that reside on your local machine.
- [**Selenium Standalone**](#selenium-standalone) (for local testing)  
  Runs a Selenium Server on your local machine. This is useful for development and is only used if SauceLabs is disabled.

Each of these utilities are transparently exposed through the Selenium Sauce interface and you can work directly with them. The configuration file values are passed directly into each respective utility (with the exceptions clearly marked here in the documentation and example files).

---

### What Selenium Sauce is *not*

Selenium Sauce is not a unit test runner or framework. It is meant to be used in conjunction with one, however. Selenium Sauce simply provides an easy way for your tests to connect to Sauce Labs and perform actions&mdash;it is up to you to determine whether the actions were successful, and pass or fail your tests accordingly.

See the [examples](https://github.com/alexbrombal/selenium-sauce/tree/master/examples) for a sample of how to use this with a unit test utility.




## Usage

As mentioned in the quick start, you need to install this package with npm. This is not a binary utility, but rather a programmatic interface that you use in your unit test or other Node.js files.

```bash
$ npm install selenium-sauce
```

`require()`ing this module in your JavaScript file will return an object with only one public method: `init()`.

```javascript
var SeSauce = require('selenium-sauce');
```

### The `init()` method

- `SeSauce.init(config, doEachBrowser)`

  The `init` method accepts two parameters: a configuration object, and a callback method that is invoked once for each browser that is configured.

#### Configuration

The first parameter to the `init` function must be an object containing your configuration settings for each component of Selenium Sauce. Each of these configuration objects are passed as-is to their respective components (with the exceptions noted below). For details about each component's configuration sub-object, see the provided link to the documentation.

`{`

- `quiet:` - If true, tells Selenium Sauce to silence its console output.

- `webdriver:` - Options for [WebdriverIO](#webdriverio). These options are passed directly into the `webdriverio.remote()` function.

  - `desiredCapabilities:` - *Non-standard option:* an array of desired capabilities. This differs from the standard option in that it is an array of browser capabilities rather than a single instance.

- `httpServer:` - Options for [HttpServer](#httpserver). These options are passed directly into `httpserver.createServer()`.   

  - `port` - *Non-standard option:* passed into HttpServer's `listen` function as the port on which to listen.

- `sauceLabs:` - Options for [SauceLabs](#saucelabs). These options are passed directly into the `SauceLabs()` constructor.

- `sauceConnect:` - Options for [Sauce Connect Launcher](#sauce-connect-launcher). These options are passed directly into the `SauceConnectLauncher()` constructor.

- `selenium:` - Options for [Selenium Standalone](#selenium-standalone).

  - `args:` - Array of strings. Passed as the second argument to the `selenium()` constructor (which are subsequently passed as the command-line arguments to `java -jar selenium-server-standalone-X.XX.X.jar`)

`}`

In the Quick Start example above, the configuration object is stored in `se-sauce.config.js`. This is not a requirement, only a convenient place to store a large object. How ever you store the object, you must pass it as the first argument to the `init()` function.

#### The `doEachBrowser` callback


The second parameter to `init()` is the `doEachBrowser` callback, which is a function that is run once on each browser. It also receives two parameters: a *browser* object, which is an instance of [WebdriverIO](#webdriverio)'s main interface, and a completion callback that you must invoke when you are done with the browser.

The `browser` object is the result of the `webdriverio.remote()` function. It provides all the Selenium API calls that are documented on the [WebdriverIO website](http://webdriver.io).

> Note that all `doEachBrowser` invocations happen immediately (i.e. Selenium Sauce does not wait until you invoke the callback to make the next call). It is up to you to schedule your Selenium actions to happen sequentially&mdash;this is usually made easy with a unit test framework.

> The reason for this is that some unit test frameworks (such as mocha) require that all the unit test fixtures are initialized by the time the script finishes executing. If Selenium Sauce were to cause a delay by waiting for each browser to finish, not all of the unit tests would run.




### Components

Selenium Sauce comprises a set of tools that are made transparently available through properties of the Selenium Sauce object. You may use these objects just as you would use the original tools, so take a look at each component's original documentation for details.

- #### WebdriverIO 
  
  http://webdriver.io/

  `SeSauce.webdriver`

  This is the API wrapper around the Selenium WebDriver protocol. You probably don't want to use this object directly, but instead use the `browser` object that is passed to the `doEachBrowser` callback.

- #### SauceLabs

  https://github.com/holidayextras/node-saucelabs

  `SeSauce.sauceLabs`

  SauceLabs has their own set of APIs (independent of Selenium) that allow you to query for job IDs or update jobs. Selenium Sauce does not actually use these APIs, but provides it to you for convenience&mdash;for example, to set the current job's pass/fail status. You're welcome!

- #### HttpServer
 
  https://github.com/nodeapps/http-server

  `SeSauce.httpServer`

  It's possible the tests you want to run are in HTML files that only exist on your machine, and not on a publicly-accessible web server. HttpServer is a simple, minimal configuration web server that runs on your local machine to provide browsers access to these test web pages.

- #### Sauce Connect Launcher

  https://github.com/bermi/sauce-connect-launcher

  `SeSauce.sauceConnect`

  SauceLabs provides a secure tunnel (called Sauce Connect) between itself and your machine so that SauceLabs' browsers can load webpages that reside on your local machine. This is a Node.js wrapper around the Sauce Connect client.

- #### Selenium Standalone

  https://github.com/vvo/selenium-standalone

  `SeSauce.selenium`

  Runs a Selenium Server on your local machine. This is useful for development and is only used if SauceLabs is disabled.



## Examples

Selenium Sauce is not a unit test runner and has no dependencies on a specific unit test framework, but functions best in conjunction with one. Check out the examples using real test frameworks in the [/examples](https://github.com/alexbrombal/selenium-sauce/tree/master/examples) directory (see the README file there for information on how to run the tests).
