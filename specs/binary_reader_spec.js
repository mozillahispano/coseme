
describe('CoSeMe BinaryReader', function() {
  var socketMock, connectionMock;
  var Tree = CoSeMe.protocol.Tree;

  var TEST_TREE = new Tree('stream:features', {
    children: [
      new Tree('receipt_acks'),
      new Tree('w:profile:picture', { attributes: {'type': 'all'} }),
      new Tree('status')
    ]
  });

  beforeEach(function() {
    socketMock = new TCPSocketMock();
    connectionMock = { socket: socketMock };
  });

  it('parses the start of the stream with streamStart() method.', function() {
    var done, reader = new CoSeMe.protocol.BinaryReader();
    var streamData = '00 00 05 f8 03 01 41 ab';

    runs(function() {
      reader.startListening(connectionMock);
      reader.onStreamStart = function(err) {
        done = true;
      };
      socketMock.returns(streamData, [2]);
    });

    waitsFor(function() {
      return done;
    }, 'the stream start, which should be eventually read.', 1000);

    runs(function() {
      expect(done).toBe(true);
    });

  });

  it('parses tree data with nextTree() method.', function() {

    var parsedTree, reader = new CoSeMe.protocol.BinaryReader();
    var treeData = '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99';

    runs(function() {
      reader.startListening(connectionMock);
      reader.onTree = function(err, tree) {
        parsedTree = tree;
      };
      reader.isStreamStartRead = true;
      socketMock.returns(treeData, [2]);
    });

    waitsFor(function() {
      return parsedTree;
    }, 'a tree, wich should be eventually parsed.', 1000);

    runs(function() {
      expect(parsedTree.toString()).toBe(TEST_TREE.toString());
    });

  });

  it('can parse several trees when received in several chunks', function() {

    var parsedTrees = [], reader = new CoSeMe.protocol.BinaryReader();
    var treeData = '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ';

    runs(function() {
      reader.startListening(connectionMock);
      reader.onTree = function(err, tree) {
        parsedTrees.push(tree);
      };
      reader.isStreamStartRead = true;
      socketMock.returns(treeData, [2*29]);
    });

    waitsFor(function() {
      return parsedTrees.length === 3;
    }, 'three trees, wich should be eventually parsed.', 1000);

    runs(function() {
      expect(parsedTrees[0].toString()).toBe(TEST_TREE.toString());
      expect(parsedTrees[1].toString()).toBe(TEST_TREE.toString());
      expect(parsedTrees[2].toString()).toBe(TEST_TREE.toString());
    });

  });

  it('can parse stream and more than one tree in only one chunk.', function() {

    var streamStart, parsedTrees = [],
        reader = new CoSeMe.protocol.BinaryReader();
    var treeData = '00 00 05 f8 03 01 41 ab ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99';

    runs(function() {
      reader.startListening(connectionMock);
      reader.onStreamStart = function(err) {
        streamStart = true;
      };
      reader.onTree = function(err, tree) {
        parsedTrees.push(tree);
      };
      socketMock.returns(treeData, [8 + 2*29]);
    });

    waitsFor(function() {
      return streamStart && parsedTrees.length === 2;
    }, 'the stream start or trees, wich should be eventually parsed.', 1000);

    runs(function() {
      expect(streamStart).toBe(true);
      expect(parsedTrees[0].toString()).toBe(TEST_TREE.toString());
      expect(parsedTrees[1].toString()).toBe(TEST_TREE.toString());
    });

  });

  it('two trees received in the same chunk can be parsed in different handlers',
  function() {

    var streamStart, handler1Ok, handler2Ok,
        reader = new CoSeMe.protocol.BinaryReader();

    var treeData = '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99';

    runs(function() {
      reader.startListening(connectionMock);
      reader.isStreamStartRead = true;

      reader.onTree = function handler1(err, tree) {
        !err && (handler1Ok = true);

        setTimeout(function() {
          reader.onTree = function handler2(err, tree) {
            !err && (handler2Ok = true);
          }
        });
      };
      socketMock.returns(treeData, [2*29]);
    });

    waitsFor(function() {
      return handler1Ok && handler2Ok;
    }, 'both trees to be parsed and treated in different handlers.', 1000);

  });

  it('can be paused and resumed in a future and no tree is lost',
  function() {

    var streamStart, handler1Ok, handler2Ok,
        reader = new CoSeMe.protocol.BinaryReader();
    var treeData = '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99 ' +

                   '00 00 1d f8 02 9b f8 03 f8 01 fc 0c 72 65 63 65 ' +
                   '69 70 74 5f 61 63 6b 73 f8 03 bc a6 09 f8 01 99';

    runs(function() {
      reader.startListening(connectionMock);
      reader.isStreamStartRead = true;

      reader.onTree = function handler1(err, tree) {
        !err && (handler1Ok = true);

        reader.suspend();

        setTimeout(function() {
          reader.onTree = function handler2(err, tree) {
            !err && (handler2Ok = true);
          }
          reader.resume();
        }, 500);
      };
      socketMock.returns(treeData, [2*29]);
    });

    waitsFor(function() {
      return handler1Ok && handler2Ok;
    }, 'both trees to be parsed and treated in different handlers.', 1500);

  });

  it('can handle heavy trees beyond 64KiB',
  function() {

    // The data are 65536 - 7 'a' characters. Those 7 characters are the
    // binarization of the message tree without the header.
    var data = new Array(256 * 256 - 7 + 1).join('a');
    var hexData = Array.prototype.map.call(data, function (char) {
      return ' ' + char.charCodeAt(0).toString(16);
    });

    var BIG_TREE = new Tree('message', { data: data });

    var theTree, reader = new CoSeMe.protocol.BinaryReader();
    var treeData = '01 00 00 f8 02 58 fd 00 ff f9' + hexData;
    // Notice each triplet <space><hex><hex> except for the first one.
    // Size is therefore (length + 1) / 3;
    var treeDataLength = (treeData.length + 1) / 3;

    runs(function() {
      reader.startListening(connectionMock);
      reader.isStreamStartRead = true;

      reader.onTree = function handler1(err, tree) {
        !err && (theTree = tree);
      };

      socketMock.returns(treeData, [treeDataLength]);
    });

    waitsFor(function() {
      return theTree;
    }, 'the big tree to be parsed', 1500);

    runs(function() {
      expect(theTree.toString()).toBe(BIG_TREE.toString());
    });

  });

});
