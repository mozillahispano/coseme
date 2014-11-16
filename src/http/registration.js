CoSeMe.namespace('registration', (function(){
  'use strict';

  function getToken(phone) {
    var signature = atob(
      'MIIDMjCCAvCgAwIBAgIETCU2pDALBgcqhkjOOAQDBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFDASBgNVBAcTC1NhbnRhIENsYXJhMRYwFAYDVQQKEw1XaGF0c0FwcCBJbmMuMRQwEgYDVQQLEwtFbmdpbmVlcmluZzEUMBIGA1UEAxMLQnJpYW4gQWN0b24wHhcNMTAwNjI1MjMwNzE2WhcNNDQwMjE1MjMwNzE2WjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEUMBIGA1UEBxMLU2FudGEgQ2xhcmExFjAUBgNVBAoTDVdoYXRzQXBwIEluYy4xFDASBgNVBAsTC0VuZ2luZWVyaW5nMRQwEgYDVQQDEwtCcmlhbiBBY3RvbjCCAbgwggEsBgcqhkjOOAQBMIIBHwKBgQD9f1OBHXUSKVLfSpwu7OTn9hG3UjzvRADDHj+AtlEmaUVdQCJR+1k9jVj6v8X1ujD2y5tVbNeBO4AdNG/yZmC3a5lQpaSfn+gEexAiwk+7qdf+t8Yb+DtX58aophUPBPuD9tPFHsMCNVQTWhaRMvZ1864rYdcq7/IiAxmd0UgBxwIVAJdgUI8VIwvMspK5gqLrhAvwWBz1AoGBAPfhoIXWmz3ey7yrXDa4V7l5lK+7+jrqgvlXTAs9B4JnUVlXjrrUWU/mcQcQgYC0SRZxI+hMKBYTt88JMozIpuE8FnqLVHyNKOCjrh4rs6Z1kW6jfwv6ITVi8ftiegEkO8yk8b6oUZCJqIPf4VrlnwaSi2ZegHtVJWQBTDv+z0kqA4GFAAKBgQDRGYtLgWh7zyRtQainJfCpiaUbzjJuhMgo4fVWZIvXHaSHBU1t5w//S0lDK2hiqkj8KpMWGywVov9eZxZy37V26dEqr/c2m5qZ0E+ynSu7sqUD7kGx/zeIcGT0H+KAVgkGNQCo5Uc0koLRWYHNtYoIvt5R3X6YZylbPftF/8ayWTALBgcqhkjOOAQDBQADLwAwLAIUAKYCp0d6z4QQdyN74JDfQ2WCyi8CFDUM4CaNB+ceVXdKtOrNTQcc0e+t'
    );
    var classesMd5 = atob('6AFrxlvRhUKoSxdMjnYATg==');
    var key2 = atob('/UIGKU1FVQa+ATM2A0za7G2KI9S/CwPYjgAbc67v7ep42eO/WeTLx1lb1cHwxpsEgF4+PmYpLd2YpGUdX/A2JQitsHzDwgcdBpUf7psX1BU=');
    var data = CryptoJS.enc.Latin1.parse(signature + classesMd5 + phone);

    var opad = new Uint8Array(64);
    var ipad = new Uint8Array(64);
    for (var i = 0; i < 64; i++) {
      opad[i] = 0x5C ^ key2.charCodeAt(i);
      ipad[i] = 0x36 ^ key2.charCodeAt(i);
    }
    ipad = CryptoJS.enc.UInt8Array.parse(ipad);
    opad = CryptoJS.enc.UInt8Array.parse(opad);

    var output = CryptoJS.SHA1(
      opad.concat(CryptoJS.SHA1(ipad.concat(data)))
    );

    return output.toString(CryptoJS.enc.Base64);
  }

  function getRealDeviceId(aSeed) {
    var seed = aSeed || (Math.random() * 1e16).toString(36).substring(2, 10);
    var id = CryptoJS.SHA1(seed).toString(CryptoJS.enc.Latin1).substring(0, 20);
    return {
      seed: seed,
      id: id
    };
  }

  function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

  return {
    getCode: function(countryCode, phone, onready, onerror, deviceId, mcc, mnc, locale) {
      var params = Object.create(null);
      params['cc'] = countryCode;
      params['in'] = phone;
      params['lc'] = 'zz';
      params['lg'] = locale.split('-')[0] || 'en';
      params['sim_mcc'] = pad(mcc, 3);
      params['sim_mnc'] = pad(mnc, 3);
      params['method'] = 'sms';
      var seedAndId = getRealDeviceId(deviceId);
      params['id'] = seedAndId.id;
      params['reason'] = 'self-send-jailbroken';

      // Get token
      params['token'] = getToken(phone);

      CoSeMe.http.doRequest('code', params, onready, onerror);
      return seedAndId.seed; // Return the deviceId we've used in case we want to store it.
    },

    register: function(countryCode, phone, registerCode, onready, onerror, deviceId) {
      // Set parameters
      var params = Object.create(null);
      params['cc'] = countryCode;
      params['in'] = phone;
      params['code'] = registerCode;
      var seedAndId = getRealDeviceId(deviceId);
      params['id'] = seedAndId.id;

      CoSeMe.http.doRequest('register', params, onready, onerror);
      return seedAndId.id; // Return the deviceId we've used in case we want to store it.
    }
  };
}()));
