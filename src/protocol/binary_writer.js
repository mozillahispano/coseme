
CoSeMe.namespace('protocol', (function(){
  'use strict';

  var k = CoSeMe.protocol.dictionary; // protocol constants
  var token2Code = k.token2Code;
  var ByteArray = CoSeMe.utils.ByteArrayWA;
  var logger = new CoSeMe.common.Logger('BinaryWriter');

  var IS_COUNTING = true;
  var IS_RAW = true;

  /**
   * The binary writer sends via TCPSocket the required data avoiding
   * unnecessary copies. To accomplish this purpose, as the size is not known
   * before codifying the tree, the algorithm preprocess the tree by calculating
   * the necessary space only, then repeat the processing to effectively write
   * the data.
   */
  function BinaryWriter(connection) {
    this._socket = connection.socket; // an opened socket in binary mode
    this.outputKey = undefined;
  }

  var STREAM_START = k.STREAM_START;

  /**
   * Sends the start of the protocol.
   */
  BinaryWriter.prototype.streamStart = function(domain, resource, callback) {
    var writerTask = this.newWriteTask(callback);
    writerTask._sendProtocol(IS_COUNTING);
    writerTask._sendProtocol();

    writerTask._streamStart(domain, resource, IS_COUNTING);
    writerTask._streamStart(domain, resource);
  };

  BinaryWriter.prototype._sendProtocol = function(counting) {
    var dictionaryVersion = 5; // my guess: the dictionary version

    this.resetBuffer(counting, IS_RAW);
    this.writeASCII('WA', counting);
    this.writeByte(STREAM_START, counting);
    this.writeByte(dictionaryVersion, counting);
    this.flushBuffer(counting);
  }

  BinaryWriter.prototype._streamStart = function(domain, resource, counting) {
    var attributes = {to: domain, resource: resource};

    this.resetBuffer(counting);
    this.writeListStart(1 + 2 * CoSeMe.utils.len(attributes), counting);
    this.writeInt8(1, counting);
    this.writeAttributes(attributes, undefined, counting);
    this.sendMessage(counting);
  }

  /**
   * Spawn a new BinaryWriter in charge of sending the tree via socket.
   */
  BinaryWriter.prototype.write = function(tree, callback) {
    var writerTask = this.newWriteTask(callback);
    writerTask._write(tree, IS_COUNTING);
    writerTask._write(tree);
  };

  /*
   * Creates a new BinaryWriter object proxying the current one. This new
   * object can not spawn new write tasks.
   */

  BinaryWriter.prototype.newWriteTask = function(callback) {
    var task = Object.create(this);
    task.newWriteTask = undefined;
    task._callback = callback;
    task._socket = this._socket; // Copy the current socket to the task to
                                 // ensure this task put its data on the current
                                 // socket and not in a future one (i.e a new
                                 // one as a result of a reconnection).
    return task;
  };

  BinaryWriter.prototype._write = function(tree, counting) {
    this.resetBuffer(counting);
    if (!tree) {
      this.writeInt8(0, counting);
    }
    else {
      this.writeTree(tree, counting);
      !counting && logger.log(tree.toString());
    }
    this.sendMessage(counting);
  }

  /**
   * Encode the tree in binary format and put it in the output buffer.
   */
  BinaryWriter.prototype.writeTree = function(tree, counting) {
    var length = 1 + (2 * CoSeMe.utils.len(tree.attributes));
    if (tree.children.length > 0) length++;
    if (tree.data !== null) length++;

    // Tree header and tag
    this.writeListStart(length, counting);
    this.writeString(tree.tag, counting);

    // Attributes
    this.writeAttributes(tree.attributes, tree, counting);

    // Data
    if (tree.data) {
      this.writeBytes(tree.data, counting);
    }

    // Children
    var childrenCount = tree.children.length;
    if (childrenCount !== 0) {
      this.writeListStart(childrenCount, counting);
      for (var i = 0; i < childrenCount; i++) {
        this.writeTree(tree.children[i], counting);
      }
    }
  };

  var SHORT_LIST_MARK = k.SHORT_LIST_MARK;
  var LONG_LIST_MARK  = k.LONG_LIST_MARK;
  var EMPTY_LIST_MARK = k.EMPTY_LIST_MARK;

  /**
   * Writes an attributes header in the output buffer.
   */
  BinaryWriter.prototype.writeListStart = function(length, counting) {
    if (length === 0) {
      counting ? this.messageLength++ : this.message.write(EMPTY_LIST_MARK);
    }
    else if (length < 256) {
      counting ? this.messageLength++ : this.message.write(SHORT_LIST_MARK);
      this.writeInt8(length, counting);
    }
    else {
      counting ? this.messageLength++ : this.message.write(LONG_LIST_MARK);
      this.writeInt16(length, counting);
    }
    return this;
  };

  /**
   * Writes an attribute object in the output buffer.
   */
  BinaryWriter.prototype.writeAttributes = function(attrs, tree, counting) {
    var attributes = attrs || {};
    var value;
    for (var attrName in attributes) if (attributes.hasOwnProperty(attrName)) {
      value = tree ? tree.getAttributeValue(attrName) : attributes[attrName];
      this.writeString(attrName, counting);
      this.writeString(value, counting);
    }
    return this;
  };

  /**
   * Wrapper to encode both tokens and JID (Jabber ID).
   */
  BinaryWriter.prototype.writeString = function(string, counting) {
    if (typeof string !== 'string') {
      logger.warn('Expecting a string!', typeof string, 'given instead.');
      if (string === null || string === undefined) {
        string = '';
      } else {
        string = string.toString();
      }
    }

    var result = token2Code(string);
    if (result.code !== null) {
      if (result.submap !== null) {
        this.writeToken(result.submap, counting);
      }
      this.writeToken(result.code, counting);
    } else {
      if (string.indexOf('@') < 1) {
        this.writeBytes(string, counting);
      }
      else {
        var userAndServer = string.split('@');
        var user = userAndServer[0];
        var server = userAndServer[1];
        this.writeJid(user, server, counting);
      }
    }
    return this;
  };

  var SURROGATE_MARK = k.SURROGATE_MARK;

  /**
   * Writes a string token in an efficent encoding derived from a dictionary.
   */
  BinaryWriter.prototype.writeToken = function(code, counting) {
    if (code < 245) {
      counting ? this.messageLength++ : this.message.write(code);
    }
    else if (code <= 500) {
      counting ? this.messageLength++ : this.message.write(SURROGATE_MARK);
      counting ? this.messageLength++ : this.message.write(code - 245);
    }
    return this;
  };

  var SHORT_STRING_MARK = k.SHORT_STRING_MARK;
  var LONG_STRING_MARK  = k.LONG_STRING_MARK;

  /**
   * Writes bytes from a JavaScript (latin1) string, an ArrayBuffer or any
   * type with a buffer property of type ArrayBuffer like ArrayBufferView
   * instances.
   */
  BinaryWriter.prototype.writeBytes = function(data, counting) {
    var bytes;
    if (typeof data === 'string') {
      bytes = CoSeMe.utils.bytesFromLatin1(data);

    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);

    } else if (data && data.buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(data.buffer);

    } else {
      var fallback = data === null || data === undefined ? '' : data.toString();
      logger.error('Expecting string, ArrayBuffer or ArrayBufferView-like' +
                    'object. A', data.constructor.name, 'received instead.');
      bytes = CoSeMe.utils.bytesFromLatin1(fallback);
    }

    var l = bytes.length;

    if (l < 256) {
      counting ? this.messageLength++ : this.message.write(SHORT_STRING_MARK);
      this.writeInt8(l, counting);
    }
    else {
      counting ? this.messageLength++ : this.message.write(LONG_STRING_MARK);
      this.writeInt24(l, counting);
    }

    for (var i = 0; i < l; i++) {
      counting ? this.messageLength++ : this.message.write(bytes[i]);
    }
    return this;
  };

  var JID_MARK = k.JID_MARK;

  /**
   * Writes the JID in the output buffer.
   */
  BinaryWriter.prototype.writeJid = function(user, server, counting) {
    counting ? this.messageLength++ : this.message.write(JID_MARK);
    if (user) {
      this.writeString(user, counting);
    } else {
      this.writeToken(0, counting);
    }
    this.writeString(server, counting);
    return this;
  };

  /**
   * Writes the ASCII values for each character of the given input.
   */
  BinaryWriter.prototype.writeASCII = function(input, counting) {
    var character;
    for (var i = 0, l = input.length; i < l; i++) {
      character = input.charCodeAt(i);
      this.writeByte(character, counting);
    }
    return this;
  };

  /**
   * An alias for writeInt8.
   */
  BinaryWriter.prototype.writeByte = function(i, counting) {
    this.writeInt8(i, counting)
    return this;
  };

  /**
   * Writes a 8-bit integer into the output buffer.
   */
  BinaryWriter.prototype.writeInt8 = function(i, counting) {
    counting ? this.messageLength++ : this.message.write(i & 0xFF);
    return this;
  };

  /**
   * Writes a 16-bit integer into the output buffer.
   */
  BinaryWriter.prototype.writeInt16 = function(i, counting) {
    counting ? this.messageLength++ : this.message.write((i & 0xFF00) >>> 8);
    counting ? this.messageLength++ : this.message.write((i & 0x00FF));
    return this;
  };

  /**
   * Writes a 24-bit integer into the output buffer.
   */
  BinaryWriter.prototype.writeInt24 = function(i, counting) {
    counting ? this.messageLength++ : this.message.write((i & 0xFF0000) >>> 16);
    counting ? this.messageLength++ : this.message.write((i & 0x00FF00) >>>  8);
    counting ? this.messageLength++ : this.message.write((i & 0x0000FF));
    return this;
  };

  /**
   * Sends the message in the output buffer.
   */
  BinaryWriter.prototype.sendMessage = function(counting) {
    if (counting) { return; }

    if (this.isEncrypted()) {
      this.cipherMessage();
    }
    this.addMessageHeader();
    this.flushBuffer(counting);
  };

  /**
   * Consumes all the data in the output buffer sending them via the socket.
   */
  BinaryWriter.prototype.flushBuffer = function(counting) {
    if (counting) { return; }

    try {
      // This includes the header and trailing paddings.
      var out, offset, realOutLength;

      if (this.isRaw) {
        out = this.message.finish().buffer;
        offset = 0;
        realOutLength = this.messageLength;
      }
      else {
        var completeView = new Uint32Array(this.outBuffer);
        var completeViewLength = completeView.buffer.byteLength;
        out = new ByteArray(completeView, completeViewLength).finish().buffer;

        offset = HEADER_PADDING;
        realOutLength = HEADER_LENGTH + this.messageLength;
      }

      var error = null, socketState = this._socket.readyState;
      if (socketState === 'open') {
        // With these offset and length we omit the header and trailing
        // paddings.
        this._socket.send(out.buffer, offset, realOutLength);
      } else {
        logger.warn('Can not write. Socket state:', socketState);
        error = 'socket-non-ready';
      }
      (typeof this._callback === 'function') && this._callback(error);
    } catch (x) {
      var socketState = this._socket.readyState;
      if (typeof this._callback === 'function') {
        this._callback(socketState === 'closed' ? 'disconnected' : x);
      }
    }
  };

  var HEADER_LENGTH = k.HEADER_LENGTH;
  var HEADER_PADDING = 4 - (HEADER_LENGTH % 4);
  var COMPLETE_HEADER_LENGTH = HEADER_LENGTH + HEADER_PADDING;

  var MAC_LENGTH = k.MAC_LENGTH;

  /**
   * If not counting, allocate an outgoing buffer for the message.
   * If only counting, reset the outgoing length to 0.
   *
   * If isRaw parameter is set to true, no header, mac nor cyphering size
   * considerations will be taken into account. Now is used to send the
   * `streamStart`.
   */
  BinaryWriter.prototype.resetBuffer = function(counting, isRaw) {
    if (counting) {
      this.messageLength = 0;
    }
    else {
      // If encrypted, it is needed to allocate extra space for the mac.
      this.isRaw = isRaw;

      // No headers, no mac, no cyphering
      if (isRaw) {
        this.message = new ByteArray(this.messageLength);
      }

      // Headers + mac + cyphering
      else {
        var macLength = this.isEncrypted() ? MAC_LENGTH : 0;
        this.messageLength += macLength;
        this.messagePadding = 4 - (this.messageLength % 4);
        this.completeMessageLength = this.messageLength + this.messagePadding;

        var totalSize = COMPLETE_HEADER_LENGTH + this.completeMessageLength;
        this.outBuffer = new Uint8Array(totalSize).buffer;

        var headerView =
          new Uint32Array(this.outBuffer, 0, COMPLETE_HEADER_LENGTH >>> 2);
        var messageView =
          new Uint32Array(this.outBuffer, COMPLETE_HEADER_LENGTH);

        this.header = new ByteArray(headerView);
        this.message = new ByteArray(messageView);
      }
    }
  };

  /**
   * Ciphers the message and signs it. Ciphering occurs IN-PLACE.
   */
  BinaryWriter.prototype.cipherMessage = function() {
    var textAndMac = this.outputKey.encodeMessage(this.message);
    for (var i = 0; i < MAC_LENGTH; i++) {
      this.message.write(textAndMac.hmacSHA1.get(i));
    }
  };

  /**
   * Adds the header of the message and encrypt the output buffer.
   */
  BinaryWriter.prototype.addMessageHeader = function() {
    // Write padding
    for (var i = 0; i < HEADER_PADDING; i++) {
      this.header.write(0);
    }

    var messageLength = this.messageLength;
    var encryptedFlag = this.isEncrypted() ? 0x80 : 0x00;
    var b2 = encryptedFlag | ((messageLength & 0xFF0000) >>> 16);
    var b1 = (messageLength & 0xFF00) >>> 8;
    var b0 = (messageLength & 0x00FF);

    this.header.write(b2);
    this.header.write(b1);
    this.header.write(b0);
  };

  /**
   * Returns true if the RC4 key is set.
   */
  BinaryWriter.prototype.isEncrypted = function() {
    return !!this.outputKey;
  };

  return BinaryWriter;
}()));
