# le-store-SPEC

The reference implementation, specification, template, and tests for creating an le-store- strategy.

The reference implementation is completely in-memory.

See [Help Wanted: Database Plugins (for saving certs)](https://github.com/Daplie/node-letsencrypt/issues/39)

How to create a custom strategy
===============================

READ THIS README:
Believe it or not, most of your answers are either right here
or in the comments in the sample code in `index.js`.

Now, let's say there's some new database AwesomeDB that
we want to make a plugin for, here's how we'd start:

```bash
# First create you repo on github or wherever
# Then clone it
git clone git@github.com:AwesomeDB/le-store-awesome.git

pushd le-store-awesome

# IMPORTANT: we pull in the 'template' branch, which has the skeleton code
git pull https://github.com/Daplie/le-store-SPEC.git template

git push
```

Or, if you already have some code and just need to merge in the tests:

```bash
git pull https://github.com/Daplie/le-store-SPEC.git tests
```

Next, Just run the tests

```
node tests/basic.js
```

Note: you should not modify the tests that come from the tests branch,
but rather create separate files for your own tests.

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

```
// keypair looks like this
{ privateKeyPem: '...'
, publicKeyPem: '...'
, privateKeyJwk: { ... }
}
```

**check**

`checkKeypair` may be called with any of `email`, `accountId`, and `keypair` - which will
contain only `publicKeyPem` and `publicKeyJwk`.

```
// opts looks like this
{
  email: '...@...'
, accountId: '...'
, keypair: {
    publicKeyPem: '...'
  , publicKeyJwk: { ... }
  }
}
```
