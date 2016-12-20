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

  function createIndex(indexName, indexData, value, callback) {
    // generate the index value
    var index = indexName + '-' +
      crypto.createHash('sha256').update(indexData).digest('hex');

    client.set(index, value, callback);
  }

  function getByIndex(indexName, indexData, callback) {
    // generate the index
    var index = indexName + '-' +
      crypto.createHash('sha256').update(indexData).digest('hex');

    // fetch the value of the index
    client.get(index, function(err, reply) {
      if(err) {
        return callback(err);
      }
      if(!reply) {
        // index does not exist
        return callback(null, null);
      }

      // fetch the actual data
      client.get(reply, deserializeJson(callback));
    });
  }

  function redisSetAccountKeypair(options, keypair, callback) {
    console.log("redisSetAccountKeypair", options, keypair);
    // options.email     // optional
    // options.accountId // optional - same as returned from acounts.set(options, reg)
    var keypairId = 'keypair-' +
      crypto.createHash('sha256').update(keypair.publicKeyPem).digest('hex');
    var jsonKeypair = JSON.stringify(keypair);

    async.parallel([
      function(callback) {
        // write the keypair data
        client.set(keypairId, jsonKeypair, callback);
      },
      function(callback) {
        // create an index for email if one was given
        if(options.email) {
          return createIndex('idx-e2k', options.email, keypairId, callback);
        }
        callback(null, 'NOP');
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
   * @param {Object[]} options - options passed to storage call
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
      return getByIndex('idx-e2k', options.email, callback);
    } else if(options.accountId) {
      return getByIndex('idx-a2k', options.accountId, callback);
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
      return getByIndex('idx-e2a', options.email, callback);
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
        return client.set(accountId, jsonAccount, callback);
      },
      function(callback) {
        if(account.email) {
          return createIndex('idx-e2a', account.email, account.id, callback);
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
    console.log("redisSetCertificateKeypair", options, keypair);
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

    if(options.domains) {
      return getByIndex('idx-d2c', options.domains[0], callback);
    } else if(options.email) {
      return getByIndex('idx-e2c', options.email, callback);
    } else if(options.accountId) {
      return getByIndex('idx-a2c', options.accoundId, callback);
    }

    callback(new Error('le-store-redis.redisCheckCertificate requires ' +
      'options.domains, options.email, or options.accoundId'));

    // return certificate PEMs from db if they exist, otherwise null
    // optionally include expiresAt and issuedAt, if they are known exactly
    // (otherwise they will be read from the cert itself later)
    callback(null, { privkey: 'PEM', cert: 'PEM', chain: 'PEM', domains: [], accountId: '...' });
  }

  function redisSetCertificate(options, pems, callback) {
    console.log("redisSetCertificate", options, pems);
    // options.domains   // each of these must be indexed
    // options.email     // optional, should be indexed
    // options.accountId // optional - same as set by you in accounts.set(options, keypair) above

    // pems.privkey
    // pems.cert
    // pems.chain

    var certId = 'cert-' + crypto.createHash('sha256')
      .update(pems.cert).digest('hex');
    var cert = _.cloneDeep(pems);

    var jsonCert = JSON.stringify(cert);

    async.parallel([
      function(callback) {
        // write the cert to the database
        return client.set(certId, jsonCert, callback);
      },
      function(callback) {
        if(options.accountId) {
          // create an accountId to cert index
          return createIndex('idx-a2c', options.accountId, certId, callback);
        }
        callback();
      },
      function(callback) {
        if(options.email) {
          // create an email to cert index
          return createIndex('idx-e2c', options.email, certId, callback);
        }
        callback();
      },
      function(callback) {
        if(options.domains) {
          // create a domain to cert index
          return async.each(options.domains, function(domain, callback) {
            createIndex('idx-d2c', domain, certId, callback);
          }, function(err) {
            callback(err);
          });
        }
        callback();
      }], function(err) {
        if(err) {
          return callback(err);
        }
        callback(null, cert);
    });
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
