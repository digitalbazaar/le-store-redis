'use strict';

var PromiseA = require('bluebird');
var leStore = PromiseA.promisifyAll(require('../').create({
  debug: true
}));
leStore.accounts = PromiseA.promisifyAll(leStore.accounts);
leStore.certificates = PromiseA.promisifyAll(leStore.certificates);

// fixtures
var doesntExist = {
  email: 'e@gmail.co'
, accountId: 'eee'
};
var goodGuy = {
  email: 'goodguy@gmail.com'
, keypair: {
    privateKeyPem: 'PRIVKEY.PEM', privateKeyJwk: { e: 'EXPO', n: 'MODULO' }
  , publicKeyPem: 'PUBKEY.PEM'/*, publicKeyJwk: would be reduntdant */
  }
};

var tests = [



  //
  // SANITY CHECKS
  //

  // SANITY test that an unregistered email returns no results
  function () {
    return leStore.accounts.checkKeypairAsync({
      email: doesntExist.email
    }).then(function (keypair) {
      if (null !== keypair) {
        throw new Error("Should return `null` when keypair does not exist by `email`.");
      }
    });
  }

  // SANITY test that an unregistered account id returns no results
, function () {
    return leStore.accounts.checkAsync({
      accountId: doesntExist.accountId
    }).then(function (account) {
      if (null !== account) {
        throw new Error("Should return `null` when account does not exist by `accountId`.");
      }
    });
  }






  //
  // Creating Account Keypairs
  //

  // Register a private key to an email
  // and make sure agreeTos remains falsey
, function () {
    return leStore.accounts.setKeypairAsync(goodGuy, goodGuy.keypair);
  }
, function () {
    return leStore.accounts.checkKeypairAsync({
      email: goodGuy.email
    }).then(function (keypair) {

      if (!keypair) {
        throw new Error("should return saved keypair");
      }

      if (goodGuy.keypair.privateKeyPem !== keypair.privateKeyPem) {
        if (keypair.privateKeyJwk) {
          throw new Error("Error in test itself (not your fault). TODO: implement checking privateKeyJwk.");
        }
        throw new Error("agreeTos should return false or null because it was not set.");
      }
    });
  }






  //
  // Creating Accounts
  //

  // create a new account
, function () {
    var account = {
      agreeTos: true
    , keypair: goodGuy.keypair
    , receipt: {}
    };

    return leStore.accounts.setAsync(goodGuy, account).then(function (account) {
      if (!account || !account.id || !account.email) {
        throw new Error('accounts.set should return the object with its new `id` attached');
      }

      goodGuy.accountId = account.id;
    });
  }

  // get by account id
, function () {
    return leStore.accounts.checkAsync({
      accountId: goodGuy.accountId
    }).then(function (account) {

      if (!account) {
        throw new Error("Did not find account.");
      }
      else if (!account.keypair) {
        throw new Error("Account did not have a keypair.");
      }
      else if (goodGuy.keypair.privateKeyPem !== account.keypair.privateKeyPem) {
        if (account.keypair.privateKeyJwk) {
          throw new Error("Error in test itself (not your fault). TODO: implement checking privateKeyJwk.");
        }
        throw new Error("agreeTos should return false or null because it was not set.");
      }

      if (!account.email) {
        throw new Error("should have returned email");
      }

      if (!account.agreeTos) {
        throw new Error("should have returned agreeTos");
      }

      if (!account.receipt) {
        throw new Error("should have returned receipt");
      }
    });
  }
  // get by email
, function () {
    return leStore.accounts.checkAsync({
      email: goodGuy.email
    }).then(function (account) {

      if (!account) {
        throw new Error("should have returned account for " + goodGuy.email);
      }

      if (!account.keypair) {
        throw new Error("should have returned account.keypair for " + goodGuy.email);
      }

      if (goodGuy.keypair.privateKeyPem !== account.keypair.privateKeyPem) {
        if (account.keypair.privateKeyJwk) {
          throw new Error("Error in test itself (not your fault). TODO: implement checking privateKeyJwk.");
        }
        throw new Error("agreeTos should return false or null because it was not set.");
      }

      if (!account.email) {
        throw new Error("should have returned email");
      }

      if (!account.agreeTos) {
        throw new Error("should have returned agreeTos");
      }

      if (!account.receipt) {
        throw new Error("should have returned receipt");
      }
    });
  }

  // Test that id and accountId are ignored
  // and that arbitrary keys are stored
, function () {
    var rnd = require('crypto').randomBytes(8).toString('hex');
    var opts = {
      accountId: '_account_id'
    , id: '__account_id'
    , email: 'john.doe@gmail.com'
    , agreeTos: 'TOS_URL'
    };
    var account = {
      keypair: { privateKeyJwk: {}, privateKeyPem: 'PEM2', publicKeyPem: 'PUBPEM2'  }
    , receipt: {}
    };
    account[rnd] = rnd;
    return leStore.accounts.setKeypairAsync(opts, account.keypair).then(function () {
      return leStore.accounts.setAsync(opts, account).then(function (account) {

        if ('_account_id' === account.id || '__account_id' === account.id) {
          throw new Error("Should create `id` deterministically from email or public key, not the given `accountId` or `id`.");
        }

        if ('john.doe@gmail.com' !== account.email) {
          throw new Error("Should return the same email that was stored.");
        }

        if ('TOS_URL' !== account.agreeTos) {
          throw new Error("Should return the same string for the tosUrl in agreeTos as was stored.");
        }

        if ('PEM2' !== account.keypair.privateKeyPem) {
          throw new Error("Should return the same privateKey that was stored.");
        }

        if (rnd !== account[rnd]) {
          throw new Error("Should save and restore arbitrary keys.");
        }
      });
    });
  }

  // test lots of stuff
, function () {
    return leStore.accounts.checkAsync({
      accountId: goodGuy.accountId
    }).then(function (account) {
      if (!account
          || !account.agreeTos
          || account.email !== goodGuy.email
          || goodGuy.keypair.privateKeyPem !== account.keypair.privateKeyPem
          ) {
        throw new Error("Should return the same account that was saved when retrieved using `accountId`.");
      }
    });
  }
, function () {
    return leStore.accounts.checkAsync({
      email: goodGuy.email
    }).then(function (account) {
      if (!account
          || !account.agreeTos
          || account.email !== goodGuy.email
          || goodGuy.keypair.privateKeyPem !== account.keypair.privateKeyPem
          ) {
        throw new Error("Should return the same account that was saved when retrieved using `accountId`.");
      }
    });
  }






  //
  // Save a cert
  //
, function () {
    var certOpts = {
      domains: [ 'example.com', 'www.example.com', 'foo.net', 'bar.foo.net' ]
    , email: goodGuy.email
    , certs: {
        cert: 'CERT_A.PEM'
      , privkey: 'PRIVKEY_A.PEM'
      , chain: 'CHAIN_A.PEM'
      // TODO issuedAt, expiresAt?
      }
    };

    return leStore.certificates.setAsync(certOpts, certOpts.certs);
  }
  // and another
, function () {
    var certOpts = {
      domains: [ 'foo.com', 'www.foo.com', 'baz.net', 'bar.baz.net' ]
    , accountId: goodGuy.accountId
    , certs: {
        cert: 'CERT_B.PEM'
      , privkey: 'PRIVKEY_B.PEM'
      , chain: 'CHAIN_B.PEM'
      }
    };

    return leStore.certificates.setAsync(certOpts, certOpts.certs);
  }

  // basic test (set by email)
, function () {
    var certOpts = {
      domains: [ 'example.com' ]
    };
    return leStore.certificates.checkAsync(certOpts).then(function (certs) {
      if (!certs || certs.privkey !== 'PRIVKEY_A.PEM') {
        throw new Error("should have correct certs for example.com (set by email)");
      }
    });
  }
  // basic test (set by accountId)
, function () {
    var certOpts = {
      domains: [ 'example.com' ]
    };
    return leStore.certificates.checkAsync(certOpts).then(function (certs) {
      if (!certs || certs.privkey !== 'PRIVKEY_A.PEM') {
        throw new Error("should have correct certs for example.com (set by email)");
      }
    });
  }
  // altnames test
, function () {
    var certOpts = {
      domains: [ 'bar.foo.net' ]
    };
    return leStore.certificates.checkAsync(certOpts).then(function (certs) {
      if (!certs || certs.privkey !== 'PRIVKEY_A.PEM') {
        throw new Error("should have correct certs for bar.foo.net (one of the example.com altnames)");
      }
    });
  }
  // altnames test
, function () {
    var certOpts = {
      domains: [ 'baz.net' ]
    };
    return leStore.certificates.checkAsync(certOpts).then(function (certs) {
      if (!certs || certs.privkey !== 'PRIVKEY_B.PEM') {
        throw new Error("should have correct certs for baz.net (one of the foo.com altnames)");
      }
    });
  }
];

var arr = tests.slice(0);

function run() {
  var test = tests.shift();
  if (!test) {
    console.info('All tests passed');
    return;
  }

  test().then(run, function (err) {
    var index = arr.length - tests.length - 1;
    console.error('');
    console.error(arr[index].toString());
    console.error('');
    console.error(err.stack);
    console.error('');
    console.error('Failed Test #' + index);
  });
}

run();
