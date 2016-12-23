# le-store-redis

The Redis storage strategy for node-letsencrypt is capable of storing
and retrieving keypairs, accounts, certificates, and certificate
keypairs from a Redis database. It is most useful in production setups
where multiple load balancers need to provide HTTPS-based proxying for
a number of application front-end systems.

## Security Warning

It is strongly advised that any production Redis system is deployed
using at least password-based authentication in addition to
protections like IP-based request limiting and client-side TLS
certificates. Unauthorized access to the Redis database enables an
attacker to spoof any certificate stored in the database.

## Options

The following options may be set in the `options` parameter:

* {boolean} debug - set to ```true``` if debug output is desired.
* {integer} certExpiry - delete certificate entries from
    database after this many seconds, default is 100 days.
* {object} redisOptions - options passed to the
  [Redis driver](http://redis.js.org/#api-rediscreateclient)

## Usage Example

To instantiate a Redis-based Let's Encrypt plugin:

```javascript
  // configure Redis-based Let's Encrypt storage backend for storing keys and certs
  var leStore = require('le-store-redis').create({
    debug: true
    redisOptions: {
      db: 2,
      password: 'M3C1lSO1kLBdPd95tJGu1I0OtTp4c5Rz'
    }
  });
```

This object may then be used in the Let's Encrypt constructor.

# Database Layout

 The Redis database is designed to be scalable to at least thousands of
 domains. Scalability past tens of thousands of domains has not been tested,
 but should work (in theory) based on the indexing layout and available
 memory.

 There are three primary types of data that are stored in the database:

 * Keypairs are stored in **keypair-HASH** entries.
 * Accounts are stored in **account-HASH** entries.
 * Certificates are stored in **cert-HASH** entries.

There are five types of indexes in the database:

 * **idx-e2a-HASH** entries store email to account mappings.
 * **idx-e2k-HASH** entries store email to keypair mappings.
 * **idx-e2c-HASH** entries store email to certificate mappings.
 * **idx-a2c-HASH** entries store account to certificate mappings.
 * **idx-d2c-HASH** entries store domain to certificate mappings.
