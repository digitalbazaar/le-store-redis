/*
 * Redis storage strategy for node-letsencrypt.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 *
 * The Redis storage strategy for node-letsencrypt is capable of storing and
 * retrieving keypairs, accounts, certificates, and certificate keypairs
 * from a Redis database. It is most useful in production setups where
 * multiple load balancers need to provide HTTPS-based proxying
 * for a number of application front-end systems. It is strongly advised
 * that any production Redis system is deployed using at least password-based
 * authentication in addition to additional protections like IP-based
 * request limiting and client-side TLS certificates. Unauthorized access
 * to the Redis database enables an attacker to spoof any certificate stored
 * in the database.
 *
 * The Redis database is designed to be scalable to at least thousands of
 * domains. Scalability past tens of thousands of domains has not been tested,
 * but should work (in theory) based on the indexing layout and available
 * memory.
 *
 * There are three primary types of data that are stored in the database:
 *
 * Keypairs are stored in keypair-HASH entries.
 * Accounts are stored in account-HASH entries.
 * Certificates are stored in cert-HASH entries.
 *
 * There are five types of indexes in the database:
 *
 * idx-e2a-HASH entries store email to account mappings.
 * idx-e2k-HASH entries store email to keypair mappings.
 * idx-e2c-HASH entries store email to certificate mappings.
 * idx-a2c-HASH entries store account to certificate mappings.
 * idx-d2c-HASH entries store domain to certificate mappings.
 *
 * By default, since Let's Encrypt certificates are valid for 90 days, all
 * certificate data expires after 100 days. Account and keypair data persists
 * forever and must be cleared manually.
 *
 * Options to the Redis driver may be passed in via redisOptions. More on
 * Redis options can be viewed at http://redis.js.org/#api-rediscreateclient
 */
var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var redis = require('redis');

/**
 * Creates a new instance of a le-store-redis storage plugin.
 *
 * @param {Object[]} options - options passed to storage called
 * @param {string} options[].debug - set to true to enable debugging output.
 * @param {string} options[].certExpiry - delete certificate entries from
 *   database after this many seconds, default is 100 days.
 * @param {string} options[].redisOptions - options that are useful to the
 *   Redis driver. Full documentation for all the Redis options can be viewed
 *   at http://redis.js.org/#api-rediscreateclient. By default,
 *   database 3 is selected, and the max retry delay is 60 seconds.
 *   This is to ensure that the plugin doesn't overwrite the default
 *   database, keeps trying to reconnect frequently, and recovers
 *   within a minute of a redis server coming back online.
 * @return an object that follows the le-store-SPEC interface.
 */
module.exports.create = function(options) {
  var moduleOptions = getRedisOptions();
  var client = redis.createClient(moduleOptions.redisOptions);

  /**
   * Gets the default options merged with the options passed to the plugin.
   *
   * @return {Object} default options overlayed with provided options.
   */
  function getRedisOptions() {
    var defaults = {
      debug: false,
      certExpiry: 100 * 60 * 60 * 24, // all cert data expires after 100 days
      redisOptions: {
        db: 3,
        retry_strategy: function(options) {
          // reconnect after 60 seconds, keep trying forever
          return 60 * 1000;
        }
      }
    };
    var mergedOptions = _.merge(defaults, options);

    _debug('le-store-redis.getRedisOptions', mergedOptions);

    return mergedOptions;
  }

  /**
   * Creates a new instance of a le-store-redis storage driver.
   *
   * @param {Object[]} options - options passed to storage called
   * @param {string} options[].email - optional email address to associate with
   *   the keypair.
   * @param {string} options[].accountId - optional accountId to associate with
   *   the keypair.
   * @param {Object} keypair - a keypair provided by the node-letsencrypt
   *   package.
   * @param {Function} callback(err, keypair) - called when an error occurs, or
   *   when a keypair is successfully written to the database.
   */
  function redisSetAccountKeypair(options, keypair, callback) {
    _debug('le-store-redis.redisSetAccountKeypair', '\nkeypair:', keypair);
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
          return _createIndex('idx-e2k', options.email, keypairId, callback);
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
    _debug('le-store-redis.redisCheckAccountKeypair:',
      options.email, options.accountId);

    if(options.email) {
      return _getByIndex('idx-e2k', options.email, callback);
    } else if(options.accountId) {
      return _getByIndex('idx-a2k', options.accountId, callback);
    }

    callback(new Error('le-store-redis.redisCheckAccountKeypair ' +
      'lookup requires options.email or options.accountId.'));
  }

  /**
   * Checks to see if an account exists in the database. The provided options
   * describe how the account should be looked up.
   *
   * @param {Object[]} options - options passed to storage called
   * @param {string} options[].email - optional email address to use when
   *   looking up the account.
   * @param {string} options[].accountId - optional accountId to use when
   *   looking up the account.
   * @param {string} options[].domains - optional domains to use when looking
   *   up the account.
   * @param {Function} callback(err, account) - called when an error occurs, or
   *   when an account is successfully retrieved from the database.
   */
  function redisCheckAccount(options, callback) {
    _debug('le-store-redis.redisCheckAccount:',
      options.email, options.accountId, options.domains);

    if(options.email) {
      return _getByIndex('idx-e2a', options.email, callback);
    } else if(options.accountId) {
      return client.get(options.accountId, _deserializeJson(callback));
    } else if(options.domains) {
      // FIXME: implement domain indexing
      return client.get(options.domains, _deserializeJson(callback));
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
    _debug('le-store-redis.redisSetAccount', '\nregistration:', reg);
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
          return _createIndex('idx-e2a', account.email, account.id, callback);
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

  /**
   * Stores a keypair associated with a certificate in the database.
   *
   * @param {Object[]} options - options passed to storage call
   * @param {string} options[].domains - domains that should be associated
   *   with the certificate via database indexes (to aid in lookups).
   * @param {Function} callback(err, keypair) - called when an error occurs, or
   *   when a keypair is successfully written to the database.
   */
  function redisSetCertificateKeypair(options, keypair, callback) {
    _debug('le-store-redis.redisSetCertificateKeypair', '\nkeypair:', keypair);
    var keypairId = 'keypair-' + crypto.createHash('sha256')
      .update(keypair.publicKeyPem).digest('hex');
    var jsonKeypair = JSON.stringify(keypair);

    async.parallel([
      function(callback) {
        // write the cert to the database
        client.set(keypairId, jsonKeypair, callback);
        return client.expire(keypairId, moduleOptions.certExpiry);
      },
      function(callback) {
        if(options.domains) {
          // create a domain to keypair index
          return async.each(options.domains, function(domain, callback) {
            _createIndex('idx-d2k', domain, keypairId,
              moduleOptions.certExpiry, callback);
          }, function(err) {
            callback(err);
          });
        }
        callback();
      }], function(err) {
        if(err) {
          return callback(err);
        }
        callback(null, keypair);
    });
  }

  /**
   * Retrieves a keypair associated with a certificate from the database.
   *
   * @param {Object[]} options - options passed to storage call
   * @param {string} options[].domains - an array of domains that may be
   *  associated with the certificate keypair. Only the first domain is used.
   * @param {Function} callback(err, keypair) - called after storage attempt,
   *   keypair will be null if it was not found.
   */
  function redisCheckCertificateKeypair(options, callback) {
    _debug('le-store-redis.redisCheckCertificateKeypair:', options.domains);

    if(options.domains && options.domains[0]) {
      return _getByIndex('idx-d2k', options.domains[0], callback);
    }

    callback(new Error('le-store-redis.redisCheckCertificateKeypair requires ' +
      'options.domains'));
  }

  /**
   * Checks to see if a certificate exists in the database. The provided options
   * describe how the certificate should be looked up.
   *
   * @param {Object[]} options - options passed to check call.
   * @param {string} options[].domains - domains to use when looking
   *   up the account. These will be used for the lookup first.
   * @param {string} options[].email - optional email address to use when
   *   looking up the certificate.
   * @param {string} options[].accountId - optional accountId to use when
   *   looking up the certificate.
   * @param {Function} callback(err, cert) - called when an error occurs, or
   *   when a certificate is successfully retrieved from the database.
   */
  function redisCheckCertificate(options, callback) {
    _debug('le-store-redis.redisCheckCertificate:',
      options.domains, options.email, options.accountId);

    if(options.domains && options.domains.length > 0) {
      return _getByIndex('idx-d2c', options.domains[0], callback);
    } else if(options.email) {
      return _getByIndex('idx-e2c', options.email, callback);
    } else if(options.accountId) {
      return _getByIndex('idx-a2c', options.accoundId, callback);
    }

    callback(new Error('le-store-redis.redisCheckCertificate requires ' +
      'options.domains, options.email, or options.accoundId'));
  }

  /**
   * Stores a certificate in the database.
   *
   * @param {Object[]} options - options passed to the storage call.
   * @param {string} options[].domains - domains associated with
   *   certificate.
   * @param {string} options[].email - email address associated with
   *   certificate.
   * @param {string} options[].accountId - accound identifier associated with
   *   certificate.
   * @param {Object[]} options[].pems - The PEM-encoded certificate data to store.
   * @param {string} options[].pems[].privkey - the private key.
   * @param {string} options[].pems[].cert - the certificate.
   * @param {string} options[].pems[].chain - the certificate chain.
   * @param {Function} callback(err, pems) - called when an error occurs, or
   *   when all the certificate data is successfully written to the database.
   */
  function redisSetCertificate(options, callback) {
    _debug('le-store-redis.redisSetCertificate',
      '\npems:', options.pems);
    var certId = 'cert-' + crypto.createHash('sha256')
      .update(options.pems.cert).digest('hex');
    var cert = _.cloneDeep(options.pems);

    var jsonCert = JSON.stringify(cert);

    async.parallel([
      function(callback) {
        // write the cert to the database
        client.set(certId, jsonCert, callback);
        return client.expire(certId, moduleOptions.certExpiry);
      },
      function(callback) {
        if(options.accountId) {
          // create an accountId to cert index
          return _createIndex('idx-a2c', options.accountId, certId,
            moduleOptions.certExpiry, callback);
        }
        callback();
      },
      function(callback) {
        if(options.email) {
          // create an email to cert index
          return _createIndex('idx-e2c', options.email, certId,
            moduleOptions.certExpiry, callback);
        }
        callback();
      },
      function(callback) {
        if(options.domains) {
          // create a domain to cert index
          return async.each(options.domains, function(domain, callback) {
            _createIndex('idx-d2c', domain, certId,
              moduleOptions.certExpiry, callback);
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

  // utility function to create a Redis-based index to a particular value
  function _createIndex(indexName, indexData, value, ex, cb) {
    var callback = cb;
    var expiry = ex;
    if(!callback) {
      expiry = null;
      callback = ex;
    }

    // generate the index value
    var index = indexName + '-' +
      crypto.createHash('sha256').update(indexData).digest('hex');

    client.set(index, value, function(err, reply) {
      if(err) {
        return callback(err);
      }
      if(expiry) {
        return client.expire(index, expiry, function(err) {
          callback(err, reply);
        });
      }
      callback(err, reply);
    });
  }

  // utility function to get a Redis-based value based on an index
  function _getByIndex(indexName, indexData, callback) {
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
      client.get(reply, _deserializeJson(callback));
    });
  }

  // utility function to deserialize data from JSON
  function _deserializeJson(callback) {
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

  // utility debug function
  function _debug(callback) {
    if(options.debug) {
      console.log.apply(null, arguments);
    }
  }

  // return an object that follows the le-store-SPEC interface
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
