CoSeMe.namespace('media', (function() {
  'use strict';

  var logger = new CoSeMe.common.Logger('media');

  /**
   * Per Yowsup.
   */
  var MAX_UPLOAD_BODY_ANSWER = 8192*7;

  /**
   * Converts into Latin1 an array of bytes.
   */
  function _latin1(array) {
    //return CryptoJS.enc.Latin1.parse(array).toString();
    var c, latinarray = [];
    for (var i = 0, l = array.length; i < l; i++) {
      c = String.fromCharCode(array[i]);
      latinarray.push(c);
    }
    return latinarray.join('');
  }

  function _str2ab(str) {
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  function download(url, successCb, errorCb, progressCb) {
    var blob = null;
    var xhr = new XMLHttpRequest({mozSystem: true});

    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.setRequestHeader('User-Agent', CoSeMe.config.tokenData.u);

    xhr.onprogress = function(e) {
      logger.log('XHR fired onprogress...');
      if (progressCb) {
        if (e.lengthComputable) {
          var pr = Math.floor((e.loaded/e.total) * 100);
          progressCb(pr);
        }
      }
    };

    xhr.onload = function () {
      logger.log('XHR fired onload. xhr.status:', xhr.status);
      if (xhr.status === 200 || xhr.status === 0) {
        blob = xhr.response;
        if (successCb) {
          successCb(blob);
        }
      } else {
        if (errorCb) {
          errorCb(xhr.status);
        }
      }
    };

    xhr.onerror = function(e) {
      if (errorCb) {
        errorCb(xhr.status);
      }
    };

    xhr.send();
  }

  function upload(toJID, blob, uploadUrl,
                  successCb, errorCb, progressCb, sizeToHash) {
    var TCPSocket = navigator.mozTCPSocket;
    if (!TCPSocket) {
      if (errorCb) {
        errorCb('No TCPSocket available.');
      }
      return;
    }

    var url = uploadUrl.replace('https://', '');
    var host = url.slice(0, url.indexOf('/'));
    var port = host.split(':')[1] || 443;

    logger.log('Going to open TCPSocket to host ', host, 'and port', port);

    var _socket;
    try {
      _socket = TCPSocket.open(
        host,
        port,
        {
          binaryType: 'arraybuffer',
          useSSL: true,
          useSecureTransport: true
        }
      );
    } catch(e) {
      logger.error('Media Exception:', e.data);
      if (errorCb) {
        errorCb(e.data);
      }
      return;
    }

    _socket.onerror = function (evt) {
      logger.log('Socket error:', evt.data);
      var err = evt.data;
      var wrappedErr;
      if (err && typeof(err) === 'object') {
        wrappedErr = {
          name: err.name,
          type: err.type,
          message: err.message
        };
      } else {
        wrappedErr = err;
      }

      logger.log('Wrapped error:', wrappedErr);

      if (errorCb) {
        errorCb(wrappedErr);
      }
    };

    _socket.onopen = function () {
      logger.log('Socket.onopen() called');

      var filesize = blob.size;
      var filetype = blob.type;
      logger.log('size:', filesize, 'filetype:', filetype);

      var reader = new FileReader();
      reader.addEventListener('loadend', function() {
        var buffer = reader.result;
        sizeToHash = typeof sizeToHash === 'undefined' ?
                     buffer.byteLength :
                     Math.min(sizeToHash, buffer.byteLength);
        var md5 = CoSeMe.crypto.MD5_IP(buffer.slice(0, sizeToHash));
        var crypto = md5 + '.' + filetype.split('/')[1];
        logger.log('MD5+ext:', crypto);
        onCryptoReady(crypto, reader.result);
      })
      reader.readAsArrayBuffer(blob);

      function onCryptoReady(crypto, blobAsArrayBuffer) {
        var boundary = 'zzXXzzYYzzXXzzQQ';
        var contentLength = 0;

        /**
         * Header BAOS
         */
        var hBAOS = '--' + boundary + '\r\n';
        hBAOS += 'Content-Disposition: form-data; name="to"\r\n\r\n';
        hBAOS += toJID + '\r\n';
        hBAOS += '--' + boundary + '\r\n';
        hBAOS += 'Content-Disposition: form-data; name="from"\r\n\r\n';
        hBAOS += CoSeMe.yowsup.connectionmanager.jid.replace('@whatsapp.net', '') + '\r\n';

        hBAOS += '--' + boundary + '\r\n';
        hBAOS += 'Content-Disposition: form-data; name="file"; filename="' + crypto + '"\r\n';
        hBAOS += 'Content-Type: ' + filetype + '\r\n\r\n';

        /**
         * Final BAOS
         */
        var fBAOS = '\r\n--' + boundary + '--\r\n';

        contentLength += hBAOS.length;
        contentLength += fBAOS.length;
        contentLength += blob.size;

        /**
         * Initial data to be sent
         */
        var POST = 'POST ' + uploadUrl + '\r\n';
        POST += 'Content-Type: multipart/form-data; boundary=' + boundary + '\r\n';
        POST += 'Host: ' + host + '\r\n';
        POST += 'User-Agent: ' + CoSeMe.config.tokenData.u + '\r\n';
        POST += 'Content-Length: ' + contentLength + '\r\n\r\n';

        /**
         * Send initial data and header BAOS
         */
        logger.log('Sending headers...');

        logger.log('POST:', POST);
        _socket.send(_str2ab(POST));

        logger.log('hBAOS:', hBAOS);
        _socket.send(_str2ab(hBAOS));

        logger.log('Sending body of ', blob.size, 'bytes...');
        sendBody(function _sendFinale() {
            _socket.send(_str2ab(fBAOS));
            logger.log('All sent. Have fun with _socket.ondata()!');
        });

        function sendBody(callback, offset) {
          offset = offset || 0;
          var chunksize = Math.min(1024, blob.size - offset);
          var waitForDrain = false;

          var MAX_LOOP_TIME = 20; // 20ms (50fps)
          var tooMuchTime = false;
          var startTime = Date.now();

          while(offset < blob.size && !waitForDrain && !tooMuchTime) {
            logger.log('Next', chunksize, 'bytes sent!');
            waitForDrain = !_socket.send(blobAsArrayBuffer, offset, chunksize);
            offset += chunksize;
            tooMuchTime = (Date.now() - startTime) > MAX_LOOP_TIME;
          }

          var completed = 100 * Math.min(1, offset / blob.size);
          progressCb && setTimeout(progressCb.bind(null, completed));
          logger.log(completed.toFixed(2), '% completed!');

          if (offset >= blob.size) {
            logger.log('All data sent!');
            _socket.ondrain = undefined;
            callback && setTimeout(callback);
          } else if (waitForDrain) {
            logger.log('Waiting for drain before continuing...');
            _socket.ondrain = sendBody.bind(null, callback, offset);
          } else {
            logger.log('Too much time on the loop. Releasing CPU...');
            setTimeout(sendBody, 0, callback, offset);
          }
        }
      }
    };

    var datalatin1 = '';
    _socket.ondata = function(event) {
      logger.log('Got some data!');

      datalatin1 += _latin1(new Uint8Array(event.data));

      var contentLength = (function() {
        var idx = datalatin1.indexOf('Content-Length: ');
        var doubleRC = datalatin1.indexOf('\r\n\r\n');
        if (idx === -1 || !doubleRC) {
          return undefined;
        }
        var a = datalatin1.substring(idx, datalatin1.indexOf('\r\n', idx));
        var b = a.split(':')[1];
        contentLength = parseInt(b, 10);
        logger.log('Content length:', contentLength);
        return contentLength;
      })();

      var body = '';
      if (typeof contentLength === 'number') {
        body = (function() {
          logger.log('Current data:', datalatin1);
          var rv = datalatin1.substring(datalatin1.length - contentLength,
                                        datalatin1.length);
          if (rv.length !== contentLength) {
            rv = undefined;
          }
          return rv;
        })();
      }

      if (datalatin1.length > MAX_UPLOAD_BODY_ANSWER ||
           typeof body === 'string') {
        logger.log('Enough data, closing socket and start parsing');

        if (progressCb) {
          progressCb(100);
        }

        var json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          logger.error('Media exception:', e);
          if (errorCb) {
            errorCb('JSON not valid -- ' + e);
            return;
          }
        }

        if (json.url) {
          logger.log('We got an URL on the result:', json.url);
          if (successCb) {
            successCb(json.url);
          }
        } else {
          if (errorCb) {
            errorCb('No URL in result');
          }
        }

        // Let's close the socket and remove the errorCb handler
        errorCb = undefined;
        _socket.close();
      } else {
        logger.log('Not enough data, continue reading from the socket');
      }
    };
  }

  return {
    download: download,
    upload: upload
  };
}()));
