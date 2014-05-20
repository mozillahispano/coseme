
function TCPSocketMock() {
  'use strict';

  this._bytesReceived = [];
}

TCPSocketMock.prototype.readyState = 'open';

TCPSocketMock.prototype.reset = function(data) {
  this._bytesReceived = [];
};

TCPSocketMock.prototype.send = function(data, offset, length) {
  offset = offset || 0;
  length = typeof length === 'undefined' ? len(data) - offset : length;
  var isString = typeof data === 'string';
  for (var i = offset, l = length; l > 0; l--, i++) {
    this._bytesReceived.push(get(data, i));
  };

  function len(data) {
    return isString ? data.length : data.byteLength;
  }

  function get(data, i) {
    return isString ? data[i] : Uint8Array(data)[i];
  }
};

TCPSocketMock.prototype.suspend = function() {
  this._suspended = true;
};

TCPSocketMock.prototype.resume = function() {
  this._suspended = false;
};

TCPSocketMock.prototype.sent = function() {
  var hexArray = this._bytesReceived.map(function (byte) {
    var hexRepr = byte.toString(16);
    if (hexRepr.length < 2) hexRepr = '0' + hexRepr;
    return hexRepr;
  })
  return hexArray.join(' ');
};

TCPSocketMock.prototype.returns = function(hexdata, chunks) {
  chunks = chunks || [];
  var self = this;
  var hexArray = hexdata.split(' ');
  var byteArray = hexArray.map(function(hexItem) {
    return parseInt(hexItem, 16);
  });
  var returnBuffer = new Uint8Array(byteArray.length);
  returnBuffer.set(byteArray);

  var chunkIndex = 0;
  var consumed = 0;
  var length = returnBuffer.length;

  setTimeout(returnData);

  function returnData() {
    if (consumed >= length)
      return;

    var amountToReturn = chunks[chunkIndex] || Math.ceil(Math.random() * 3);
    setTimeout(function() {
      var data = returnBuffer.buffer.slice(consumed, consumed + amountToReturn);
      self.ondata && self.ondata({ data: data });
      setTimeout(returnData, 10);
      consumed += amountToReturn;
    });
    chunkIndex++;
  }
};
