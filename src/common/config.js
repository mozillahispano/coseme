CoSeMe.namespace('config', (function(){
  'use strict';

  return {
    logger: true,

    domain: 's.whatsapp.net',

    groupDomain: 'g.us',

    tokenData: {

      "v": "2.11.453",
      // should be tokenData[d] + - + tokenData[v] + - + port
      "r": "Android-2.11.453-5222",
      "u": "WhatsApp/2.11.453 Android/4.3 Device/GalaxyS3",
      "t": "PdA2DJyKoUrwLw1Bg6EIhzh502dF9noR9uFCllGk1377032097395{phone}",
      "d": "Android"
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
