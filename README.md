# le-store-SPEC

The reference implementation, specification, template, and tests for creating an le-store- strategy.

The reference implementation is completely in-memory.

See [Help Wanted: Database Plugins (for saving certs)](https://github.com/Daplie/node-letsencrypt/issues/39)

API
===

```
* getOptions()
* accounts.
  * checkKeypair(opts, cb)
  * setKeypair(opts, keypair, cb)
  * check(opts, cb)
  * set(opts, reg, cb)
* certificates.
  * checkKeypair(opts, cb)
  * setKeypair(opts, keypair, cb)
  * check(opts, cb)
  * set(opts, certs, cb)
```

Keypairs
--------

For convenience, the keypair object will always contain **both** PEM and JWK
versions of the private and/or public keys when being passed to the `*Keypair` functions.

**set**

`setKeypair` will always be called with `email` and **all three** forms of the keypair:
`privateKeyPem`, `publicKeyPem`, and `privateKeyJwk`. It's easy to generate `publicKeyJwk`
from `privateKeyJwk` because it is just a copy of the public fields `e` and `n`.

**check**

`checkKeypair` may be called with any of `email`, `accountId`, and `keypair` - which will
contain only `publicKeyPem` and `publicKeyJwk`.
