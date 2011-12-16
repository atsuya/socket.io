
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var protocolVersions = require('./websocket-06/');

/**
 * Export the constructor.
 */

exports = module.exports = WebSocket06;

/**
 * HTTP interface constructor. Interface compatible with all transports that
 * depend on request-response cycles.
 *
 * @api public
 */

function WebSocket06 (mng, data, req) {
  var transport
    , version = req.headers['sec-websocket-version'];

  /**
   * currently, there is only default one to serve socket.io 06 client
   */
  /*
  if (typeof version !== 'undefined' && typeof protocolVersions[version] !== 'undefined') {
    transport = new protocolVersions[version](mng, data, req);
  }
  else {
    transport = new protocolVersions['default'](mng, data, req);
  }
  */
  transport = new protocolVersions['default'](mng, data, req);

  if (typeof this.name !== 'undefined') transport.name = this.name;
  return transport;
};

