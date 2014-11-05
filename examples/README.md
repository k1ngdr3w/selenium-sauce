# Running the examples

## Mocha example

You'll want to install [Mocha](http://mochajs.org) using nom:

```bash
$ npm install -g mocha
```

If you have SauceLabs credentials (a username and access key), specify those as environment variables:

```bash
$ export SAUCE_USERNAME=****
$ export SAUCE_ACCESS_KEY=***
```

If you don't have credentials, the tests will run locally (using installed copies of Chrome and Firefox, if available).

Then run the test using Mocha and specify the test.mocha.js file:

```bash
$ mocha test.mocha.js
```
