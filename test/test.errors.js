var SeSauce = require('../inst/selenium-sauce'),
    should = require('./lib/should'),
    httpServer = require('http-server');

new SeSauce({
    quiet: false,
    webdriver: {
        logLevel: 'silent',
        desiredCapabilities: { browserName: 'phantomjs' }
    },
    httpServer: {
        disable: false,
        port: 8081,
        root: __dirname
    },
    sauceLabs: {
    },
    sauceConnect: {
    }
}, function(browser) {

    // Since this test suite is run once for each browser, we'll output the
    // browser name in the test suite description.
    describe("Error tests: " + browser.desiredCapabilities.browserName + ': title', function() {

        this.timeout(120000);

        var server;

        // Test that the browser title is correct.
        it('should have the correct value', function(done) {
            // Start a web server on 4444 so that selenium can't start
            server = httpServer.createServer();
            server.listen(4444);

            browser.init(function(err) {
                err.should.be.exactly('Selenium web driver timed out while trying to connect to local Selenium server.');
                done();
            });
        });

        // After all tests are done, update the SauceLabs job with the test status,
        // and close the browser.
        after(function(done) {
            server.close();
            done();
        });

    });

});
