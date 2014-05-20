CoSeMe.namespace('connection', (function() {
  'use strict';

  var _connection;

  function Connection() {
    if (!_connection) {
      _connection = Object.create(Connection.prototype);
    }
    return _connection;
  }

  Connection.prototype.connect = function(host, port, options,
                                          onSuccess, onError) {

    options = options || {};
    var socket = navigator.mozTCPSocket.open(host, port, options);
    socket.onerror = function _connectionError() {
      onError && onError('connection-refused');
    };
    socket.onopen = function _connectionSuccess() {
      _connection.socket = socket;
      setErrorHandlers();
      setBinaryStreams();
      onSuccess && onSuccess.apply(this, arguments);
    };
  };

  function setErrorHandlers() {
    _connection.socket.onerror = fire('onconnectionlost');
    _connection.socket.onclose = fire('onconnectionclosed');
  }

  function fire(event) {
    return function() {
      var handler = _connection[event];
      if (typeof handler === 'function') {
        handler.apply(_connection, arguments);
      }
    };
  }

  function setBinaryStreams() {
    _connection.reader = new CoSeMe.protocol.BinaryReader(_connection);
    _connection.writer = new CoSeMe.protocol.BinaryWriter(_connection);
  }

  return Connection;

}()));
