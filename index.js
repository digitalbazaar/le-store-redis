'use strict';

module.exports.create = function (options) {



  var defaults = {};



  var accounts = {

    // Accounts
    setKeypair: function (opts, keypair, cb) {
      // opts.email     // optional
      // opts.accountId // optional - same as returned from acounts.set(opts, reg)


      // SAVE to db (as PEM and/or JWK) and index each domain in domains to this keypair
      // keypair = { privateKeyPem: '...', privateKeyJwk: { ... } }
      cb(null, keypair);
    }
    // Accounts
  , checkKeypair: function (opts, cb) {
      // opts.email // optional
      // opts.accountId // optional - same as returned from acounts.set(opts, reg)


      // check db and return null or keypair object with one
      // (or both) of privateKeyPem or privateKeyJwk
      cb(null, { privateKeyPem: '...', privateKeyJwk: {} });
    }



    // Accounts
  , check: function (opts, cb) {
      // opts.email       // optional
      // opts.accountId   // optional - same as returned from acounts.set(opts, reg)
      // opts.domains     // optional - same as set in certificates.set(opts, certs)

      // return account from db if it exists, otherwise null
      cb(null, { id: '...', keypair: { privateKeyJwk: {} }/*, domains: []*/ });
    }
    // Accounts
  , set: function (opts, reg, cb) {
      // opts.email
      // reg.keypair
      // reg.receipt // response from acme server


      // You must implement a method to deterministically generate 'id'
      // For example, you could do this:
      // var id = crypto.createHash('sha256').update(reg.keypair.publicKeyPem).digest('hex');
      cb(null, { id: '...', email: opts.email, keypair: reg.keypair, receipt: reg.receipt });
    }

  };



  var certificates = {

    // Certificates
    setKeypair: function (opts, keypair, cb) {
      // opts.domains - this is an array, but you nly need the first (or any) of them


      // SAVE to db (as PEM and/or JWK) and index each domain in domains to this keypair
      cb(null, keypair);
    }
    // Certificates
  , checkKeypair: function (opts, cb) {
      // opts.domains - this is an array, but you only need the first (or any) of them


      // check db and return null or keypair object with one of privateKeyPem or privateKeyJwk
      cb(null, { privateKeyPem: '...', privateKeyJwk: {} });
    }



    // Certificates
  , check: function (opts, cb) {
      // You will be provided one of these (which should be tried in this order)
      // opts.domains
      // opts.email // optional
      // opts.accountId // optional


      // return certificate PEMs from db if they exist, otherwise null
      // optionally include expiresAt and issuedAt, if they are known exactly
      // (otherwise they will be read from the cert itself later)
      cb(null, { privkey: 'PEM', cert: 'PEM', chain: 'PEM', domains: [], accountId: '...' });
    }
    // Certificates
  , set: function (opts, pems, cb) {
      // opts.domains   // each of these must be indexed
      // opts.email     // optional, should be indexed
      // opts.accountId // optional - same as set by you in accounts.set(opts, keypair) above

      // pems.privkey
      // pems.cert
      // pems.chain


      // SAVE to the database, index the email address, the accountId, and alias the domains
      cb(null, pems);
    }

  };



  return {
    getOptions: function () {
      // merge options with default settings and then return them
      return options;
    }
  , accounts: accounts
  , certificates: certificates
  };



};
