
var webdriverio = require('webdriverio'),
    httpserver = require('http-server'),
    selenium = require('selenium-standalone'),
    sauceConnectLauncher = require('sauce-connect-launcher'),
    extend = require('extend'),
    colors = require('colors'),
    SauceLabs = require('saucelabs');

var util = {
    log: function(str) {
        if(!SeSauce.options.quiet)
            console.log('SelSauce: '.blue + str);
    },
    err: function(str) {
        console.error('SelSauce: '.bgRed + str);
    }
};

var SeSauce = {

    browsers: [],         // Contains a list of webdriverio instances
    _browserActions: [],

    _initialized: false,
    _stopped: false,

    options: {
        quiet: false,           // Silences the console output
        webdriver: {            // Options for selenium webdriver (webdriverio)
            host: 'ondemand.saucelabs.com',
            port: 80,
            user: null,
            key: null,
            logLevel: 'silent',
            desiredCapabilities: [] // Non-standard option; An array of desired capabilities instead of a single object
        },
        httpServer: {           // Options for local http server (npmjs.org/package/http-server)
            disable: false,         // Non-standard option; used to skip launching the http server
            port: 8080              // Non-standard option; it is passed into the httpServer.listen() method
        },
        sauceLabs: {            // Options for SauceLabs API wrapper (npmjs.org/package/saucelabs)
            username: null,
            password: null
        },
        sauceConnect: {         // Options for SauceLabs Connect (npmjs.org/package/sauce-connect-launcher)
            disable: false,         // Non-standard option; used to disable sauce connect
            username: null,
            accessKey: null
        },
        selenium: {             // Options for Selenium Server (npmjs.org/package/selenium-standalone). Only used if you need Selenium running locally.
            args: []                // options to pass to `java -jar selenium-server-standalone-X.XX.X.jar`
        }
    },


    /**
     * Performs one-time initialization. Calls 'complete' when done, passing in an error message if necessary.
     * @private
     */
    _initOnce: function(complete) {
        if(SeSauce._initialized)
            return complete();

        SeSauce._initialized = true;

        if(SeSauce.options.sauceLabs.username && SeSauce.options.sauceLabs.password)
        {
            util.log("Initializing SauceLabs API.");
            SeSauce.sauceLabs = new SauceLabs({
                username: SeSauce.options.sauceLabs.username,
                password: SeSauce.options.sauceLabs.password
            });
        }

        if(SeSauce.options.sauceConnect.username && SeSauce.options.sauceConnect.accessKey)
        {
            if(SeSauce.options.sauceConnect.disable)
                util.log("Sauce Connect disabled.");
            else
            {
                util.log("Launching Sauce Connect...");
                sauceConnectLauncher(SeSauce.options.sauceConnect, function(errmsg, process) {
                    if(errmsg) {
                        if(process) process.close();
                        return SeSauce._doError('Error launching Sauce Connect:\n' + errmsg, complete);
                    }
                    SeSauce.sauceConnect = process;
                    util.log("Sauce Connect ready.");
                    complete();
                });
            }
        }
        else
        {
            util.log("No SauceLabs username/accessKey. Launching Selenium locally...");

            SeSauce.selenium = selenium({ stdio: 'pipe' }, SeSauce.options.selenium.args);

            SeSauce.selenium.stderr.on('data', function(output) {
                if(output.toString().indexOf('Started org.openqa.jetty.jetty.Server') != -1)
                {
                    clearTimeout(SeSauce._localSeleniumLaunchTimer);
                    util.log("Local Selenium server launched.");
                    complete();
                }
            });

            SeSauce._localSeleniumLaunchTimer = setTimeout(function() {
                SeSauce._doError('Selenium web driver timed out while trying to connect to local Selenium server.', complete);
            }, 5000);
        }
    },

    /**
     * Logs an error message, stops all services, and then calls the 'complete' callback, passing in the error message.
     * @private
     */
    _doError: function(msg, complete) {
        util.err(msg);
        SeSauce._stop(function() {
            complete(msg);
        });
    },

    /**
     * Initializes Selenium Sauce using the specified options.
     * Calls 'doEachBrowser' once for each browser in options.webdriver.desiredCapabilities, passing in the webdriverio instance.
     */
    init: function(options, doEachBrowser)
    {
        SeSauce._doEachBrowser = doEachBrowser;
        SeSauce.options.quiet = options.quiet;

        extend(SeSauce.options.webdriver, options.webdriver || {});
        extend(SeSauce.options.httpServer, options.httpServer || {});
        extend(SeSauce.options.sauceLabs, options.sauceLabs || {});
        extend(SeSauce.options.sauceConnect, options.sauceConnect || {});
        extend(SeSauce.options.selenium, options.selenium || {});

        if(SeSauce.options.webdriver.desiredCapabilities && SeSauce.options.webdriver.desiredCapabilities.constructor === Object)
            SeSauce.options.webdriver.desiredCapabilities = [ SeSauce.options.webdriver.desiredCapabilities ];

        if(!(SeSauce.options.webdriver.user && SeSauce.options.webdriver.key) && SeSauce.options.webdriver.host == 'ondemand.saucelabs.com')
        {
            SeSauce.options.webdriver.host = 'localhost';
            SeSauce.options.webdriver.port = 4444;
        }

        SeSauce.webdriver = webdriverio;

        if(!SeSauce.options.httpServer.disable)
        {
            util.log("Launching local web server (http://localhost:" + SeSauce.options.httpServer.port + "/)...");
            SeSauce.httpServer = httpserver.createServer(SeSauce.options.httpServer);
            SeSauce.httpServer.listen(SeSauce.options.httpServer.port);
            util.log("Web server ready.");
        }

        for(var i = 0, len = SeSauce.options.webdriver.desiredCapabilities.length; i < len; i++)
        {
            var wdOptions = extend({}, SeSauce.options.webdriver);
            wdOptions.desiredCapabilities = SeSauce.options.webdriver.desiredCapabilities[i];
            var browser = webdriverio.remote(wdOptions);
            SeSauce.browsers.push(browser);

            browser._oldInit = browser.init;
            browser.init = function(complete) {
                SeSauce._initOnce(function(err) {
                    if(err)
                        return complete(err);
                    this._oldInit(complete);
                }.bind(this));
            }.bind(browser);

            browser._oldEnd = browser.end;
            browser.end = function(done) {
                this._oldEnd(function() {
                    SeSauce.browsers.splice(SeSauce.browsers.indexOf(this), 1);
                    if(SeSauce.browsers.length == 0)
                        SeSauce._stop(done);
                    else
                        done();
                }.bind(this));
            }.bind(browser);

            doEachBrowser(browser);
        }
    },

    /**
     * @private
     */
    _stop: function(complete) {
        if(SeSauce._stopped)
            return complete && complete();

        SeSauce._stopped = true;

        if(SeSauce.httpServer) {
            SeSauce.httpServer.close();
            util.log("Web server stopped.");
        }

        if(SeSauce.selenium) {
            SeSauce.selenium.kill();
            util.log("Local Selenium server stopped.");
        }

        if(SeSauce.sauceConnect) {
            util.log("Closing Sauce Connect...");
            SeSauce.sauceConnect.close(function() {
                util.log("Sauce Connect closed.");
                if(complete)
                    complete();
            });
        }
        else if(complete)
            complete();
    },

    report: function(browser, success, complete) {
        if(SeSauce.sauceLabs)
            SeSauce.sauceLabs.updateJob(browser.requestHandler.sessionID, {
                passed: !!success,
                public: true
            }, function(err, res) {
                browser.end(complete);
            });
        else
            browser.end(complete);
    }

};

module.exports = SeSauce;
