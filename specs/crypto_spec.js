
describe('CoSeMe crypto', function() {

  var tests = [
    { plain: '',
      md5:   'd41d8cd98f00b204e9800998ecf8427e'},

    { plain: 'The quick brown fox jumps over the lazy dog',
      md5:   '9e107d9d372bb6826bd81d3542a419d6'},

    { plain: 'The quick brown fox jumps over the lazy dog.',
      md5:   'e4d909c290d0fb1ca068ffaddf22cbd0'}
  ];

  describe('the `MD5_IP` function', function() {
    var bytesFromLatin1 = CoSeMe.utils.bytesFromLatin1;

    tests.forEach(function(test, i) {
      it('computes the correct MD5 for "' + test.plain +
         '" (test number ' + i + ')',
      function() {
        var message = bytesFromLatin1(test.plain);
        var md5 = CoSeMe.crypto.MD5_IP(message.buffer);
        expect(md5).toBe(test.md5);
      });
    });

  });

  describe('the in place `SHAs` functions', function() {
    var bytesFromLatin1 = CoSeMe.utils.bytesFromLatin1;
    var ByteArrayWA = CoSeMe.utils.ByteArrayWA;

    var testFunc = function(test, targetFunc, refFunc) {
      var testInput    = CryptoJS.enc.Latin1.parse(test.plain);
      var targetInput  = CryptoJS.enc.Latin1.parse(test.plain);

      var testResult = CryptoJS.enc.Hex.stringify(targetFunc(testInput));
      var refResult  = CryptoJS.enc.Hex.stringify(refFunc(targetInput));
      expect(testResult).toBe(refResult);
    };

    tests.forEach(function(test, i) {
      it('computes the correct SHA1 for "' + test.plain +
         '" (test number ' + i + ')',
         testFunc.bind(undefined, test, CoSeMe.crypto.SHA1_IP, CryptoJS.SHA1));
      it('computes the correct SHA256 for "' + test.plain +
         '" (test number ' + i + ')',
         testFunc.bind(undefined, test, CoSeMe.crypto.SHA256_IP, CryptoJS.SHA256));
    });

  });

});
