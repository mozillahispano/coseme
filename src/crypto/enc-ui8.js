/*
 * Derived from
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * UInt8Array encoding strategy.
     */
    var CJUInt8Array = C_enc.UInt8Array = {

        /**
         * Converts a word array to a UInt8Array.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {UInt8Array} The UInt8Array string.
         *
         * @static
         *
         * @example
         *
         *     var uint8Array = CryptoJS.enc.UInt8Array.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Clamp excess bits
          wordArray.clamp();

          // Convert
          var uint8Array = new Uint8Array(sigBytes);
          for (var i = 0; i < sigBytes; i++) {
            uint8Array[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          }

          return uint8Array;
        },

        /**
         * Converts a UInt8Array to a word array.
         *
         * @param {UInt8Array} buffer The UInt8Array.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.UInt8Array.parse(uint8array);
         */
        parse: function (buffer) {
          // Shortcut
          var byteLength = buffer.length;

          // Convert
          var words = [];
          for (var i = 0; i < byteLength; i++) {
            words[i >>> 2] |= (buffer[i] & 0xff) << (24 - (i % 4) * 8);
          }

          return new WordArray.init(words, byteLength);
        }
    };
}());
