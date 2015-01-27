CoSeMe.namespace('utils', (function(){
  'use strict';

  var logger = new CoSeMe.common.Logger('utils');

  /**
   * ByteBuffer supported by a duck type of CryptoJS.lib.wordArray in order
   * to reduce copies. The wordArray is supported byte an Uint32Array in order
   * to be compatible with the TCPSocket and reduce copies even more.
   *
   * Constructor accepts two forms:
   *  - ByteArrayWA(sizeInBytes):
   *      build a new ByteArrayWA of sizeInBytes bytes.
   *
   *  - ByteArrayWA(Uint32Array, initialSizeInBytes):
   *      build a new ByteArrayWA supported by the Uint32Array setting the
   *      initial size to initialSizeInBytes.
   *
   */
  function ByteArrayWA(sizeOrUint32, initialSizeInBytes) {
    var WordArray = CryptoJS.lib.WordArray;

    // Called as new ByteArrayWA(sizeInBytes)
    if (typeof sizeOrUint32 === 'number') {
      var sizeInBytes, sizeInWords;
      // This additional word is to "store" the sequence number and compute
      // the HMAC but the information is never sent.
      sizeInBytes = sizeOrUint32 + 4;
      sizeInWords = (sizeInBytes >>> 2) + (sizeInBytes & 0x3 ? 1 : 0);

      this.initialByte = 0;
      this.size = sizeInBytes;
      this.array = new WordArray.init(new Uint32Array(sizeInWords), 0);

    // Called as new ByteArrayWA(Uint32Array, initialSizeInBytes)
    } else if (sizeOrUint32 instanceof Uint32Array) {
      var uint32Array = sizeOrUint32;
      this.initialByte = 0;
      this.size = uint32Array.buffer.byteLength;
      this.array = new WordArray.init(uint32Array, initialSizeInBytes || 0);

    // Other calls not supported
    } else {
      throw new Error(
        'Expecting first parameter to be a number of an Uint32Array.');
    }
  }

  ByteArrayWA.prototype = {
    write: function(w, numBytes) {
      numBytes = numBytes || 1;
      w = w << (32 - numBytes * 8);
      for(var byt = 0; byt < numBytes; byt++) {
        if (this.isFull()) {
          throw new RangeError('Cannot extend a ByteArrayWA');
        }
        var desp = 24 - (byt * 8);
        var b = (w & (0xff << desp)) >>> desp;
        var i = this.array.sigBytes++;
        this.array.words[i >>> 2] |= b << (24 - (i & 0x3) * 8);
      }
    },

    read: function() {
      try {
        var r = this.get(0);
        this.initialByte++;
        return r;
      } catch (x) {
        return undefined;
      }
    },

    rewind: function (numBytes) {
      for (var i = 0; i < numBytes; i++) {
        this.pop();
      }
    },

    pop: function () {
      var result = this.get(this.length - 1);
      var last = --this.array.sigBytes;
      // Set to 0: move a mask in the form 0x00ff0000, negate and make AND
      this.array.words[last >>> 2] &= ~(0xff << (24 - (last & 0x3) * 8));
      return result;
    },

    /*
     * This method 'finishes' the buffer, returning it as a Uint8Array,
     * and invalidating the buffer for future reads or writes
     * We *do* support getting a partial buffer... although it's a PITA
     */
    finish: function() {
      var byteArray = new Uint8Array(this.array.words.buffer);
      // Let's see... If we just sort from the Wword that contains initialByte
      // to the word that contains currentByte and then return the whole buffer
      // (so as to not copy it) then it should work...
      var words = this.array.words;
      var finalWord = this.array.sigBytes >>> 2;
      var currentWord, currentByte;
      for(currentWord = this.initialByte >>> 2, currentByte = currentWord << 2;
          currentWord <= finalWord; currentWord++, currentByte +=4) {
        var b3 = byteArray[currentByte],
            b2 = byteArray[currentByte + 1];
        byteArray[currentByte] = byteArray[currentByte + 3];
        byteArray[currentByte + 1] =  byteArray[currentByte + 2];
        byteArray[currentByte + 2] = b2;
        byteArray[currentByte + 3] = b3;
      }
      var result = {
        offset: this.initialByte,
        length: this.length,
        buffer: byteArray
      };
      this.array = null;
      return result;
    },

    get length() {
      return this.array.sigBytes - this.initialByte;
    },

    get bufferSize() {
      return this.size;
    },

    isEmpty: function() {
      return this.array.sigBytes == this.initialByte;
    },

    isFull: function() {
      // The buffer doesn't grow nor is reusable!
      return this.array.sigBytes == this.size;
    },

    // I was going to throw an exception, but not having the function at all works also
    // Leaving this here, commented, so nobody thinks of adding it :P
/*    resize: function(size) {
      if (size > this.size) {
        // In this case the word array will grow automagically...
        this.size = this.array.sigBytes = size;
        this.array.words[size >>> 2] = undefined;
      }
    },
*/

    get: function(index) {
      var i = this.initialByte + index;
      if (index < 0 || i >= this.array.sigBytes) {
        throw new RangeError('index out of bounds.');
      }
      var desp = (24 - (i & 0x3) * 8);
      return (this.array.words[i >>> 2] & (0xff << desp)) >>> desp;
    },

    // It accepts sequence of bytes or WordArrays
    writeAll: function(sequence) {
      // Nifty trick... we allow also writing WordArrays
      var numBytes = sequence.words && sequence.sigBytes ? 4 : 1;
      var bytesLeft = sequence.sigBytes || sequence.length;
      if (numBytes > 1) {
        sequence = sequence.words;
      }
      for(var i = 0; bytesLeft > 0; bytesLeft -= numBytes, i++) {
        var data = sequence[i];
        var bytesToCopy = bytesLeft < numBytes ? bytesLeft : numBytes;
        this.write(data >>> (32 - bytesToCopy * 8), bytesToCopy);
      }
      return this;
    }

  };

  function ByteArray(size) {
    // virtualSize is the size the user wants
    var virtualSize = typeof size !== 'undefined' ? Math.floor(size) : 1023;

    // bufSize is the real size of the buffer
    var bufSize = virtualSize + 1;

    var array = new Uint8Array(bufSize);
    var start = 0, end = 0;

    function _nextIndex(index) {
      var next;
      return (next = index + 1) === bufSize ? 0 : next;
    }

    function _dumpContent(destination) {
      if (end < start) {
        destination.set(array.subarray(start, bufSize));
        destination.set(array.subarray(0, end), bufSize - start);
      } else {
        destination.set(array.subarray(start, end));
      }
    }

    Object.defineProperty(this, 'bufferSize', { get: function() {
      return virtualSize;
    } });

    Object.defineProperty(this, 'length', { get: function() {
      return end - start + (end < start ? bufSize : 0);
    } });

    Object.defineProperty(this, 'buffer', { get: function() {
      var a = new Uint8Array(this.length);
      _dumpContent(a);
      return a.buffer;
    } });

    this.isEmpty = function() { return start === end; };

    this.isFull = function() { return this.length === virtualSize; };

    this.write = function(n) {
      if (this.isFull()) {
        this.resize(bufSize * 2);
      }
      array[end] = n;
      end = _nextIndex(end);
    };

    this.read = function() {
      if (this.isEmpty()) {
        return undefined;
      }
      var item = array[start];
      start = _nextIndex(start);
      return item;
    };

    this.resize = function(newSize) {
      var contentLength = this.length;
      var newVirtualSize = Math.max(Math.floor(newSize), contentLength);
      if (newVirtualSize !== virtualSize) {
        var newBufferSize = newVirtualSize + 1;
        var newArray = new Uint8Array(newBufferSize);
        _dumpContent(newArray);

        virtualSize = newVirtualSize;
        bufSize = newBufferSize;
        array = newArray;
        start = 0;
        end = contentLength;
      }

      return virtualSize;
    };

    this.get = function(i) {
      if (i < 0 || i >= this.length) {
        throw new RangeError('index out of bounds.');
      }
      var fixedIndex = start + i;
      fixedIndex -= (fixedIndex >= bufSize ? bufSize : 0);
      return array[fixedIndex];
    };

    this.writeAll = function(sequence) {
      for (var i = 0, l = sequence.length; i < l; i++) {
        this.write(sequence[i]);
      }
    };
  }

  ByteArray.fromBuffer = function(buffer) {
    if (buffer instanceof ArrayBuffer) {
      buffer = new Uint8Array(buffer);
    }

    if (buffer instanceof Uint8Array) {
      var output = new ByteArray(buffer.length);
      output.writeAll(buffer);
      return output;
    }

    throw new Error('fromBuffer(buffer) only works with instances of ' +
                    'ArrayBuffer or Uint8Array.')
  };

  function hex(array) {
    if (array instanceof ArrayBuffer) {
      array = new Uint8Array(array);
    } else if (array instanceof ByteArray) {
      array = new Uint8Array(array.buffer);
    } else if (array instanceof ByteArrayWA) {
      return CryptoJS.enc.Hex.stringify(array.buffer);
    }
    var c, hexrepr = '';
    for (var i = 0, l = array.length; i < l; i++) {
      c = array[i].toString(16);
      hexrepr += (c.length < 2) ? '0' + c : c;
    }
    return hexrepr;
  }

  function bytesFromLatin1(string) {
    var buffer = new Uint8Array(string.length);
    var b1, b0, c;
    for (var i = 0, l = string.length; i < l; i++) {
      c = string.charCodeAt(i);
      b1 = (c & 0xFF00) >>> 8;
      if (b1) {
        logger.warn(
          'High order byte !== 0x00 in character number', i, 'of ', string);
      }
      b0 = (c & 0xFF);
      buffer[i] = b0;
    }
    return buffer;
  }

  function latin1FromBytes(buffer) {
    var result = '';
    var l = buffer.length;
    for (var i = 0; i < l; i++) {
      result = result + String.fromCharCode(buffer[i]);
    }
    return result;
    // was
    //    return String.fromCharCode.apply(null, buffer);
    // but for some unknown reason, this is way slower...
  }

  function encodeIdForURL(str) {
    return str.split('').map(function (c) {
      var hexrepr = c.charCodeAt(0).toString(16).toUpperCase();
      if (hexrepr.length < 2) { hexrepr = '0' + hexrepr; }
      return '%' + hexrepr;
    }).join('');
  }

  var utils = {
    urlencode: function _urlencode(params) {
      var pairs = [];
      for (var paramName in params) {
        if (Array.isArray(params[paramName])) {
          var aux = [];
          for (var i in params[paramName]) {
            aux.push(encodeURIComponent(paramName + '[]') + '=' +
                     encodeURIComponent(params[paramName][i]));
          }
          pairs.push(aux.join('&'));
        } else {
          var encodedName = encodeURIComponent(paramName);
          var encodedValue = paramName === 'id' ?
                             encodeIdForURL(params[paramName]) :
                             encodeURIComponent(params[paramName]);
          pairs.push(encodedName + '=' + encodedValue);
        }
      }
      return pairs.join('&');
    },

    len: function _len(obj) {
      if (typeof obj !== 'object' && typeof obj.length === 'number')
        return obj.length;

      if (typeof obj === 'object')
        return Object.keys(obj).length;
    },

    ByteArray: ByteArray,
    ByteArrayWA: ByteArrayWA,

    /**
     * Converts a Latin1 string into a typed array of bytes (Uint8Array).
     */
    bytesFromLatin1: bytesFromLatin1,

    /**
     * Converts a typed array of bytes (Uint8Array) into a Latin1 string.
     */
    latin1FromBytes: latin1FromBytes,

    /**
     * Encodes a JS string into UTF-8.
     */
    utf8FromString: function(string) {
      return string?unescape(encodeURIComponent(string)):'';
    },

    /**
     * Decodes a UTF-8 message into a JS string.
     */
    stringFromUtf8: function(string) {
      return string?decodeURIComponent(escape(string)):'';
    },

    /**
     * Converts a string with a hex representation of binary data into a
     * typed array (Uint8Array).
     */
    bytesFromHex: function(hexrepr) {
      hexrepr = hexrepr.toLowerCase().replace(/[^0-9a-f]/g, '');
      var byte, array = new Uint8Array(hexrepr.length / 2);
      for (var i = 0, l = array.length; i < l; i++) {
        byte = hexrepr.substr(2 * i, 2);
        array[i] = parseInt(byte, 16);
      }
      return array;
    },

    /**
     * Converts an Uint8Array or ArrayBuffer or ByteArray into a hex
     * representation of the same data.
     */
    hex: hex,

    /**
     * Converts a base64 string into a blob of the given mimeType.
     */
    aToBlob: function(base64, mimeType) {
      var latin1 = atob(base64);
      return utils.latin1ToBlob(latin1, mimeType);
    },

    /**
     * Converts a base64 string into a blob of the given mimeType.
     */
    latin1ToBlob: function(latin1, mimeType) {
      return new Blob([utils.bytesFromLatin1(latin1)], {type: mimeType});
    },

    random: function _random(min, max) {
      return Math.random() * (max - min) + min;
    },

    formatStr: function _formatStr(template, params) {
      if (typeof(params) != 'object') {
        logger.warn('`params` parameter is not an object');
        return template;
      }
      var param;
      for (param in params) {
        template = template.replace('{' + param + '}', params[param], 'g');
      }
      return template;
    }
  };

  return utils;
}()));
