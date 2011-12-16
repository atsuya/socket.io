
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var protocolVersions = require('./websocket/');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket (mng, data, req) {
  var transport
    , version = req.headers['sec-websocket-version'];

  console.log(version);

  if (typeof version !== 'undefined' && typeof protocolVersions[version] !== 'undefined') {
    console.log(version);
    console.log('w1');
    transport = new protocolVersions[version](mng, data, req);
  }
  else {
    console.log('w2');
    transport = new protocolVersions['default'](mng, data, req);
  }
  if (typeof this.name !== 'undefined') transport.name = this.name;
  return transport;
};
