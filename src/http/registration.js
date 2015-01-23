CoSeMe.namespace('registration', (function(){
  'use strict';

  function getToken(phone) {
    return CryptoJS.MD5("PdA2DJyKoUrwLw1Bg6EIhzh502dF9noR9uFCllGk1418865329241"+phone).toString();
  }


  function getRealDeviceId(aSeed) {
    var seed = aSeed || (Math.random() * 1e16).toString(36).substring(2, 10);
    var id = CryptoJS.SHA1(seed).toString(CryptoJS.enc.Latin1).substring(0, 20)
      .split('').map(function (e) {
        return String.fromCharCode(e.charCodeAt(0) % 128)
      }).join('');
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
    getCode: function(countryCode, phone, onready, onerror, deviceId, mcc, mnc, locale, method) {
      var params = Object.create(null);
      params['cc'] = countryCode;
      params['in'] = phone;
      params['lc'] = 'GB';
      params['lg'] = 'en';
      params['mcc'] = '000';
      params['mnc'] = '000';
      params['sim_mcc'] = pad(mcc, 3);
      params['sim_mnc'] = pad(mnc, 3);
      params['method'] = method in {'sms': 1, 'voice': 1} ? method : 'sms';
      var seedAndId = getRealDeviceId(deviceId);
      params['id'] = seedAndId.id;
      params['network_radio_type'] = '1';
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
