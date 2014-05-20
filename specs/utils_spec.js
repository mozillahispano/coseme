
describe('CoSeMe encoding', function() {
  function array(typedArray) {
    if (typedArray instanceof ArrayBuffer)
      typedArray = new Uint8Array(typedArray);
    return [].slice.call(typedArray, 0);
  }

  describe('the `bytesFromLatin1()` method', function() {
    var bytesFromLatin1 = CoSeMe.utils.bytesFromLatin1;


    beforeEach(function() {
      sinon.spy(console, 'warn');
    });

    afterEach(function() {
      console.warn.restore();
    });

    it('transform a latin1 string into an array of bytes.', function() {
      var result, expected = [0, 1, 15, 255];
      result = bytesFromLatin1('\x00\x01\x0f\xff');
      expect(array(result)).toEqual(expected);
      expect(result.length).toBe(expected.length);
      expect(console.warn.callCount).toBe(0);
    });

    it('warns the user if some high byte is set.', function() {
      var result, expected = [0, 172, 15, 255];
      result = bytesFromLatin1('\x00€\x0f\xff');
      expect(array(result)).toEqual(expected);
      expect(result.length).toBe(expected.length);
      expect(console.warn.calledOnce).toBe(true);
    });

  });

  describe('the `bytesFromHex()` method', function() {
    var bytesFromHex = CoSeMe.utils.bytesFromHex;

    it('transforms a hexadecimal representation into an array of bytes.',
    function() {
      var result, expected = [0, 1, 15, 255];
      result = bytesFromHex('00010fff');
      expect(array(result)).toEqual(expected);
    });

    it('is case insensitive.',
    function() {
      var result, expected = [0, 1, 15, 255];
      result = bytesFromHex('00010FFF');
      expect(array(result)).toEqual(expected);
    });

    it(
    'take in count only hex digits (which allows a wide range of separators).',
    function() {
      var result, expected = [0, 1, 15, 255];

      result = bytesFromHex('00-01-0F-FF');
      expect(array(result)).toEqual(expected);

      result = bytesFromHex('00 01 0F FF');
      expect(array(result)).toEqual(expected);

      result = bytesFromHex('00, 01, 0F, FF');
      expect(array(result)).toEqual(expected);

      result = bytesFromHex('x00010FFF');
      expect(array(result)).toEqual(expected);

      result = bytesFromHex('00\n01\n0F\nFF');
      expect(array(result)).toEqual(expected);

      result = bytesFromHex('00:01:0F:FF');
      expect(array(result)).toEqual(expected);
    });


  });

  describe('the `hex()` method', function() {
    var hex = CoSeMe.utils.hex;

    it('transforms a byte array into its hexadecimal representation.',
    function() {
      var reference = [0, 1, 15, 255];
      var typedArray = new Uint8Array(reference.length);
      typedArray.set(reference);
      var result, expected = '00010fff';
      result = hex(typedArray);
      expect(result).toBe(expected);
    });

  });

  describe('the `ByteArray` class ', function() {
    var ByteArray = CoSeMe.utils.ByteArray;

    it('allows getting an ArrayBuffer with the content.', function() {
      var byteArray = new ByteArray();
      expect(byteArray.buffer instanceof ArrayBuffer).toBe(true);
      expect(byteArray.buffer.byteLength).toBe(0);
    });

    it('keeps the length of the array in the `length` property.', function() {
      var byteArray = new ByteArray();
      expect(byteArray.length).toBe(0);
      expect(array(byteArray.buffer)).toEqual([]);
    });

    it('allows to write byte by byte.', function() {
      var byteArray = new ByteArray();
      byteArray.write(1);
      byteArray.write(2);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
      expect(byteArray.length).toBe(2);
    });

    it('allows to consume byte by byte.', function() {
      var a, b, byteArray = new ByteArray();
      byteArray.write(1);
      byteArray.write(2);
      a = byteArray.read();
      b = byteArray.read();
      expect(byteArray.length).toBe(0);
      expect(array(byteArray.buffer)).toEqual([]);
      expect(a).toBe(1);
      expect(b).toBe(2);
    });

    it('allows to resize to a bigger array.', function() {
      var lengthBeforeResize, byteArray = new ByteArray(2);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      byteArray.resize(4);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    it('allows to resize to a smaller array.', function() {
      var newSize, lengthBeforeResize, byteArray = new ByteArray(4);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      newSize = byteArray.resize(3);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(newSize).toBe(byteArray.bufferSize);
      expect(newSize).toBe(3);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    it('does not allow to resize to a buffer shorter than its content.',
    function() {
      var newSize, lengthBeforeResize, byteArray = new ByteArray(4);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      newSize = byteArray.resize(1);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(newSize).toBe(byteArray.bufferSize);
      expect(newSize).toBe(2);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    it('reads no more if there is no data.', function() {
      var a, b, byteArray = new ByteArray();
      a = byteArray.read();
      b = byteArray.read();
      expect(byteArray.length).toBe(0);
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
    });

    it('autoresize if new data does not fit in the current array.', function() {
      var byteArray = new ByteArray(2);
      sinon.spy(byteArray, 'resize');
      byteArray.write(1);
      byteArray.write(2);
      byteArray.write(3);
      expect(byteArray.length).toBe(3);
      expect(byteArray.resize.calledOnce).toBe(true);
      expect(array(byteArray.buffer)).toEqual([1,2,3]);
    });

    it('allows to access to a given position.', function() {
      var byteArray = new ByteArray();
      byteArray.write(1);
      byteArray.write(2);
      byteArray.write(3);
      byteArray.read();
      expect(byteArray.get(0)).toBe(2);
    });

    describe('the circular buffer implementation', function() {
      it('takes advantage of the free space at the beginning of the buffer.',
      function() {
        var byteArray = new ByteArray(5);
        sinon.spy(byteArray, 'resize');
        byteArray.write(1);
        byteArray.write(2);
        byteArray.write(3);
        byteArray.write(4);
        byteArray.write(5);
        byteArray.read();
        byteArray.read();
        byteArray.write(6);
        expect(array(byteArray.buffer)).toEqual([3, 4, 5, 6]);
        expect(byteArray.resize.callCount).toBe(0);
      });

      it('only resizes where there is no more free space.',
      function() {
        var byteArray = new ByteArray(5);
        sinon.spy(byteArray, 'resize');
        byteArray.write(1);
        byteArray.write(2);
        byteArray.write(3);
        byteArray.write(4);
        byteArray.write(5);
        byteArray.read();
        byteArray.read();
        byteArray.write(6);
        byteArray.write(7);
        expect(byteArray.resize.callCount).toBe(0);
        byteArray.write(8);
        expect(array(byteArray.buffer)).toEqual([3, 4, 5, 6, 7, 8]);
        expect(byteArray.resize.calledOnce).toBe(true);
      });
    });
  });

  describe('the `ByteArrayWA` class ', function() {
    var ByteArrayWA = CoSeMe.utils.ByteArrayWA;

    it('allows getting an ArrayBuffer with the content.', function() {
      var byteArray = new ByteArrayWA(1);
      expect(byteArray.array.words instanceof Uint32Array).toBe(true);
    });

    it('allocates exactly the size passed plus 4 for the HMAC when size is a ' +
       '4 multiple.', function() {
      var byteArray = new ByteArrayWA(4);
      expect(byteArray.array.words.byteLength).toBe(4 + 4);
    });

    it('allocates exactly the next 4 multiple plus 4 for the HMAC when size ' +
       'is not a 4 multiple.', function() {
      var byteArray = new ByteArrayWA(5);
      expect(byteArray.array.words.byteLength).toBe(8 + 4);
    });

    it('keeps the length of the array in the `length` property.', function() {
      var byteArray = new ByteArrayWA(4);
      expect(byteArray.length).toBe(0);
    });

    it('allows to write byte by byte.', function() {
      var byteArray = new ByteArrayWA(2);
      byteArray.write(1);
      byteArray.write(2);
      var finishedBuffer = byteArray.finish();
      var contents =
        array(finishedBuffer.buffer).slice(0, finishedBuffer.length);
      expect(contents).toEqual([1, 2]);
      expect(finishedBuffer.length).toBe(2);
    });

    it('allows to consume byte by byte.', function() {
      var a, b, byteArray = new ByteArrayWA(2);
      byteArray.write(1);
      byteArray.write(2);
      a = byteArray.read();
      b = byteArray.read();
      expect(byteArray.length).toBe(0);
      expect(a).toBe(1);
      expect(b).toBe(2);
    });

    xit('allows to resize to a bigger array.', function() {
      var lengthBeforeResize, byteArray = new ByteArrayWA(2);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      byteArray.resize(4);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    xit('allows to resize to a smaller array.', function() {
      var newSize, lengthBeforeResize, byteArray = new ByteArrayWA(4);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      newSize = byteArray.resize(3);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(newSize).toBe(byteArray.bufferSize);
      expect(newSize).toBe(3);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    xit('does not allow to resize to a buffer shorter than its content.',
    function() {
      var newSize, lengthBeforeResize, byteArray = new ByteArrayWA(4);
      byteArray.write(1);
      byteArray.write(2);
      lengthBeforeResize = byteArray.length;
      newSize = byteArray.resize(1);
      expect(byteArray.length).toBe(lengthBeforeResize);
      expect(newSize).toBe(byteArray.bufferSize);
      expect(newSize).toBe(2);
      expect(array(byteArray.buffer)).toEqual([1, 2]);
    });

    it('reads no more if there is no data.', function() {
      var a, b, byteArray = new ByteArrayWA(2);
      a = byteArray.read();
      b = byteArray.read();
      expect(byteArray.length).toBe(0);
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
    });

    xit('throws if new data does not fit in the current array.', function() {
      var byteArray = new ByteArrayWA(2);
      try {
        byteArray.write(1);
        byteArray.write(2);
        byteArray.write(3);
        expect(false).toBe(true);
      } catch (x) {
        expect(byteArray.length).toBe(2);
        expect(array(byteArray.finish().buffer)).toEqual([1,2]);
      }
    });

    it('allows to access to a given position.', function() {
      var byteArray = new ByteArrayWA(3);
      byteArray.write(1);
      byteArray.write(2);
      byteArray.write(3);
      byteArray.read();
      expect(byteArray.get(0)).toBe(2);
    });

    describe('the circular buffer implementation', function() {
      xit('takes advantage of the free space at the beginning of the buffer.',
      function() {
        var byteArray = new ByteArrayWA(5);
        sinon.spy(byteArray, 'resize');
        byteArray.write(1);
        byteArray.write(2);
        byteArray.write(3);
        byteArray.write(4);
        byteArray.write(5);
        byteArray.read();
        byteArray.read();
        byteArray.write(6);
        expect(array(byteArray.buffer)).toEqual([3, 4, 5, 6]);
        expect(byteArray.resize.callCount).toBe(0);
      });

      xit('only resizes where there is no more free space.',
      function() {
        var byteArray = new ByteArrayWA(5);
        sinon.spy(byteArray, 'resize');
        byteArray.write(1);
        byteArray.write(2);
        byteArray.write(3);
        byteArray.write(4);
        byteArray.write(5);
        byteArray.read();
        byteArray.read();
        byteArray.write(6);
        byteArray.write(7);
        expect(byteArray.resize.callCount).toBe(0);
        byteArray.write(8);
        expect(array(byteArray.buffer)).toEqual([3, 4, 5, 6, 7, 8]);
        expect(byteArray.resize.calledOnce).toBe(true);
      });
    });
  });

});
