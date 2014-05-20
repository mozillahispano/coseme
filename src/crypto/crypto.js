CoSeMe.namespace('crypto', (function() {
  'use strict';

  // From: http://en.wikipedia.org/wiki/MD5#Pseudocode
  CryptoJS.MD5_IP = function(arrayBuffer) {

    // Constants are the integer part of the sines of integers (in radians) * 2^32.
    var k = [
      0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee ,
      0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501 ,
      0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be ,
      0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821 ,
      0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa ,
      0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8 ,
      0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed ,
      0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a ,
      0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c ,
      0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70 ,
      0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05 ,
      0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665 ,
      0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039 ,
      0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1 ,
      0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1 ,
      0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391 ];

    // r specifies the per-round shift amounts
    var r = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

    arrayBuffer = arrayBuffer || [];
    var dataView = new Uint8Array(arrayBuffer);

    // Prepare a chunk of data with the tail of the bitstream
    var messageLength = dataView.length;
    var totalLength = messageLength + 1;
    while (totalLength % (512/8) !== (448/8)) {
      totalLength++;
    }
    totalLength += 8; // for the messageLength in bits mod 2^64 (8 bytes)

    var padding = new Uint8Array(totalLength - messageLength);
    var paddingLength = padding.length;

    // Append 1 bit
    padding[0] = 0x80;
    // Append 0s until reaching a length in bits === 448 mod 512
    // -- This is implicit as initially, the buffer is filled with 0s --
    // Append length in bits mod 2^64 (8 bytes) (in two chunks)
    putWord(messageLength * 8, padding, paddingLength - 8);
    putWord(messageLength >>> 29, padding, paddingLength - 4);

    function putWord(value, target, offset) {
      target[offset]     = value        & 0xff;
      target[offset + 1] = value >>> 8  & 0xff;
      target[offset + 2] = value >>> 16 & 0xff;
      target[offset + 3] = value >>> 24 & 0xff;
    }

    // Initialisation
    var h0 = 0x67452301,
        h1 = 0xefcdab89,
        h2 = 0x98badcfe,
        h3 = 0x10325476;

    var w = [], a, b, c, d, f, g, temp;

    // Process chunks of 512 bits
    for (var offset = 0; offset < totalLength; offset += (512/8)) {
      // break chunk into sixteen 32-bit words w[j], 0 ≤ j ≤ 15
      for (var i = 0; i < 16; i++) {
        w[i] = getAsWord(offset + (i * 4));
      }

      a = h0;
      b = h1;
      c = h2;
      d = h3;

      // main loop
      for (i = 0; i < 64; i++) {
        if (i < 16) {
          f = (b & c) | ((~b) & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | ((~d) & c);
          g = (5*i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3*i + 5) % 16;
        } else {
          f = c ^ (b | (~d));
          g = (7*i) % 16;
        }

        temp = d;
        d = c;
        c = b;
        b = b + leftrotate((a + f + k[i] + w[g]), r[i]);
        a = temp;
      }

      // update hash
      h0 = (h0 + a) & 0xffffffff;
      h1 = (h1 + b) & 0xffffffff;
      h2 = (h2 + c) & 0xffffffff;
      h3 = (h3 + d) & 0xffffffff;
    }

    // digest := h0 append h1 append h2 append h3 (in little-endian)
    var digest = new Uint8Array(16);
    putWord(h0, digest, 0);
    putWord(h1, digest, 4);
    putWord(h2, digest, 8);
    putWord(h3, digest, 12);

    return CoSeMe.utils.hex(digest);

    // The source of these two functions is the
    //   "complete stream" = message + padding
    // These functions allow to read without creating a concatenation of both
    // chunks.
    function getAsWord(offset) {
      var b3 = getFromCompleteStream(offset);
      var b2 = getFromCompleteStream(offset + 1);
      var b1 = getFromCompleteStream(offset + 2);
      var b0 = getFromCompleteStream(offset + 3);
      return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }

    function getFromCompleteStream(offset) {
      if (offset < messageLength) {
        return dataView[offset] & 0xff;
      }
      else {
        return padding[offset - messageLength] & 0xff;
      }
    }

    function leftrotate(x, c) {
      return x << c | x >>> (32 - c);
    }

  };

  return CryptoJS;
}()));
