CoSeMe.namespace('config', (function(){
  'use strict';

  return {
    logger: true,

    domain: 's.whatsapp.net',

    groupDomain: 'g.us',

    tokenData: {

      "v": "2.12.60",
      // should be tokenData[d] + - + tokenData[v] + - + port
      "r": "S40-2.12.60-5222",
      "u": "WhatsApp/2.12.60 S40Version/14.26 Device/Nokia302",
      "d": "Nokia302"
    },

    auth: {
      host: 'c2.whatsapp.net',
      port: 5222,
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
    }
  }
}()));
