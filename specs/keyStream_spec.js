describe('CoSeMe KeyStream (automatically generated testcases)', function() {

  var PASSWORD = 'XbH0pr+KRIKpFAfPoVb3XGJj+v8=';
  var SEQUENCE = 0x01020304;

  function getName(n, i) {
    return 'key pair = ' + n + ', test case = ' + i;
  }

  var TEST_CASES = {

    // To test `decodeMessage()`
    incoming: {

      // Each entry in ciphered / deciphered arrays correspond to the same
      // indexed key pair.
      keys: [
        ['a3884b0287ecc002fb01688d9bb10edb5b2d8ca1',
         '9d84c3d8266e111b9c1aa7901c8a5b4c0bbc7864']
      ],

      // Each element by entry represents a different test case.
      ciphered: [
        [
          // 4 first bytes (8 characters) are the MAC of the message
          // The ciphered text begins at character 8
          'bf855a1e5e0add936cf18e065e5b078d68f16445fc240e226106e6b201f36c7b68ce6e2c3179e23751adb7c5d7986ade06c8b5a7971fb733469fd1c69a2af94f3c4f1cd19826c90b85251f9730e647676d5033a73deffab717793885e5da6a2178010bb6826c0dddec'
        ]
      ],

      // Each element by entry represents the expected result for the same
      // indexed entries in `ciphered`.
      deciphered: [
        [
          '33343632303937303333340cf942b7cfc64f91e2eb53b8ecf52ca98d39efd831323334353637383957686174734170702f322e31312e31353120416e64726f69642f342e322e31204465766963652f47616c6178795333204d63634d6e632f303030303030'
        ]
      ]
    }, /* incoming */

    // To test `encodeMessage()`
    outgoing: {

      // Each entry in plaintext / ciphered correspond to the same indexed
      // key pair.
      keys: [
        ['a3884b0287ecc002fb01688d9bb10edb5b2d8ca1',
         '9d84c3d8266e111b9c1aa7901c8a5b4c0bbc7864']
      ],

      // Plain text protocol tree messages without headers. Each element by
      // entry is a test case.
      plaintext: [
        [
          '33343632303937303333340cf942b7cfc64f91e2eb53b8ecf52ca98d39efd831323334353637383957686174734170702f322e31312e31353120416e64726f69642f342e322e31204465766963652f47616c6178795333204d63634d6e632f303030303030',
        ]
      ],

      ciphered: [
        [
          {
            hash: 'bf855a1e',
            text: '5e0add936cf18e065e5b078d68f16445fc240e226106e6b201f36c7b68ce6e2c3179e23751adb7c5d7986ade06c8b5a7971fb733469fd1c69a2af94f3c4f1cd19826c90b85251f9730e647676d5033a73deffab717793885e5da6a2178010bb6826c0dddec'
          }
        ]
      ]
    } /* outgoing */
  };

  var ByteArrayWA = CoSeMe.utils.ByteArrayWA;

  describe('the `decodeMessage()` method', function() {

    var td = TEST_CASES.incoming;

    for (var n = 0; n < td.keys.length; n++) {
      var keyPair = td.keys[n];
      var outputKey = CryptoJS.enc.Hex.parse(keyPair[0]);
      var outputHMAC = CryptoJS.enc.Hex.parse(keyPair[1]);
      var testKey =
        new CoSeMe.auth.KeyStream(outputKey, outputHMAC, 'testKey');
      testKey.sequence = SEQUENCE;

      for (var i = 0; i < td.ciphered[n].length; i++) {
        it('passes the auto-generated test (' + getName(n, i) + ')',
          (function(testKey, n, i) {
            return function() {
              var c = CryptoJS.enc.Hex.parse(td.ciphered[n][i].substring(8));
              var h = CryptoJS.enc.Hex.parse(td.ciphered[n][i].substring(0, 8));

              var ba_h = new ByteArrayWA(h.sigBytes).writeAll(h);
              var ba_c = new ByteArrayWA(c.sigBytes).writeAll(c);

              var result = testKey.decodeMessage(ba_c, ba_h).array;

              var d = CryptoJS.enc.Hex.stringify(result);
              expect(d).toBe(td.deciphered[n][i]);
            };
          }(testKey, n, i))
        );
      }
    }

  });

  describe('the `encodeMessage()` method', function() {

    var MAC_SIZE = 4;

    var td = TEST_CASES.outgoing;

    for (n = 0; n < td.keys.length; n++) {
      var keyPair = td.keys[n];
      var inputKey = CryptoJS.enc.Hex.parse(keyPair[0]);
      var inputHMAC = CryptoJS.enc.Hex.parse(keyPair[1]);
      var testKey =
        new CoSeMe.auth.KeyStream(inputKey, inputHMAC, 'testKey');
      testKey.sequence = SEQUENCE;

      for(var i = 0; i < td.plaintext[n].length; i++) {
        it('passes the auto-generated test (' + getName(n, i) + ')',
          (function(testKey, n, i) {
            return function() {

              var pt_w = CryptoJS.enc.Hex.parse(td.plaintext[n][i]);

              // Leave space for the MAC!
              var pt = new ByteArrayWA(pt_w.sigBytes + MAC_SIZE).writeAll(pt_w);

              var mac = td.ciphered[n][i].hash;
              var ct = td.ciphered[n][i].text;
              expect(mac.length).toBe(MAC_SIZE * 2);

              var cip = testKey.encodeMessage(pt);// cip.text, cip.hmacSHA1

              // Check text
              cip.textH = CryptoJS.enc.Hex.stringify(cip.text.array);
              expect(cip.textH).toBe(ct);

              // Check hash
              cip.hmacSHA1H =
                CryptoJS.enc.Hex.stringify(cip.hmacSHA1.array)
                  .substr(0, MAC_SIZE * 2);

              expect(cip.hmacSHA1H).toBe(mac);

              // And now check than our nifty trick works
              for (var macIndex = 0; macIndex < MAC_SIZE; macIndex++) {
                cip.text.write(cip.hmacSHA1.get(macIndex));
              }
              cip.completeMessage = CryptoJS.enc.Hex.stringify(cip.text.array);
              var referenceSignedMessage = ct + mac;
              expect(cip.completeMessage).toBe(referenceSignedMessage);
            };
          }(testKey, n, i))
        );
      }
    }

  });

  function hex(warray) {
    return CryptoJS.enc.Hex.stringify(warray);
  }

   function base64(value) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(value));
  }

  it('has a method `getKeys()` to generete the four keys from the same nonce',
  function() {
    var challenge = CryptoJS.enc.Latin1.stringify(
      CryptoJS.enc.Hex.parse('0cf942b7cfc64f91e2eb53b8ecf52ca98d39efd8')
    );
    var result = CoSeMe.auth.KeyStream.getKeys(PASSWORD, challenge);
    expect(hex(result.outputKey))
      .toBe('a3884b0287ecc002fb01688d9bb10edb5b2d8ca1');
    expect(hex(result.outputHMAC))
      .toBe('9d84c3d8266e111b9c1aa7901c8a5b4c0bbc7864');
    expect(hex(result.inputKey))
      .toBe('b7877bb51a09bacbdd22eca7fcc281764bbe4341');
    expect(hex(result.inputHMAC))
      .toBe('b67a8ba3b99c6382f06fdabb15cc09778cf84a92');
  });
});
