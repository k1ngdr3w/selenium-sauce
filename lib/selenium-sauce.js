
var webdriverio = require('webdriverio'),
    httpserver = require('http-server'),
    selenium = require('selenium-standalone'),
    sauceConnectLauncher = require('sauce-connect-launcher'),
    extend = require('extend'),
    colors = require('colors'),
    async = require('async'),
    portscanner = require('portscanner'),
    SauceLabs = require('saucelabs');

/**
 * Initializes Selenium Sauce using the specified options.
 * 'doEachBrowser' is called once for each browser in options.webdriver.desiredCapabilities, passing in the webdriverio instance.
 */
var SeSauce = function(options, doEachBrowser) {

    extend(this, {
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
        }
    });


    this._doEachBrowser = doEachBrowser;
    this.options.quiet = options.quiet;

    extend(this.options.webdriver, options.webdriver || {});
    extend(this.options.httpServer, options.httpServer || {});
    extend(this.options.sauceLabs, options.sauceLabs || {});
    extend(this.options.sauceConnect, options.sauceConnect || {});
    extend(this.options.selenium, options.selenium || {});

    if (this.options.webdriver.desiredCapabilities && this.options.webdriver.desiredCapabilities.constructor === Object)
        this.options.webdriver.desiredCapabilities = [this.options.webdriver.desiredCapabilities];

    if (!(this.options.webdriver.user && this.options.webdriver.key) && this.options.webdriver.host == 'ondemand.saucelabs.com') {
        this.options.webdriver.host = 'localhost';
        this.options.webdriver.port = 4444;
    }

    var self = this;

    for (var i = 0, len = this.options.webdriver.desiredCapabilities.length; i < len; i++) {
        var wdOptions = extend({}, this.options.webdriver);
        wdOptions.desiredCapabilities = this.options.webdriver.desiredCapabilities[i];
        var browser = webdriverio.remote(wdOptions);
        this.browsers.push(browser);

        browser._oldInit = browser.init;
        browser.init = function (complete) {
            self._initOnce(function (err) {
                if (err)
                    return complete(err);
                this._oldInit(complete);
            }.bind(this));
        }.bind(browser);

        browser._oldEnd = browser.end;
        browser.end = function (complete) {
            this._oldEnd(function () {
                self.browsers.splice(self.browsers.indexOf(this), 1);
                if (self.browsers.length == 0)
                    self._stop(complete);
                else
                    complete();
            }.bind(this));
        }.bind(browser);

        browser.passed = function(success, complete) {
            this.updateJob({ passed: success }, function() {
                this.end(complete);
            }.bind(this));
        }.bind(browser);

        browser.updateJob = function(data, complete) {
            if (self.sauceLabs)
                self.sauceLabs.updateJob(this.requestHandler.sessionID, data, complete);
            else
                complete();
        }.bind(browser);

        doEachBrowser.call(this, browser);
    }

};

extend(SeSauce.prototype, {

    /**
     * Performs one-time initialization. Calls 'complete' when done, passing in an error message if necessary.
     * @private
     */
    _initOnce: function (complete) {
        if (this._initialized)
            return complete();

        var self = this;
        this._initialized = true;

        this.webdriver = webdriverio;

        async.parallel([
            function (cb) {
                function launchHttpServer() {
                    self._log("Launching local web server (http://localhost:" + self.options.httpServer.port + "/)...");
                    self.httpServer = httpserver.createServer(self.options.httpServer);
                    self.httpServer.listen(self.options.httpServer.port, function () {
                        self._log("Web server ready.");
                        cb();
                    });
                }
                if (self.options.httpServer.disable) {
                    if (self.options.httpServer.disable === 'if-port-is-already-open') {
                        var httpServerPort = self.options.httpServer.port || 8080;
                        portscanner.checkPortStatus(httpServerPort, 'localhost',
                            function (err, status) {
                                if (status === 'open') {
                                    self._log("Port " + httpServerPort + " is already open. Skipping web server launch.");
                                    cb();
                                }
                                else {
                                    launchHttpServer();
                                }
                            });
                    }
                    else {
                        cb();
                    }
                }
                else {
                    launchHttpServer();
                }
            },
            function (cb) {
                if (self.options.sauceLabs.username && self.options.sauceLabs.password) {
                    self._log("Initializing SauceLabs API.");
                    self.sauceLabs = new SauceLabs({
                        username: self.options.sauceLabs.username,
                        password: self.options.sauceLabs.password
                    });
                }
                if (self.options.sauceConnect.username && self.options.sauceConnect.accessKey) {
                    if (self.options.sauceConnect.disable) {
                        self._log("Sauce Connect disabled.");
                        cb();
                    }
                    else {
                        self._log("Launching Sauce Connect...");
                        sauceConnectLauncher(self.options.sauceConnect, function (errmsg, process) {
                            if (errmsg) {
                                if (process) process.close();
                                return self._doError('Error launching Sauce Connect:\n' + errmsg, cb);
                            }
                            self.sauceConnect = process;
                            self._log("Sauce Connect ready.");
                            cb();
                        });
                    }
                }
                else {
                    function launchSelenium() {
                        self._log("No SauceLabs username/accessKey. Launching Selenium locally...");
                        self.selenium = selenium({stdio: 'pipe'}, self.options.selenium.args);
                        self.selenium.stderr.on('data', function (output) {
                            if (output.toString().indexOf('Started org.openqa.jetty.jetty.Server') != -1) {
                                clearTimeout(self._localSeleniumLaunchTimer);
                                self._log("Local Selenium server launched.");
                                cb();
                            }
                        });
                        self._localSeleniumLaunchTimer = setTimeout(function () {
                            self._doError('Selenium web driver timed out while trying to connect to local Selenium server.', cb);
                        }, 5000);
                    }
                    if (self.options.selenium.disable) {
                        if (self.options.selenium.disable === 'if-port-is-already-open') {
                            var seleniumPort = self.options.webdriver.port || 4444;
                            portscanner.checkPortStatus(seleniumPort, 'localhost',
                                function (err, status) {
                                    if (status === 'open') {
                                        self._log("Port " + seleniumPort + " is already open. Skipping Selenium launch.");
                                        cb();
                                    }
                                    else {
                                        launchSelenium();
                                    }
                                });
                        } else {
                            cb();
                        }
                    }
                    else {
                        launchSelenium();
                    }
                }
            }],
            complete);
    },

    /**
     * Logs an error message, stops all services, and then calls the 'complete' callback, passing in the error message.
     * @private
     */
    _doError: function (msg, complete) {
        this._err(msg);
        this._stop(function () {
            complete(msg);
        });
    },


    /**
     * @private
     */
    _stop: function (complete) {
        if (this._stopped)
            return complete && complete();

        this._stopped = true;

        if (this.httpServer) {
            this.httpServer.close();
            this._log("Web server stopped.");
        }

        if (this.selenium) {
            this.selenium.kill();
            this._log("Local Selenium server stopped.");
        }

        if (this.sauceConnect) {
            var self = this;
            this._log("Closing Sauce Connect...");
            this.sauceConnect.close(function () {
                self._log("Sauce Connect closed.");
                if (complete)
                    complete();
            });
        }
        else if (complete)
            complete();
    },

    _log: function(str) {
        if(!this.options.quiet)
            console.log('SelSauce: '.blue + str);
    },

    _err: function(str) {
        console.error('SelSauce: '.bgRed + str);
    }
});

module.exports = SeSauce;
