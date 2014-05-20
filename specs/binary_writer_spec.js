
describe('CoSeMe BinaryWriter', function() {
  var socketMock, connectionMock;

  var SEQUENCE = 0x01020304;

  var OUTPUT_KEY =
    CryptoJS.enc.Hex.parse('a3884b0287ecc002fb01688d9bb10edb5b2d8ca1');

  var OUTPUT_HMAC_KEY =
    CryptoJS.enc.Hex.parse('9d84c3d8266e111b9c1aa7901c8a5b4c0bbc7864');

  beforeEach(function() {
    socketMock = new TCPSocketMock();
    connectionMock = {
      socket: socketMock
    };
  });

  describe('streamStart() method', function() {

    it('writes the start of the protocol.', function() {
      var writer = new CoSeMe.protocol.BinaryWriter(connectionMock);
      var err, done;

      sinon.spy(writer, 'flushBuffer');
      var domain = CoSeMe.config.domain;
      var resource = CoSeMe.config.tokenData['r'];

      runs(function() {
        writer.streamStart(domain, resource, function(err) {
          err = err;
          done = true;
        });
      });

      waitsFor(function() {
        return done;
      }, 'streamStart() to completely send the start of the stream', 200);

      runs(function() {
        expect(socketMock.sent())
          .toBe('57 41 01 04 00 00 1d f8 05 01 a4 90 88 fc 15 41 ' +
                '6e 64 72 6f 69 64 2d 32 2e 31 31 2e 31 35 31 2d ' +
                '35 32 32 32');
        expect(writer.flushBuffer.callCount).toBe(3);
      });
    });

  });

  describe('write() method to send binary trees', function() {
    var Tree = CoSeMe.protocol.Tree;
    var TEST_TREE = new Tree('stream:features', {
      children: [
        new Tree('receipt_acks'),
        new Tree('w:profile:picture', { attributes: {'type': 'all'} }),
        new Tree('status')
      ]
    });

    it('without encription.', function() {
      var writer = new CoSeMe.protocol.BinaryWriter(connectionMock);
      var err, done = false;

      runs(function() {
        writer.write(TEST_TREE, function(err) {
          err = err;
          done = true;
        });
      });

      waitsFor(function() {
        return done;
      }, 'write() to completely send the tree', 200);

      runs(function() {
        expect(err).toBeFalsy();
        expect(socketMock.sent())
          .toBe('00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99');
      });
    });

    it('with RC4 encription.', function() {
      var writer = new CoSeMe.protocol.BinaryWriter(connectionMock);
      var err, done = false;

      runs(function() {
        writer.outputKey =
          new CoSeMe.auth.KeyStream(OUTPUT_KEY, OUTPUT_HMAC_KEY, 'output');
        writer.outputKey.sequence = SEQUENCE;
        writer.write(TEST_TREE, function(err) {
          err = err;
          done = true;
        });
      });

      waitsFor(function() {
        return done;
      }, 'write() to completely send the tree', 200);

      runs(function() {
        expect(err).toBeFalsy();
        expect(socketMock.sent())
          .toBe('80 00 21 95 3c 70 59 5f 30 b8 ca 61 1a 56 e2 f4 ' +
                'da a3 fe 65 0a fc ab f9 ad 5d e2 52 d6 3d f7 c8 ' +
                '69 5b 48 4f');
      });

    });

    it('calls with error if the socket is not ready', function () {
      var oldState, writer, done, error;

      runs(function () {
        writer = new CoSeMe.protocol.BinaryWriter(connectionMock);
        socketMock.readyState = 'closed';
        writer.write(TEST_TREE, function (err) {
          error = err;
          done = true;
        });
      });

      waitsFor(function () {
        return done;
      }, 'write() to eventually end with error.', 200);

      runs(function () {
        expect(error).toBe('socket-non-ready');
      });
    });

  });
});
