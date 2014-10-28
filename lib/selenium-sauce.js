
var webdriverio = require('webdriverio'),
    httpserver = require('http-server'),
    selenium = require('selenium-standalone'),
    sauceConnectLauncher = require('sauce-connect-launcher'),
    extend = require('extend'),
    colors = require('colors');

function log(str) {
    console.log('SelSauce: '.blue + str);
}

function err(str) {
    console.error('SelSauce: '.bgRed + str);
}

/**
 * options = {
 *     username: 'SauceLabs username',
 *     accessKey: 'SauceLabs access key',
 *
 *     webdriver: {  // Options for selenium webdriver (webdriverio)
 *     },
 *     server: {    // Options for local http server (http-server)
 *     },
 *     connect: {   // Options for SauceLabs Connect (sauce-connect-launcher)
 *     },
 *     selenium: {  // Options for Selenium Server (selenium-standalone). Only used if you need Selenium running locally.
 *     }
 * }
 */

exports.start = function(options, onReady) {

    options = options || {};

    var defaults = {
        webdriver: {
            host: 'ondemand.saucelabs.com',
            port: 80,
            user: options.username,
            key: options.accessKey,
            logLevel: 'silent'
        },
        server: {
            port: 8080  // This is a non-standard option; it is passed into the httpServer.listen() method.
        },
        connect: {
            username: options.username,
            accessKey: options.accessKey
        },
        selenium: {
            args: []    // options to pass to `java -jar selenium-server-standalone-X.XX.X.jar`
        }
    };

    options.webdriver = extend(defaults.webdriver, options.webdriver || {});
    options.server = extend(defaults.server, options.server || {});
    options.connect = extend(defaults.connect, options.connect || {});
    options.selenium = extend(defaults.connect, options.connect || {});

    log("Launching local web server (http://localhost:" + options.server.port + "/)...");
    exports.server = httpserver.createServer(options.server);
    exports.server.listen(options.server.port);
    log("Web server ready.");

    var doError = function(msg, err) {
        err(msg);
        err(err.message);
        exports.stop();
        onReady(err.message);
    };

    var sauceConnectReady = function(err) {
        if (err)
            return doError('Error launching Sauce Connect:', err);

        log("Launching Selenium web driver...");
        exports.webdriver = webdriverio.remote(options.webdriver);
        exports.webdriver.init(webdriverReady);
    };

    var webdriverReady = function(err) {
        if(err)
            return doError("Selenium web driver failed:", err);

        log("Selenium web driver ready.");
        onReady();
    };

    if(options.username && options.accessKey)
    {
        log("Launching Sauce Connect...");
        sauceConnectLauncher(options.connect, function(err, process) {
            if(!err)
                log("Sauce Connect ready.");
            sauceConnectReady(err);
        });
    }
    else
    {
        log("No SauceLabs username/accessKey. Running Selenium & web driver locally.");

        log("Launching Selenium...");
        exports.selenium = selenium({ stdio: 'pipe' }, options.selenium.args);

        extend(options.webdriver, {
            host: 'localhost',
            port: 4444
        });

        exports.selenium.stderr.on('data', function(output) {
            if(output.toString().indexOf('Started org.openqa.jetty.jetty.Server') != -1)
                sauceConnectReady();
        });

        setTimeout(function() {
            webdriverReady('Selenium web driver timed out while trying to connect to local Selenium server.');
        }, 5000);
    }
};

exports.stop = function(done) {
    if(exports.server)
    {
        log("Web server closed.");
        exports.server.close();
    }

    if(exports.selenium)
        exports.selenium.kill();

    if(exports.connect)
    {
        log("Closing Sauce Connect...");
        exports.connect.close(function() {
            log("Sauce Connect closed.");
            if(done) done();
        });
    }
    else if(done) done();
};