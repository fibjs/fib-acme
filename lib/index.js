const coroutine = require("coroutine");
const crypto = require("crypto");
const base64 = require("base64");
const fs = require("fs");
const http = require("http");
const mq = require("mq");
const jws = require("fib-jws");

const algos = {
    "P-256": "ES256",
    "P-384": "ES384",
    "P-521": "ES512"
};

const crv = "P-384";
const algo = algos[crv];
const renewBefore = 30;

const defaultService = "https://acme-v02.api.letsencrypt.org/directory";
// const defaultService = "https://acme-staging-v02.api.letsencrypt.org/directory";

function _thumbprint(key) {
    const jwk = key.publicKey.json();

    const sortedJwk = Object.keys(jwk)
        .sort()
        .reduce((result, k) => {
            result[k] = jwk[k]
            return result
        }, {})
    return base64.encode(crypto.createHash("sha256").update(JSON.stringify(sortedJwk)).digest(), true);
}

function AcmeApp(opts) {
    var cfg;

    var handler;
    var directory;

    var order;
    var last_nonce;

    var httpd;
    var httpsd;
    var timerd;

    var self_challenge;

    if (!(this instanceof AcmeApp))
        throw new Error("AcmeApp must be called with new");

    const _request = (_protected, payload) => {
        var nonce;
        if (last_nonce) {
            nonce = last_nonce;
            last_nonce = null;
        } else
            nonce = http.head(directory.newNonce).headers["Replay-Nonce"];

        const header = {
            alg: algo,
            nonce: nonce,
            ..._protected
        };

        if (cfg.kid)
            header.kid = cfg.kid;

        const signs = jws.sign(header, payload, cfg.key).split(".");
        const query = {
            protected: signs[0],
            payload: signs[1],
            signature: signs[2]
        };

        console.log("\n================================================================================");
        console.notice(_protected.url);
        console.dir({
            protected: header,
            payload,
            signature: signs[2]
        }, {
            depth: 10
        });

        var res = http.post(_protected.url, {
            headers: {
                "Content-Type": "application/jose+json"
            },
            json: query
        });

        if (res.statusCode > 300)
            throw new Error(res.json().detail);

        console.log("--------------------------------------------------------------------------------");
        console.dir(res.json(), {
            depth: 10
        });

        last_nonce = res.headers["Replay-Nonce"];
        res.query = query;

        return res;
    }

    const renew_cert = () => {
        if (cfg.cert.cert) {
            var cert = new crypto.X509Cert(cfg.cert.cert);
            if (cert.notAfter - Date.now() > renewBefore * 24 * 60 * 60 * 1000)
                return;
        }

        self_challenge = crypto.randomBytes(32).toString("hex");
        var res = http.get(`http://${cfg.domain}/.well-known/acme-challenge/${self_challenge.substring(0, 16)}`).body.readAll().toString();
        if (res != self_challenge)
            throw new Error("self challenge failed, http server not started or domain not set.");

        last_nonce = null;
        if (!directory)
            directory = http.get(cfg.service).json();

        var res = _request({
            url: directory.newOrder
        }, {
            identifiers: [{
                type: "dns",
                value: cfg.domain
            }]
        });

        order = {
            url: res.headers["Location"],
            csr: base64.encode(new crypto.X509Req(`CN=${cfg.domain}`, cfg.cert.key).der(), true),
            ...res.json()
        };

        if (!order.challenges) {
            res = _request({
                url: order.authorizations[0]
            }).json();

            order.challenges = res.challenges;
        }

        for (var n = 0; n < 10; n++) {
            const challenges = order.challenges;
            for (var i = 0; i < challenges.length; i++)
                if (challenges[i].type == "http-01") {
                    res = _request({
                        url: challenges[i].url
                    }, {}).json();
                    break;
                }

            if (res.status == "valid")
                break;
            coroutine.sleep(5000);
        }

        if (res.status != "valid")
            throw new Error("challenge failed");

        res = _request({
            url: order.finalize
        }, {
            csr: order.csr
        }).json();

        for (var n = 0; n < 10; n++) {
            res = _request({
                url: order.url
            }).json();

            if (res.status == "valid") {
                res.certificate;
                const cert = http.get(res.certificate).body.readAll().toString();
                cfg.cert.cert = cert;
                delete order;

                fs.writeTextFile(opts.config, JSON.stringify(cfg, null, 4));
                break;
            }

            coroutine.sleep(5000);
        }

        if (res.status != "valid")
            throw new Error("finalize failed");

        if (httpsd) {
            httpsd.stop();
            httpsd = new http.HttpsServer(cfg.cert.cert, cfg.cert.key, 443, handler);
            httpsd.start();
        }
    }

    if (!opts.config)
        throw new Error("config not set");

    try {
        cfg = JSON.parse(fs.readTextFile(opts.config));
    } catch (e) {
        cfg = {};
    }

    cfg.service = cfg.service || defaultService;

    if (!opts.domain)
        throw new Error("domain not set");
    else if (!cfg.domain)
        cfg.domain = opts.domain;
    else if (cfg.domain != opts.domain)
        throw new Error(`domain not match: ${cfg.domain} != ${opts.domain}`);

    if (!opts.email)
        throw new Error("email not set");
    else if (!cfg.email)
        cfg.email = opts.email;
    else if (cfg.email != opts.email)
        throw new Error(`email not match: ${cfg.email} != ${opts.email}`);

    if (!cfg.key)
        cfg.key = crypto.generateKey(crv);
    else
        cfg.key = crypto.PKey.from(cfg.key);

    if (!cfg.kid) {
        if (!directory)
            directory = http.get(cfg.service).json();

        var res = _request({
            url: directory.newAccount,
            jwk: cfg.key.publicKey.json()
        }, {
            termsOfServiceAgreed: true,
            contact: cfg.email ? [`mailto:${cfg.email}`] : []
        });

        cfg.kid = res.headers["Location"];
    }

    if (!cfg.cert)
        cfg.cert = {};

    if (!cfg.cert.key)
        cfg.cert.key = crypto.generateKey(crv);
    else
        cfg.cert.key = crypto.PKey.from(cfg.cert.key);

    if (!opts.handler)
        throw new Error("handler not set");
    else if (opts.handler instanceof mq.Handler)
        handler = opts.handler;
    else
        handler = new mq.Handler(opts.handler);

    fs.writeTextFile(opts.config, JSON.stringify(cfg, null, 4));

    this.start = () => {
        if (timerd)
            throw new Error("already started");

        try {
            httpd = new http.Server(80,
                {
                    "/.well-known/acme-challenge/:token": (req, token) => {
                        if (self_challenge && token == self_challenge.substring(0, 16))
                            return req.response.write(self_challenge);

                        if (!order || !order.challenges)
                            return req.response.writeHead(404);

                        const challenges = order.challenges;
                        for (var i = 0; i < challenges.length; i++)
                            if (challenges[i].type == "http-01" && challenges[i].token == token) {
                                var res = challenges[i].token + "." + _thumbprint(cfg.key);
                                console.notice(res);
                                return req.response.write(res);
                            }

                        req.response.writeHead(404);
                    },
                    "*": req => {
                        req.response.writeHead(
                            302,
                            {
                                "Location": "https://" + cfg.domain + req.address + (req.queryString ? `?${req.queryString}` : "")
                            }
                        )
                    }
                }
            );
            httpd.start();

            renew_cert();

            httpsd = new http.HttpsServer(cfg.cert.cert, cfg.cert.key, 443, handler);
            httpsd.start();

            timerd = setInterval(renew_cert, 10000);
        } finally {
            if (!timerd)
                this.stop();
        }
    }

    this.stop = () => {
        if (timerd) {
            clearInterval(timerd);
            timerd = null;
        }

        if (httpsd) {
            httpsd.stop();
            httpsd = null;
        }

        if (httpd) {
            httpd.stop();
            httpd = null;

        }
    }
}

module.exports = AcmeApp;