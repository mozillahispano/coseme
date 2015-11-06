CoSeMe.namespace('protocol', (function(){
  'use strict';

  var k = CoSeMe.protocol.dictionary; // protocol constants
  var code2Token = k.code2Token;
  var ByteArray = CoSeMe.utils.ByteArrayWA;
  var Tree = CoSeMe.protocol.Tree;
  var logger = new CoSeMe.common.Logger('BinaryReader');

  /**
   * Deserialize protocol data. Public functions accepts data as array
   * buffers (i.e received from a TCPSocket ondata() event) and return
   * undefined if there is not enough data to parse something.
   */
  function BinaryReader() {
    this.incoming = [];
    this.incomingCount = 0;
    this.incomingOffset = { chunk: 0, byte: 0 };
    this.partialConsumed = 0;

    this.inputKey = null;
  }

  var STREAM_START = k.STREAM_START;

  /**
   * Receives a connection and start to capture data on the connection calling
   * onStreamStart(err) when the start of the stream is received or
   * onTree(err, tree) when receiving a tree.
   */
  BinaryReader.prototype.startListening = function(connection) {
    this.socket = connection.socket;
    this.isStreamStartRead = false;
    this.paused = false;

    var self = this;
    this.socket.ondata = function(evt) {
      var lock = navigator.requestWakeLock('cpu');
      self.onSocketData(evt.data);
      lock.unlock();
    };
  };

  BinaryReader.prototype.pendingTrees = [];

  /**
   * Suspend receiving data and calling onStreamStart and onTree callbacks.
   * Call it before switching from one handler to another.
   */
  BinaryReader.prototype.suspend = function() {
    if (this.paused) return;
    this.socket.suspend(); //TODO: Consider the option of not suspend the socket
    this.paused = true;
  };

  /**
   * Resume receiving data and calling onStreamStart and onTree callbacks.
   * Call it after switching from one handler to another.
   */
  BinaryReader.prototype.resume = function() {
    if (!this.paused) return;
    this.socket.resume();
    this.paused = false;
    this.attendPendingTrees();
  };

  /**
   * Adds the new data to the current chunks and try for parsing a tree.
   */
  BinaryReader.prototype.onSocketData = function(rawData) {
    logger.log('Received socket data:', rawData.byteLength, 'bytes!')
    rawData && this.addDataChunk(rawData);
    this.checkForAnotherTree();
  };

  /**
   * Check if there is enought available data to parse another tree. If so,
   * consumes the message and reprogram itself to continue checking if there
   * are more trees.
   */
  BinaryReader.prototype.checkForAnotherTree = function() {
    while (!this.waitingForMessage()) {
      if (!this.isStreamStartRead) {
        this.readStreamStart();
        this.isStreamStartRead = true;
      } else {
        this.readNextTree();
      }
    }
  }

  /**
   * Enqueue a task to read the start of the stream, then call to
   * onStreamStart() callback.
   */
  BinaryReader.prototype.readStreamStart = function() {
    var readerTask = this.newReaderTask();
    readerTask._readStreamStart();
  };

  /**
   * Enqueue a task to read a tree, then call to onTree() callback.
   */
  BinaryReader.prototype.readNextTree = function() {
    var readerTask = this.newReaderTask();
    readerTask._readNextTree();
  };

  /**
   * Creates a task as a specialization of the main BinaryReader unable to spawn
   * new taskes with the mission of read a given tree.
   */
  BinaryReader.prototype.newReaderTask = function() {
    var task = Object.create(this);

    this.readStanza();
    task.startListening = undefined;
    task.suspend = undefined;
    task.resume = undefined;
    task.newReaderTask = undefined;

    task.mac = this.mac;
    task.message = this.message;
    task.stanzaSize = this.stanzaSize;
    task.isEncrypted = this.isEncrypted;
    task.sourceSocket = this.socket;
    this.finishReading();

    return task;
  };

  /**
   * Parses the start of the protocol. If all goes well, call onStreamStart()
   * with null as error. It can return an Error with 'Expecting STREAM_START'
   * if the start of the stream is not correctly parsed.
   */
  BinaryReader.prototype._readStreamStart = function() {
    var listMark = this.message.read();
    var listSize = this.readListSize(listMark);
    var tree, tag = this.message.read();
    var err = null;
    if (tag === STREAM_START) {
      var attributeCount = (listSize - 2 + listSize % 2) / 2;
      tree = new Tree('start', {
        attributes: this.readAttributes(attributeCount)
      });

    // Bad stanza
    } else {
      err = new Error('Expecting STREAM_START');
      logger.error(err);
    }

    this.dispatchResult(err, tree, 'onStreamStart');
  };

  /**
   * Parses a tree and calls onTree(err, tree) with null as error and the
   * parsed tree if all goes well or with err set to a SyntaxError if not.
   */
  BinaryReader.prototype._readNextTree = function() {
    var err = null, tree;
    try {
      tree = this.readTree();
      logger.log(tree ? tree.toString() : tree + '');

    // Catch malformed tree errors
    } catch (e) {
      err = e;
      tree = undefined;

      logger.error(e);
    }

    this.dispatchResult(err, tree, 'onTree');
  };

  /**
   * Enqueue the task of calling the callback `callbackName` with `err` and
   * `tree` as parameters once the queue is attended.
   */
  BinaryReader.prototype.dispatchResult = function(err, tree, callbackName) {
    this.pendingTrees.push([err, tree, callbackName]);
    if (!this.paused) {
      this.attendPendingTrees();
    }
  };

  /**
   * Attend all pending trees by calling to the proper callback.
   * Tree dispatching occurs in the same order than they were received.
   */
  BinaryReader.prototype.attendPendingTrees = function() {
    var args, err, tree, callbackName, lock;
    var currentSocket = Object.getPrototypeOf(this).socket;
    while (args = this.pendingTrees.shift()) {

      err = args[0];
      tree = args[1];
      callbackName = args[2];
      lock = navigator.requestWakeLock('cpu');

      setTimeout((function _processTree(callbackName, err, tree, lock) {
        if (this.sourceSocket === currentSocket) {
          var method = this[callbackName];
          if (typeof method === 'function') {
            method(err, tree);
          }

        }
        lock.unlock();
      }).bind(this, callbackName, err, tree, lock));
    }
  };

  /**
   * Frees unneeded memory and reset the BinaryReader state.
   */
  BinaryReader.prototype.finishReading = function() {
    this.freeIncoming();

    this.mac = null;
    this.message = null;

    this.isEncrypted = undefined;
    this.stanzaSize = undefined;
  };

  /**
   * Frees already consumed chunks of incoming data and adjust incomin metadata
   * such as the current incoming offset and incoming size.
   */
  BinaryReader.prototype.freeIncoming = function() {
    var currentChunk, releasedBytes = 0;
    var offset = this.incomingOffset;
    var chunkIndex = offset.chunk;

    // Frees complete chunks (all except the last)
    for (var i = 0; i < chunkIndex; i++) {
      currentChunk = this.incoming.shift();
      releasedBytes += currentChunk.length;
    }

    // Frees the partial chunk
    releasedBytes += (offset.byte - this.partialConsumed);
    this.partialConsumed = offset.byte;

    // Fixes incoming metadata
    offset.chunk = 0;
    this.incomingCount -= releasedBytes;
  }

  /**
   * Adds a new chunk of bytes to the incoming buffer.
   */
  BinaryReader.prototype.addDataChunk = function(rawData) {
    var data = new Uint8Array(rawData);
    this.incoming[this.incoming.length] = data;
    this.incomingCount += data.length;
  };

  var HEADER_LENGTH = k.HEADER_LENGTH;

  /**
   * Return true if the reader is waiting for completing the incoming buffer.
   */
  BinaryReader.prototype.waitingForMessage = function() {

    // No stanza size set? Try parsing header.
    if (this.stanzaSize === undefined) {

      // Not enough bytes for the header? Continue waiting.
      if (this.incomingCount < HEADER_LENGTH) {
        return true;
      }

      // Determine stanza size.
      else {
        var b2 = this.readIncoming(); // flags and high order bits of size
        var b1 = this.readIncoming();
        var b0 = this.readIncoming();
        this.stanzaSize = ((b2 & 0x0f) << 16) + (b1 << 8) + b0;
        this.isEncrypted = !!(b2 & 0x80);
      }

    }

    // Waiting if there are not enough bytes to parse yet.
    return this.incomingCount < (HEADER_LENGTH + this.stanzaSize);
  };

  /**
   * Consumes a byte from the incoming chunk list.
   */
  BinaryReader.prototype.readIncoming = function() {
    // Get the byte
    var offset = this.incomingOffset;
    var byteIndex = offset.byte;
    var chunkIndex = offset.chunk;
    var currentChunk = this.incoming[chunkIndex];
    var byte = currentChunk[byteIndex];

    // Advance offset
    byteIndex++;
    if (byteIndex === currentChunk.length) {

      // Before changing to the next chunk. Check if there is partially
      // consumed data here. If so, adjust the chunk so freeIncoming()
      // behaves properly.
      if (this.partialConsumed) {
        this.incoming[chunkIndex] =
          new Uint8Array(
            this.incoming[chunkIndex].buffer, this.partialConsumed);
      }

      chunkIndex++;
      byteIndex = 0;
      this.partialConsumed = 0;
    }
    offset.byte = byteIndex;
    offset.chunk = chunkIndex;

    return byte;
  };

  /**
   * Reads the XML stanza (the message) from the incoming buffer and
   * fills the message buffer and the mac with the decrypted version.
   */
  BinaryReader.prototype.readStanza = function() {
    this.fillMessageBuffer();

    var isEncrypted = this.isEncrypted;
    if (isEncrypted && !this.inputKey)
      throw new Error('The messages are ciphered but there is no key to ' +
                      'decipher.');

    if (isEncrypted)
      this.decipherMessage();
  };

  var MAC_LENGTH = k.MAC_LENGTH;

  /**
   * Fills the message buffer from the incoming buffer.
   */
  BinaryReader.prototype.fillMessageBuffer = function() {

    var messageLength = this.stanzaSize;

    if (this.isEncrypted) {
      messageLength -= MAC_LENGTH;
    }

    this.message = new ByteArray(messageLength);
    for (var i = 0; i < messageLength; i++) {
      this.message.write(this.readIncoming());
    }

    if (this.isEncrypted) {
      this.mac = new ByteArray(MAC_LENGTH);
      for (var i = 0; i < MAC_LENGTH; i++) {
        this.mac.write(this.readIncoming());
      }
    }

  };

  /**
   * Decipher the message IN-PLCE replacing ciphered text by the
   * deciphered version.
   */
  BinaryReader.prototype.decipherMessage = function() {
    this.message = this.inputKey.decodeMessage(this.message, this.mac);
  };

  /**
   * Parses the tree from the message buffer.
   */
  BinaryReader.prototype.readTree = function() {

    // Read tree structure.
    var listMark = this.message.read();
    var listSize = this.readListSize(listMark);

    var stringMark = this.message.read();
    if (stringMark === 2) {
      return null;
    }

    // Read tag.
    var tag = this.readString(stringMark);
    if (listSize === 0 || tag === null)
      throw new SyntaxError('0 list or null tag!');

    // Read attributes.
    var attributeCount = (listSize - 2 + (listSize % 2)) / 2;
    var attributes = this.readAttributes(attributeCount);

    // No data nor children.
    if (listSize % 2 === 1) {
      return new Tree(tag, { attributes: attributes });
    }

    // Attributes and children but no data.
    var listMarkCandidate = this.message.read();
    if (this.isListMark(listMarkCandidate)) {
      return new Tree(tag, {
        attributes: attributes,
        children: this.readList(listMarkCandidate)
      });
    }

    // Attributes and data but no children.
    stringMark = listMarkCandidate;
    return new Tree(tag, {
      attributes: attributes,
      data: this.readString(stringMark)
    });
  };

  /**
   * Reads a list of child trees from the message buffer.
   */
  BinaryReader.prototype.readList = function(listMark) {
    var listSize = this.readListSize(listMark);
    var children = [];
    for (var i = 0; i < listSize; i++) {
      children.push(this.readTree());
    }
    return children;
  };

  /**
   * Returns true if the byte is one of the list marks.
   */
  BinaryReader.prototype.isListMark = function(b) {
    return (b == SHORT_LIST_MARK) ||
           (b == LONG_LIST_MARK) ||
           (b == EMPTY_LIST_MARK);
  };

  /**
   * Reads a 8-bit integer from the message buffer.
   */
  BinaryReader.prototype.readInt8 = function() {
    return this.message.read();
  };

  /**
   * Reads a 16-bit integer from the message buffer.
   */
  BinaryReader.prototype.readInt16 = function() {
    var b1 = this.message.read();
    var b0 = this.message.read();
    return b1 !== undefined && b0 !== undefined ?
           (b1 << 8) + b0 :
           undefined;
  };

  /**
   * Reads a 24-bit integer from the message buffer.
   */
  BinaryReader.prototype.readInt24 = function() {
    var b2 = this.message.read();
    var b1 = this.message.read();
    var b0 = this.message.read();
    return b2 !== undefined && b1 !== undefined && b0 !== undefined ?
           (b2 << 16) + (b1 << 8) + b0 :
           undefined;
  };

  /* TODO: Explain and remove unused variables. There are some errors as well. */
  BinaryReader.prototype.readNibble = function() {
    var nibbles = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '.' ];
    var b = this.message.read();
    var ignoreLastNibble = (b & 0x80) != 0;
    var size = (b & 0x7f);
    var nrOfNibbles = size * 2 - ignoreLastNibble;
    var buffer = new Uint8Array(size)
    this.fillArray(buffer, size);
    var charArray = [];
    var c;
    for (var i = 0, l = buffer.length; i < l; i++) {
      b = buffer[i];
      var dec = Number(buffer[i]) >> 4;
      if (dec <= 11) {
        charArray.push(nibbles[dec]);
      } else {
        throw new SyntaxError('Bad nibble ' + dec);
      }

      if (i != l - 1 || !ignoreLastNibble) {
        var dec = Number(buffer[i]) & 0xf;
        if (dec <= 11) {
          charArray.push(nibbles[dec]);
        } else {
          throw new SyntaxError('Bad nibble ' + dec);
        }
      }
    }

    return charArray.join('');
  };

  var SHORT_LIST_MARK = k.SHORT_LIST_MARK;
  var LONG_LIST_MARK  = k.LONG_LIST_MARK;
  var EMPTY_LIST_MARK = k.EMPTY_LIST_MARK;

  /**
   * Parses the size of a list from the message buffer;
   */
  BinaryReader.prototype.readListSize = function(sizeMark) {
    var size;
    switch(sizeMark) {
      case EMPTY_LIST_MARK:
        size = 0;
        break;

      case SHORT_LIST_MARK:
        size = this.readInt8();
        break;

      case LONG_LIST_MARK:
        size = this.readInt16();
        break;

      default:
        var error = 'Invalid list size: sizeMark = ' + sizeMark;
        throw new SyntaxError(error);
        break;
    }

    return size;
  };

  /**
   * Parses a set of tree attributes from the message buffer.
   */
  BinaryReader.prototype.readAttributes = function(attributeCount) {
    var key, value, attributes = {};
    while (attributeCount > 0) {
      key = this.readString(this.message.read());
      value = this.readString(this.message.read());
      attributes[key] = value;
      attributeCount--;
    }
    return attributes;
  };

  var SHORT_STRING_MARK = k.SHORT_STRING_MARK;
  var LONG_STRING_MARK  = k.LONG_STRING_MARK;

  var SURROGATE_MARK = k.SURROGATE_MARK;

  var JID_MARK = k.JID_MARK;
  var NIBBLE_MARK = k.NIBBLE_MARK;

  /**
   * Parses a string from the message buffer.
   */
  BinaryReader.prototype.readString = function(stringMark, returnRaw) {
    var string = null;

    if (stringMark === 0) {
      string = '';

    // The string is efficently encoded as a token.
    } else if (stringMark > 2 && stringMark < 245) {
      var code = stringMark;
      string = this.getToken(code);

    // Still a token but with a surrogate mark.
    } else if (stringMark === SURROGATE_MARK) {
      var code = this.message.read();
      string = this.getToken(code + 245);

    // Short 8-bit length string.
    } else if (stringMark === SHORT_STRING_MARK) {
      var size = this.readInt8();
      var buffer = new Uint8Array(size)
      this.fillArray(buffer, size);
      string = { hexdata: this.bufferToString(buffer) };

    // Long 24-bit length string.
    } else if (stringMark === LONG_STRING_MARK) {
      var size = this.readInt24();
      var buffer = new Uint8Array(size)
      this.fillArray(buffer, size);
      string = { hexdata: this.bufferToString(buffer) };

    // Jabber ID.
    } else if (stringMark === JID_MARK) {
      var user = this.readString(this.message.read(), true);
      var server = this.readString(this.message.read(), true);
      if (user && server) {
        string = user + '@' + server;
      }
      else if (server) {
        string = server;
      }
      else {
        throw new SyntaxError('could not reconstruct JID.');
      }

    // Nibble
    } else if (stringMark === NIBBLE_MARK) {
      string = this.readNibble();

    } else {
      throw new SyntaxError('could not find a string.');
    }

    if (returnRaw && string && string.hexdata) {
      string = CryptoJS.enc.Latin1.stringify(CryptoJS.enc.Hex.parse(string.hexdata));
    }

    return string;
  };

  /**
   * Get the string representation for the given token code.
   */
  BinaryReader.prototype.getToken = function(code) {
    var result = code2Token(code);
    if (result.token === null) {
      code = this.readInt8();
      result = code2Token(code, result.submap);
    }
    return result.token;
  };

  /**
   * Fills the buffer with length bytes from the message buffer.
   */
  BinaryReader.prototype.fillArray = function(buffer, length) {
    for (var i = 0; i < length; i++) {
      buffer[i] = this.message.read();
    }
  };

  /**
   * Converts a byte buffer to a string. Returns it in Hex form
   */
  BinaryReader.prototype.bufferToString = function(buffer) {
    var charArray = [];
    var c;
/*    for (var i = 0, l = buffer.length; i < l; i++) {
      charArray.push(String.fromCharCode(buffer[i]));
    }
*/
    for (var i = 0, l = buffer.length; i < l; i++) {
      c = Number(buffer[i]).toString(16);
      if (buffer[i] < 16)
        c = '0' + c;
      charArray.push(c);
    }

    return charArray.join('');
  };

  return BinaryReader;
}()));
