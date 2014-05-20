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
    var StreamCipher = C_lib.StreamCipher;
    var C_algo = C.algo;

    function generateKeystreamWordWP(bytesToProc) {
        // Shortcuts
          var S = this._S;
          var i = this._i;
          var j = this._j;
        var iters = 4;
        if (bytesToProc !== undefined) {
          iters = Math.min(bytesToProc, iters);
        }

        // Generate keystream word
        var keystreamWord = 0;
        for (var n = 0; n < iters; n++) {
            i = (i + 1) % 256;
            j = (j + S[i]) % 256;

            // Swap
            var t = S[i];
            S[i] = S[j];
            S[j] = t;

            keystreamWord |= S[(S[i] + S[j]) % 256] << (24 - n * 8);
        }

        // Update counters
        this._i = i;
        this._j = j;

        return keystreamWord;
    }

    /**
     * Modified RC4 stream cipher algorithm.
     * Modifications:
     *   * Allow to cipher bytes instead of full words
     *   * Cipher in place: Allow only calls to finalize. And decipher in-place, so as to not need to copy the data
     */
    var RC4WP = C_algo.RC4WP = C_algo.RC4Drop.extend({
        _doProcessBlock: function (M, offset, bytesToProc) {
            M[offset] ^= generateKeystreamWordWP.call(this, bytesToProc);
        },

        // Update is not supported since we decipher in place!
        update: function() {
          throw new Error("Update not supported!");
        },

        // This append doesn't actually append... 
        // It just stores a ref to data. So any previous data will be lost!
        _append: function (data) {
          this._data = data;
        },

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
                // You guessed it, this is not supported either!
                throw new Error("Cannot call _process without doFlush");
            }

            // Count words ready
            var nWordsReady = nBlocksReady * blockSize;

            // Count bytes ready
            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

            // Process blocks
            if (nWordsReady) {
                var totBytes = 0;
                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                    // Perform concrete-algorithm logic
                    this._doProcessBlock(dataWords, offset, nBytesReady - totBytes);
                    totBytes += 4;
                }

                // Remove processed words, which will be all of them...
                this._data = null;
            }

            // Return processed words
            return data;
        }

    });

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.RC4WP.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.RC4WP.decrypt(ciphertext, key, cfg);
     */
    C.RC4WP = StreamCipher._createHelper(RC4WP);
}());
