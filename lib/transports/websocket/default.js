
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module requirements.
 */

var Transport = require('../../transport')
  , EventEmitter = process.EventEmitter
  , crypto = require('crypto')
  , parser = require('../../parser')
  , util06 = require('../../util-06');

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

  console.log('going default!');

  // parser
  var self = this;
  this.heartbeats = 0;

  this.parser = new Parser();
  this.parser.on('data', function (packet) {
    console.log('default parser on data');

    self.log.debug(self.name + ' received data packet', packet);
    console.log('decoded: '+util06.decode(packet));

    //self.onMessage(parser.decodePacket(packet));
    self.onMessage(packet);
  });
  this.parser.on('close', function () {
    console.log('default parser on close');
    self.end();
  });
  this.parser.on('error', function () {
    console.log('default parser on error');
    self.end();
  });

  Transport.call(this, mng, data, req);
};

/**
 * Inherits from Transport.
 */

WebSocket.prototype.__proto__ = Transport.prototype;

/**
 * Transport name
 *
 * @api public
 */

WebSocket.prototype.name = 'websocket';

/**
 * Websocket draft version
 *
 * @api public
 */

WebSocket.prototype.protocolVersion = 'hixie-76';

/**
 * Called when the socket connects.
 *
 * @api private
 */

WebSocket.prototype.onSocketConnect = function () {
  var self = this;

  this.socket.setNoDelay(true);

  this.buffer = true;
  this.buffered = [];

  console.log('upgrade: '+this.req.headers.upgrade);

  console.log('req.headers');
  console.log(this.req.headers);

  if (this.req.headers.upgrade !== 'WebSocket') {
    this.log.warn(this.name + ' connection invalid');
    this.end();
    return;
  }

  var origin = this.req.headers.origin
    , location = (this.socket.encrypted ? 'wss' : 'ws')
               + '://' + this.req.headers.host + this.req.url
    , waitingForNonce = false;

  if (this.req.headers['sec-websocket-key1']) {
    // If we don't have the nonce yet, wait for it (HAProxy compatibility).
    console.log('req.head');
    console.log(this.req.head);
    console.log(this.req.head.length);
    if (! (this.req.head && this.req.head.length >= 8)) {
      waitingForNonce = true;
    }

    var headers = [
        'HTTP/1.1 101 WebSocket Protocol Handshake'
      , 'Upgrade: WebSocket'
      , 'Connection: Upgrade'
      , 'Sec-WebSocket-Origin: ' + origin
      , 'Sec-WebSocket-Location: ' + location
    ];

    if (this.req.headers['sec-websocket-protocol']){
      headers.push('Sec-WebSocket-Protocol: '
          + this.req.headers['sec-websocket-protocol']);
    }
  } else {
    var headers = [
        'HTTP/1.1 101 Web Socket Protocol Handshake'
      , 'Upgrade: WebSocket'
      , 'Connection: Upgrade'
      , 'WebSocket-Origin: ' + origin
      , 'WebSocket-Location: ' + location
    ];
  }

  try {
    this.socket.write(headers.concat('', '').join('\r\n'));
    this.socket.setTimeout(0);
    this.socket.setNoDelay(true);
    this.socket.setEncoding('utf8');
  } catch (e) {
    console.log('omfg!');
    this.end();
    return;
  }

  console.log('witing thing: '+waitingForNonce);

  if (waitingForNonce) {
    console.log('waiting right?');
    this.socket.setEncoding('binary');
  } else if (this.proveReception(headers)) {

    //var fuckyea = [this.id];
    //var encoded = util06.encode(fuckyea);
    console.log('sending this: '+util06.encode([this.id]));
    this.write(util06.encode([this.id]));

    self.flush();
  }

  var headBuffer = '';

  this.socket.on('data', function (data) {
    console.log('oh yea socket.on');

    if (waitingForNonce) {
      headBuffer += data;

      if (headBuffer.length < 8) {
        return;
      }

      // Restore the connection to utf8 encoding after receiving the nonce
      self.socket.setEncoding('utf8');
      waitingForNonce = false;

      // Stuff the nonce into the location where it's expected to be
      self.req.head = headBuffer.substr(0, 8);
      headBuffer = '';

      if (self.proveReception(headers)) {
        self.flush();
      }

      return;
    }

    self.parser.add(data);
  });
};

/**
 * Writes to the socket.
 *
 * @api private
 */

WebSocket.prototype.write = function (data) {
  if (this.open) {
    console.log('really?: '+data);
    var packet = parser.decodePacket(data);
    console.log('websocket.write');
    console.log(packet);

    if (packet.type === undefined) {
      console.log('direct write, going through: '+data);
    } else {
      switch (packet.type) {
        case 'heartbeat':
          data = '~h~' + ++this.heartbeats;
          break;
        case 'message':
          data = packet.data;
          break;
        case 'json':
          console.log('json message!');
          data = packet.data;
          break;
        default:
          console.log('non-supported packet');
          console.log(packet);
          return;
      }
      data = util06.encode(data);
    }
    console.log('sending this yo!');
    console.log(data);


    this.drained = false;

    if (this.buffer) {
      this.buffered.push(data);
      return this;
    }

    var length = Buffer.byteLength(data)
      , buffer = new Buffer(2 + length);

    buffer.write('\x00', 'binary');
    buffer.write(data, 1, 'utf8');
    buffer.write('\xff', 1 + length, 'binary');

    try {
      if (this.socket.write(buffer)) {
        this.drained = true;
      }
    } catch (e) {
      this.end();
    }

    this.log.debug(this.name + ' writing', data);
  }
};

/**
 * Flushes the internal buffer
 *
 * @api private
 */

WebSocket.prototype.flush = function () {
  this.buffer = false;

  for (var i = 0, l = this.buffered.length; i < l; i++) {
    this.write(this.buffered.splice(0, 1)[0]);
  }
};

/**
 * Finishes the handshake.
 *
 * @api private
 */

WebSocket.prototype.proveReception = function (headers) {
  var self = this
    , k1 = this.req.headers['sec-websocket-key1']
    , k2 = this.req.headers['sec-websocket-key2'];

  console.log(this.req.headers);
  console.log('============= prove it!');

  if (k1 && k2){
    var md5 = crypto.createHash('md5');

    [k1, k2].forEach(function (k) {
      var n = parseInt(k.replace(/[^\d]/g, ''))
        , spaces = k.replace(/[^ ]/g, '').length;

      if (spaces === 0 || n % spaces !== 0){
        self.log.warn('Invalid ' + self.name + ' key: "' + k + '".');
        self.end();
        return false;
      }

      n /= spaces;

      md5.update(String.fromCharCode(
        n >> 24 & 0xFF,
        n >> 16 & 0xFF,
        n >> 8  & 0xFF,
        n       & 0xFF));
    });

    md5.update(this.req.head.toString('binary'));

    try {
      this.socket.write(md5.digest('binary'), 'binary');
      console.log('======================= tested reception');
    } catch (e) {
      console.log('oh waha?');
      this.end();
    }
  }

  return true;
};

/**
 * Writes a payload.
 *
 * @api private
 */

WebSocket.prototype.payload = function (msgs) {
  for (var i = 0, l = msgs.length; i < l; i++) {
    this.write(msgs[i]);
  }

  return this;
};

/**
 * Closes the connection.
 *
 * @api private
 */

WebSocket.prototype.doClose = function () {
  this.socket.end();
};

WebSocket.prototype.onMessage = function (data) {
  var messages = util06.decode(data);
  if (messages === false) return// this.log.debug('Bad message received from client ' + this.sessionId);

  var current = this.manager.transports[this.id];

  for (var i = 0, l = messages.length, frame; i < l; i++){
    frame = messages[i].substr(0, 3);
    switch (frame){
      case '~h~':
        //return this._onHeartbeat(messages[i].substr(3));
        this.log.debug('got heartbeat packet');

        if (current && current.open) {
          current.onHeartbeatClear();
        } else {
          this.store.publish('heartbeat-clear:' + this.id);
        }
        return;
      case '~j~':
        try {
          messages[i] = JSON.parse(messages[i].substr(3));
        } catch(e) {
          messages[i] = {};
        }
        break;
    }
    console.log('message['+i+']: '+messages[i]);
    /*
    this.emit('message', messages[i]);
    this.listener._onClientMessage(messages[i], this);
    */
    var packet = {type: 'message', endpoint: '', data: messages[i]};
    if (current) {
      console.log('this way?');
      console.log(this.id);
      //{ type: 'message', endpoint: '', data: 'hello' }
      this.manager.onClientMessage(this.id, packet);
    } else {
      console.log('or thas way?');
      this.store.publish('message:' + this.id, packet);
    }
  }
};

WebSocket.prototype.setHeartbeatTimeout = function () {
  console.log('websocket.setheartbeartimeout!!!!!!!!!!!!!!!!!!!!!!!');

  if (!this.heartbeatTimeout && this.manager.enabled('heartbeats')) {
    var self = this;

    this.heartbeatTimeout = setTimeout(function () {
      self.log.debug('fired heartbeat timeout for client', self.id);
      self.heartbeatTimeout = null;
      self.end('heartbeat timeout');
    }, 8 * 1000);

    this.log.debug('set heartbeat timeout for client', this.id);
  }
};

WebSocket.prototype.setHeartbeatInterval = function () {
  console.log('timeout interval!!!!!!!!!!!!');

  if (!this.heartbeatInterval && this.manager.enabled('heartbeats')) {
    var self = this;

    this.heartbeatInterval = setTimeout(function () {
      self.heartbeat();
      self.heartbeatInterval = null;
    }, 10 * 1000);

    this.log.debug('set heartbeat interval for client', this.id);
  }
};

/**
 * WebSocket parser
 *
 * @api public
 */

function Parser () {
  this.buffer = '';
  this.i = 0;
};

/**
 * Inherits from EventEmitter.
 */

Parser.prototype.__proto__ = EventEmitter.prototype;

/**
 * Adds data to the buffer.
 *
 * @api public
 */

Parser.prototype.add = function (data) {
  this.buffer += data;
  this.parse();
};

/**
 * Parses the buffer.
 *
 * @api private
 */

Parser.prototype.parse = function () {
  for (var i = this.i, chr, l = this.buffer.length; i < l; i++){
    chr = this.buffer[i];

    if (this.buffer.length == 2 && this.buffer[1] == '\u0000') {
      this.emit('close');
      this.buffer = '';
      this.i = 0;
      return;
    }

    if (i === 0){
      if (chr != '\u0000')
        this.error('Bad framing. Expected null byte as first frame');
      else
        continue;
    }

    if (chr == '\ufffd'){
      this.emit('data', this.buffer.substr(1, i - 1));
      this.buffer = this.buffer.substr(i + 1);
      this.i = 0;
      return this.parse();
    }
  }
};

/**
 * Handles an error
 *
 * @api private
 */

Parser.prototype.error = function (reason) {
  this.buffer = '';
  this.i = 0;
  this.emit('error', reason);
  return this;
};
