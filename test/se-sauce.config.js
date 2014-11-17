
module.exports = {
    quiet: false,           // Silences the console output
    webdriver: {            // Options for selenium webdriver (webdriverio)
        host: 'ondemand.saucelabs.com',
        port: 80,
        user: process.env.SAUCE_USERNAME,
        key: process.env.SAUCE_ACCESS_KEY,
        logLevel: 'silent',
        desiredCapabilities: [] // Non-standard option; An array of desired capabilities instead of a single object
    },
    httpServer: {           // Options for local http server (npmjs.org/package/http-server)
        disable: false,         // Non-standard option; used to skip launching the http server
        port: 8081,              // Non-standard option; it is passed into the httpServer.listen() method
        root: __dirname
    },
    sauceLabs: {            // Options for SauceLabs API wrapper (npmjs.org/package/saucelabs)
        username: process.env.SAUCE_USERNAME,
        password: process.env.SAUCE_ACCESS_KEY
    },
    sauceConnect: {         // Options for SauceLabs Connect (npmjs.org/package/sauce-connect-launcher)
        disable: false,         // Non-standard option; used to disable sauce connect
        username: process.env.SAUCE_USERNAME,
        accessKey: process.env.SAUCE_ACCESS_KEY
    },
    selenium: {             // Options for Selenium Server (npmjs.org/package/selenium-standalone). Only used if you need Selenium running locally.
        args: []                // options to pass to `java -jar selenium-server-standalone-X.XX.X.jar`
    }
};

// If SauceLabs environment variables are present, set up SauceLabs browsers
if(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)
{
    module.exports.webdriver.desiredCapabilities = [{
        browserName: 'chrome',
        version: '27',
        platform: 'XP',
        tags: ['examples'],
        name: 'This is an example test'
    }, {
        browserName: 'firefox',
        version: '33',
        platform: 'XP',
        tags: ['examples'],
        name: 'This is an example test'
    }];
}
// If no SauceLabs environment variables exist, use local browsers
else
{
    module.exports.webdriver.desiredCapabilities = [
        { browserName: 'chrome' },
        { browserName: 'firefox' }
    ];
}