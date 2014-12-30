CoSeMe.namespace('media', (function() {
  'use strict';

  var logger = new CoSeMe.common.Logger('media');

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

    var xhr = new XMLHttpRequest({mozSystem: true});

    function onCryptoReady(crypto, blobAsArrayBuffer) {
      var formData = new FormData();
      formData.append('to', toJID);
      formData.append('from', CoSeMe.yowsup.connectionmanager.jid.replace('@whatsapp.net', ''));
      formData.append('file', blob, crypto);

      xhr.open('POST', uploadUrl);
      xhr.responseType = 'json';
      xhr.setRequestHeader('User-Agent', CoSeMe.config.tokenData.u);
      xhr.send(formData);
    }

    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable) {
        progressCb((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = function(event) {
      logger.log('Got some data!');

      if (xhr.status === 200) {
        if (progressCb) {
            progressCb(100);
        }

        var json = xhr.response;
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
      } else {
        logger.log('Got error status:', xhr.status);
      }

      // Let's close the socket and remove the errorCb handler
      errorCb = undefined;
    };

    xhr.onerror = function(event) {
      errorCb('Got upload error!');
    };
  }

  return {
    download: download,
    upload: upload
  };
}()));
