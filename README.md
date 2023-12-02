fib-acme
================

The `fib-acme` module is a lightweight and flexible wrapper around the ACME protocol that allows you to easily manage SSL certificates for your domains. It integrates seamlessly with `fibjs`, providing a simple way to obtain and renew SSL certificates from Let’s Encrypt.

## Features

* Automatic certificate generation and renewal
* Automatically starts an HTTPS server and upgrades the certificate when it is renewed
* Integration with Let’s Encrypt services
* Support for ECDSA and RSA key types
* Flexible configuration options
* Easy-to-use API

## Installation

```sh
$ fibjs --install fib-acme
```

## Usage

```JavaScript
const AcmeApp = require('fib-acme');

const app = new AcmeApp({
  domain: '<your_domain>',
  email: '<your_email>',
  handler: function (req) {
    req.response.write("Hello World!");
  },
});

app.start();
```

The `fib-acme` module provides a simple way to manage SSL certificates for your domains using the ACME protocol. Here’s how you can use it in your `fibjs` application:

1. Install the `fib-acme` module using the npm package manager.
2. Import the `fib-acme` module into your application.
3. Create a new `AcmeApp` instance with the desired configuration options.
4. Call the start() method on the `AcmeApp` instance to initiate the certificate generation and renewal process.

Upon calling start(), the `AcmeApp` instance will automatically generate a configuration file and request an SSL certificate from Let’s Encrypt for the specified domain. It will also handle the automatic renewal of the certificate when it approaches expiration. Additionally, the module will start an HTTPS server and upgrade the certificate in real-time when it is renewed.

## Configuration

The `AcmeApp` instance automatically creates and updates a configuration file named acme.json in the current working directory. The configuration file contains the necessary details for the ACME protocol, including the domain, email address, and key pairs.

The acme.json file has the following structure:

```JavaScript
{
    "service": "https://acme-staging-v02.api.letsencrypt.org/directory",
    "domain": "<your_domain>",
    "email": "<your_email>",
    "key": {
        "kty": "EC",
        "crv": "P-384",
        "x": "<public_key_x>",
        "y": "<public_key_y>",
        "d": "<private_key>"
    },
    "kid": "https://acme-staging-v02.api.letsencrypt.org/acme/acct/<account_id>",
    "cert": {
        "key": {
            "kty": "EC",
            "crv": "P-384",
            "x": "<public_key_x>",
            "y": "<public_key_y>",
            "d": "<private_key>"
        },
        "cert": "<certificates>“
    }
}
```

* service: The URL of the ACME service. By default, it is set to the Let’s Encrypt staging service for testing purposes.
* domain: The domain for which the SSL certificate is requested.
* email: The email address to be associated with the SSL certificate.
* key: The key pair used for the ACME account. It includes the key type, curve, public key coordinates, and the private key.
* kid: The URL of the ACME account.
* cert: The key pair used for the SSL certificate. It includes the key type, curve, public key coordinates, and the private key, as well as the certificate itself.

## API

### new AcmeApp(options)

Creates a new `AcmeApp` instance with the provided options. The available options are:

* domain (required): The domain for which the SSL certificate is requested.
* email (required): The email address to be associated with the SSL certificate.
* handler (required): The request handler function called when a verification request is made.

#### Example:

```JavaScript
const AcmeApp = require('fib-acme');

const app = new AcmeApp({
  domain: '<your_domain>',
  email: '<your_email>',
  handler: function (req) {
    req.response.write("Hello World!");
  },
});
```

Upon creating a new `AcmeApp` instance, you can specify the domain and email address for which you want an SSL certificate. Optionally, you can provide a request handler function that will be called when a verification request is made.

### AcmeApp.start()

Starts the `AcmeApp` instance, initiating the certificate generation and renewal process.

#### Example:

```JavaScript
app.start();
```

The start() method triggers the ACME protocol communication with Let’s Encrypt servers, allowing the `AcmeApp` instance to obtain and renew an SSL certificate for the specified domain.

### AcmeApp.stop()

Stops the `AcmeApp` instance and terminates the certificate generation and renewal process.

#### Example:

```JavaScript
app.stop();
```

By calling stop(), you can gracefully terminate the certificate generation and renewal process. This properly closes any active connections and ensures that the application can exit cleanly.

## Conclusion

The `fib-acme` module provides an easy and efficient way to manage SSL certificates for your domains using the ACME protocol. The `AcmeApp` instance automatically handles the creation and updating of the configuration file, as well as the generation and renewal of SSL certificates. Give it a try in your `fibjs` application today and secure your server with ease!