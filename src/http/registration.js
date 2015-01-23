CoSeMe.namespace('registration', (function(){
  'use strict';

  function getToken(phone) {
    var plain = 'PdA2DJyKoUrwLw1Bg6EIhzh502dF9noR9uFCllGk1418865329241' + phone;
    var data = CryptoJS.enc.Latin1.parse(plain);
    var output = CryptoJS.MD5(data);
    return output.toString();
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
    getCode: function(countryCode, phone, onready, onerror, deviceId, mcc, mnc, locale, method) {
      var params = Object.create(null);
      params['cc'] = countryCode;
      params['in'] = phone;
      params['lc'] = 'zz';
      params['lg'] = locale.split('-')[0] || 'en';
      params['mcc'] = pad(mcc, 3);
      params['mnc'] = pad(mnc, 3);
      params['sim_mcc'] = pad(mcc, 3);
      params['sim_mnc'] = pad(mnc, 3);
      params['method'] = method in {'sms': 1, 'voice': 1} ? method : 'sms';
      var seedAndId = getRealDeviceId(deviceId);
      params['id'] = seedAndId.id;
      //params['reason'] = 'self-send-jailbroken';
      params['network_radio_type'] = '1';

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
