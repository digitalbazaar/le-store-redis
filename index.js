/*
 * Redis storage strategy for node-letsencrypt.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var crypto = require('crypto');
var redis = require('redis');

module.exports.create = function(options) {
  var defaults = {
    redisOptions: options.redisOptions || {}
  };

  var client = redis.createClient(defaults.redisOptions);

  function redisSetAccountKeypair(options, keypair, callback) {
    // options.email     // optional
    // options.accountId // optional - same as returned from acounts.set(options, reg)

    // SAVE to db (as PEM and/or JWK) and index each domain in domains to this keypair
    // keypair = { privateKeyPem: '...', privateKeyJwk: { ... } }
    callback(null, keypair);
  }

  function redisCheckAccountKeypair(options, callback) {
    // options.email // optional
    // options.accountId // optional - same as returned from acounts.set(options, reg)


    // check db and return null or keypair object with one
    // (or both) of privateKeyPem or privateKeyJwk
    callback(null, { privateKeyPem: '...', privateKeyJwk: {} });
  }

  function redisCheckAccount(options, callback) {
    // options.email       // optional
    // options.accountId   // optional - same as returned from acounts.set(options, reg)
    // options.domains     // optional - same as set in certificates.set(options, certs)

    // return account from db if it exists, otherwise null
    callback(null, { id: '...', keypair: { privateKeyJwk: {} }/*, domains: []*/ });
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
    var accountId = crypto.createHash('sha256').update(reg.keypair.publicKeyPem)
      .digest('hex');
    var account = {
      id: accountId,
      email: options.email,
      keypair: reg.keypair,
      receipt: reg.receipt
    };

    client.hset(accountId, 'account', account, redis.print);

    callback(null, account);
  }

  function getRedisOptions() {
    // merge options with default settings and then return them
    return options;
  }

  function redisSetCertificateKeypair(options, keypair, callback) {
    // options.domains - this is an array, but you nly need the first (or any) of them

    // SAVE to db (as PEM and/or JWK) and index each domain in domains to this keypair
    callback(null, keypair);
  }
  function redisCheckCertificateKeypair(options, callback) {
    // options.domains - this is an array, but you only need the first (or any) of them


    // check db and return null or keypair object with one of privateKeyPem or privateKeyJwk
    callback(null, { privateKeyPem: '...', privateKeyJwk: {} });
  }

  function redisCheckCertificate(options, callback) {
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
