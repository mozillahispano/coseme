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
  var Hasher = C_lib.Hasher;
  var C_algo = C.algo;

  /**
   * SHA-1 hash algorithm.
   */
  var SHA1_IP = C_algo.SHA1_IP = C_algo.SHA1.extend({

    // Append doesn't actually append anymore!
    // It just stores a ref to data. So any previous data will be lost!
    _append: function(data) {
       this._data = data;
       // Count the bytes even if we're not really appending
       this._nDataBytes += data.sigBytes;
     },

     // Special process that does NOT remove the processed blocks...
     // This one is actually quite similar to the one in RC4_WP
     _process: function (doFlush) {
       // Shortcuts
       var data = this._data;
       var dataWords = data.words;
       var dataSigBytes = data.sigBytes;
       var blockSize = this.blockSize;
       var blockSizeBytes = blockSize * 4;

       // Count blocks ready
       var nBlocksReady = dataSigBytes / blockSizeBytes;
       if (doFlush) {
         // Round up to include partial blocks
         nBlocksReady = Math.ceil(nBlocksReady);
       } else {
         // Round down to include only full blocks,
         // less the number of blocks that must remain in the buffer
         nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
       }

       // Count words ready
       var nWordsReady = nBlocksReady * blockSize;

       // Count bytes ready
       var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

       // Process blocks
       var offset = 0;
       if (nWordsReady) {
         for (offset = 0; offset < nWordsReady; offset += blockSize) {
           // Perform concrete-algorithm logic
           this._doProcessBlock(dataWords, offset);
         }
       }
       // Remove processed even if we didn't process any words... 
       // the hard way. Let's assume dataWords is NOT an array
       var l = dataWords.length;
       var dataLeft = new Array(l - offset)
       for(offset = nWordsReady; offset < l; offset ++) {
         dataLeft[offset - nWordsReady] = dataWords[offset];
       }
       this._data = new WordArray.init(dataLeft, data.sigBytes - nBytesReady);

       // Return nothing
       return ;
     },

     _doFinalize: function () {

       // Process the real data blocks
       this._process();

       // And now hash the padding

       // Shortcuts
       var data = this._data;
       var dataWords = data.words;

       var nBitsTotal = this._nDataBytes * 8;
       var nBitsLeft = data.sigBytes * 8;

       // Add padding
       dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
       dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
       dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
       data.sigBytes = dataWords.length * 4;

       // Hash final blocks
       this._process();

       // Return final computed hash
       return this._hash;
     }
   });

   /**
    * Shortcut function to the hasher's object interface.
    *
    * @param {WordArray|string} message The message to hash.
    *
    * @return {WordArray} The hash.
    *
    * @static
    *
    * @example
    *
    *     var hash = CryptoJS.SHA1_IP('message');
    *     var hash = CryptoJS.SHA1_IP(wordArray);
    */
   C.SHA1_IP = Hasher._createHelper(SHA1_IP);

   /**
    * Shortcut function to the HMAC's object interface.
    *
    * @param {WordArray|string} message The message to hash.
    * @param {WordArray|string} key The secret key.
    *
    * @return {WordArray} The HMAC.
    *
    * @static
    *
    * @example
    *
    *     var hmac = CryptoJS.HmacSHA1_IP(message, key);
    */
   C.HmacSHA1_IP = Hasher._createHmacHelper(SHA1_IP);
 }());
