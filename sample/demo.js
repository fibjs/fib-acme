const AcmeApp = require('..');

const app = new AcmeApp({
  config: `${__dirname}/config.json`,
  domain: 'domain.com',
  email: 'user@domain.com',
  handler: function (req) {
    req.response.write("Hello World!");
  },
});

app.start();
