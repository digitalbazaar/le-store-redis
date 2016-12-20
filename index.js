/*
 * Redis storage strategy for node-letsencrypt.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var redis = require('redis');

// utility function to deserialize data from JSON
function deserializeJson(callback) {
  return function(err, result) {
    if(err) {
      return callback(err);
    }
    if(result) {
      return callback(null, JSON.parse(result));
    }

    callback(err, result);
  };
}

module.exports.create = function(options) {
  var defaults = {
    redisOptions: options.redisOptions || {}
  };
  var client = redis.createClient(defaults.redisOptions);

  function redisSetAccountKeypair(options, keypair, callback) {
    console.log("redisSetAccountKeypair", options, keypair);
    // options.email     // optional
    // options.accountId // optional - same as returned from acounts.set(options, reg)
    var jsonKeypair = JSON.stringify(keypair);

    async.parallel([
      function(callback) {
        if(options.email) {
          // index the keypair by email if one was provided
          var emailKeypairIndex = 'keypair-email-' +
            crypto.createHash('sha256').update(options.email).digest('hex');

          return client.set(emailKeypairIndex, jsonKeypair, callback);
        }
        callback(null, keypair);
      },
      function(callback) {
        if(options.accountId) {
          // index the keypair by accountId if one was provided
          var accountKeypairIndex = 'keypair-account-' +
            crypto.createHash('sha256').update(options.accountId).digest('hex');

          return client.set(accountKeypairIndex, jsonKeypair, callback);
        }
        callback(null, keypair);
      }], function(err, results) {
        if(err) {
          return callback(err);
        }
        if(results[0] !== null && results[1] !== null) {
          callback(null, keypair);
        }
    });
  }

  /**
   * Retrieves a keypair associated with an account from the database.
   *
   * @param {Object[]} options - options passed to storage called
   * @param {string} options[].email - email address associated with
   *   registration.
   * @param {string} options[].accountId - account ID as returned from
   *   redisSetAccount()
   * @param {Function} callback(err, keypair) - called after storage attempt,
   *   keypair will be null if it was not found.
   */
  function redisCheckAccountKeypair(options, callback) {
    console.log("redisCheckAccountKeypair", options);

    if(options.email) {
      var emailKeypairIndex = 'keypair-email-' + crypto.createHash('sha256')
        .update(options.email).digest('hex');
      return client.get(emailKeypairIndex, deserializeJson(callback));
    } else if(options.accountId) {
      var accountKeypairIndex = 'keypair-account-' + crypto.createHash('sha256')
        .update(options.accountId).digest('hex');
      return client.get(accountKeypairIndex, deserializeJson(callback));
    }

    callback(new Error('le-store-redis.redisCheckAccountKeypair ' +
      'lookup requires options.email or options.accountId.'));
  }

  function redisCheckAccount(options, callback) {
    console.log("redisCheckAccount", options);
    // options.email       // optional
    // options.accountId   // optional - same as returned from acounts.set(options, reg)
    // options.domains     // optional - same as set in certificates.set(options, certs)

    if(options.email) {
      var emailAccountIndex = 'account-email-' +
        crypto.createHash('sha256').update(options.email).digest('hex');
      return client.get(emailAccountIndex, deserializeJson(callback));
    } else if(options.accountId) {
      return client.get(options.accountId, deserializeJson(callback));
    } else if(options.domains) {
      // FIXME: implement domain indexing
      return client.get(options.domains, deserializeJson(callback));
    }

    callback(new Error('le-store-redis.redisCheckAccount requires ' +
      'options.email, options.accountId, or options.domains'));
  }

  /**
   * Stores an account in the database.
   *
   * @param {Object[]} options - options passed to storage called
   * @param {string} options[].email - email address associated with
   *   registration.
   * @param {Object[]} reg - ACME registration information.
   * @param {string} reg[].keypair - keypair used for registration.
   * @param {string} reg[].receipt - ACME registration receipt.
   * @param {Function} callback(err, account) - called after storage attempt.
   */
  function redisSetAccount(options, reg, callback) {
    console.log("redisSetAccount", options, reg);
    var accountId = 'account-' + crypto.createHash('sha256')
      .update(reg.keypair.publicKeyPem).digest('hex');
    var account = _.cloneDeep(reg);
    account.id = accountId;
    account.accountId = accountId;
    account.email = options.email;
    account.agreeTos = options.agreeTos || reg.agreeTos;

    var jsonAccount = JSON.stringify(account);

    async.parallel([
      function(callback) {
        if(options.email) {
          // index the account by email if one was provided
          var emailAccountIndex = 'account-email-' +
            crypto.createHash('sha256').update(options.email).digest('hex');

          return client.set(emailAccountIndex, jsonAccount, callback);
        }
        callback(null, 'NOP');
      },
      function(callback) {
        if(options.accountId) {
          // index the keypair by accountId if one was provided
          var accountIndex = 'account-' +
            crypto.createHash('sha256').update(options.accountId).digest('hex');

          return client.set(accountIndex, jsonAccount, callback);
        }
        callback(null, 'NOP');
      }], function(err, results) {
        if(err) {
          return callback(err);
        }
        if(results[0] !== null && results[1] !== null) {
          callback(null, account);
        }
    });
  }

  function getRedisOptions() {
    console.log("getRedisOptions", options);
    // merge options with default settings and then return them
    return options;
  }

  function redisSetCertificateKeypair(options, keypair, callback) {
    console.log("redisSetCertificateKeypair", options);
    // options.domains - this is an array, but you nly need the first (or any) of them

    // SAVE to db (as PEM and/or JWK) and index each domain in domains to this keypair
    callback(null, keypair);
  }
  function redisCheckCertificateKeypair(options, callback) {
    console.log("redisCheckCertificateKeypair", options);
    // options.domains - this is an array, but you only need the first (or any) of them


    // check db and return null or keypair object with one of privateKeyPem or privateKeyJwk
    callback(null, { privateKeyPem: '...', privateKeyJwk: {} });
  }

  function redisCheckCertificate(options, callback) {
    console.log("redisCheckCertificate", options);
    // You will be provided one of these (which should be tried in this order)
    // options.domains
    // options.email // optional
    // options.accountId // optional


    // return certificate PEMs from db if they exist, otherwise null
    // optionally include expiresAt and issuedAt, if they are known exactly
    // (otherwise they will be read from the cert itself later)
    callback(null, { privkey: 'PEM', cert: 'PEM', chain: 'PEM', domains: [], accountId: '...' });
  }

  function redisSetCertificate(options, pems, callback) {
    console.log("redisSetCertificate", options);
    // options.domains   // each of these must be indexed
    // options.email     // optional, should be indexed
    // options.accountId // optional - same as set by you in accounts.set(options, keypair) above

    // pems.privkey
    // pems.cert
    // pems.chain

    // SAVE to the database, index the email address, the accountId, and alias the domains
    callback(null, pems);
  }

  return {
    getOptions: getRedisOptions,
    accounts: {
      setKeypair: redisSetAccountKeypair,
      checkKeypair: redisCheckAccountKeypair,
      check: redisCheckAccount,
      set: redisSetAccount,
    },
    certificates: {
      setKeypair: redisSetCertificateKeypair,
      checkKeypair: redisCheckCertificateKeypair,
      check: redisCheckCertificate,
      set: redisSetCertificate,
    }
  };

};
