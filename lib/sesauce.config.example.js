
module.exports = {
    username: process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    webdriver: {},
    server: { port: 52985, root: __dirname },
    connect: {}
};

if(process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY)
{
    module.exports.webdriver.desiredCapabilities = {
        browserName: 'chrome',
        version: '27',
        platform: 'XP',
        tags: ['examples'],
        name: 'This is an example test'
    };
}
else
{
    module.exports.webdriver.desiredCapabilities = {
        browserName: 'chrome'
    };
}