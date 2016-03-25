CoSeMe.namespace('config', (function(){
  'use strict';

  var version = localStorage.getItem('userAgentVersion') || '2.13.9';

  function getTokenData() {
    return {
      "v": version,
      // XXX: it is tokenData[d] + - + tokenData[v] + - + port
      "r": "S40-" + version,
      "u": "WhatsApp/" + version + " S40Version/14.26 Device/Nokia302",
      "d": "S40"
    };
  }

  return {
    logger: true,

    customLogger: null,

    domain: 's.whatsapp.net',

    groupDomain: 'g.us',

    versionSource: 'https://coderus.openrepos.net/whitesoft/whatsapp_scratch',

    tokenData: getTokenData(),

    auth: {
      host: 'c2.whatsapp.net',
      port: 443,
//      host: 'localhost',
//      port: 8080,
      connectionOptions: {
        binaryType: 'arraybuffer',
        useSSL: false,
        useSecureTransport: false
      },
      rc4Options: {
        drop: 768/4
      },
      pbkdf2Options: {
        keySize: (20*8) / 32,
        iterations: 2
      },
      hmacLength: 4
    },

    contacts: {
      "url_auth": "https://sro.whatsapp.net/v2/sync/a",
      "url_query": "https://sro.whatsapp.net/v2/sync/q",
      "method": "POST",
      "authData": {
        "nc": "00000001",
        "realm": "s.whatsapp.net",
        "qop": "auth",
        "digestUri": "WAWA/s.whatsapp.net",
        "charSet": "utf-8",
        "authMethod": "X-WAWA"
      }
    },

    updateUserAgentVersion: function(callback) {
      var _this = this;
      var xhr = new XMLHttpRequest({mozSystem: true});
      xhr.open('GET', this.versionSource);
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'text/json');
      xhr.addEventListener('load', function() {
        if (this.response.e && this.response.e.match(/^([\d]+(\.[\d]+)*)+$/)) {
          version = this.response.e;
          localStorage.setItem('userAgentVersion', version);

          _this.tokenData = getTokenData(); // refresh version in config data
        }
        callback && callback();
      });
      xhr.addEventListener('error', function() {
        callback && callback();
      });
      xhr.send();
    }
  };
}()));
