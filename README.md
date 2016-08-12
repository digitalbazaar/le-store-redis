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
  * set(opts, reg, cb)
```
