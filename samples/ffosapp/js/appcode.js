/*************************************************************
 * Rename the file config.json.sample to config.json and add
 * your credentials there.
 *************************************************************/

(function init() {
  var Yowsup = CoSeMe.yowsup;
  var SI = Yowsup.getSignalsInterface();
  var MI = Yowsup.getMethodsInterface();

  // Exporting to window
  window.SI = SI;
  window.listen = SI.registerListener.bind(MI);
  window.MI = MI;
  window.call = MI.call.bind(SI);

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'config.json', false);
  xhr.overrideMimeType('application/json');
  try {
    xhr.send();
    window.config = JSON.parse(xhr.responseText) || {};
  } catch (x) {
    window.config = {};
  }

  var testdata = {
    ccNumber: config.cc || '34',
    phoneNumber: config.user ? config.user : '',
    password: config.password || '',
    contactsToQuery: config.friend || '',
    seed: config.seed || ''
  }
  var ccLength = testdata.ccNumber.length;
  testdata.phoneNumber = testdata.phoneNumber.substr(ccLength);
  testdata.contactsToQuery = testdata.contactsToQuery.substr(ccLength);

  if (testdata.ccNumber != "")
    document.getElementById('country-code-input').value = testdata.ccNumber;
  if (testdata.phoneNumber != "")
    document.getElementById('phone-number-input').value = testdata.phoneNumber;
  if (testdata.contactsToQuery != "")
    document.getElementById('contacts-input').value = testdata.contactsToQuery;
  if (testdata.id != "")
    document.getElementById('wa-id-input').value = testdata.seed;
}());

/*************************************************************
 * Environment tests
 *************************************************************/

var xhrTestButton = document.getElementById('xhr-test-button');
xhrTestButton.addEventListener('click', function() {
  var xhr = new XMLHttpRequest({mozAnon: false, mozSystem: true});
  xhr.onload = function() {
    var matching =
      this.responseText.match(/id="body_lbUserAgent">(.*?)</m);
    document.getElementById('xhr-result').textContent = matching[1]
  };
  xhr.open('GET', 'http://www.whatsmyuseragent.com/');
  xhr.setRequestHeader('User-Agent', 'Brap!');
  xhr.send();
});

/*************************************************************
 * Registration tests
 *************************************************************/

var registration = CoSeMe.registration;

var requestSMSButton = document.getElementById('request-sms-button');
requestSMSButton.addEventListener('click', function() {
  var results = document.getElementById('sms-result');
  results.textContent = '';

  // Get phone
  var countryCode = document.getElementById('country-code-input').value.trim();
  var phone = document.getElementById('phone-number-input').value.trim();
  var deviceId = document.getElementById('wa-id-input').value.trim() || undefined;

  if (!phone || !countryCode) {
    alert('Provide the country code and phone number.');
    return;
  }

  deviceId = registration.getCode(countryCode, phone, logResult, logError, deviceId);
  results.textContent = "DeviceId: [" + deviceId +"]. ";

  function logResult(response) {
    results.textContent += 'SUCCESS:\n' + JSON.stringify(response);

    // If we're already registered, we'll receive the login & password
    document.getElementById('contacts-login-input').value = response.login;
    document.getElementById('contacts-passwd-input').value = response.pw;
  }

  function logError() {
    results.textContent = 'Error: the server returned with error:\n' +
                          this.statusText;
  }
});

var registerButton = document.getElementById('register-button');
registerButton.addEventListener('click', function() {
  var results = document.getElementById('register-result');
  results.textContent = '';

  // Get phone
  var countryCode = document.getElementById('country-code-input').value.trim();
  var phone = document.getElementById('phone-number-input').value.trim();
  var deviceId = document.getElementById('wa-id-input').value.trim() || undefined;
  var registerCode =
    document.getElementById('register-code-input').value.trim();
  if (!phone || !countryCode || !registerCode) {
    alert(
      'Provide the country code, the phone number and the WA provided code.');
    return;
  }

  // Sanitize the code
  registerCode = registerCode.replace(/\-/g, '');

  registration.register(countryCode, phone, registerCode, logResult, logError, deviceId);

  function logResult(response) {
    results.textContent = 'login: ' + response.login + '\n' +
                          'password: ' + response.pw;
    document.getElementById('contacts-login-input').value = response.login;
    document.getElementById('contacts-passwd-input').value = response.pw;
  }

  function logError() {
    results.textContent = 'Error: the server returned with error:\n' +
                          this.statusText;
  }
});

/*************************************************************
 * Contacts tests
 *************************************************************/


/*************************************************************
 * Media tests
 *************************************************************/
var media = CoSeMe.media;

var gBlob;
var downloadButton = document.getElementById('download-button');
downloadButton.addEventListener('click', function() {
  var downloadArea = document.getElementById('download-result');
  media.download('https://www.google.es/images/srpr/logo4w.png',
  function onSuccess(blob) {
    gBlob = blob;
    downloadArea.textContent += blob + '\n';
  },
  function onError(e) {
    downloadArea.textContent += e + '\n';
  },
  function onProgress(pr) {
    downloadArea.textContent += 'PR=' + pr + '\n';
  });
});

var uploadButton = document.getElementById('upload-button');
uploadButton.addEventListener('click', function() {
  var uploadArea = document.getElementById('upload-result');
  media.upload(config.friend + '@s.whatsapp.net', gBlob, 'https://www.google.es/images/srpr/logo4w.png',
    function onSuccess(url) {
      uploadArea.textContent += 'Got a url' + url + '\n';
    },
    function onError(e) {
      uploadArea.textContent += e + '\n';
    },
    function onProgress(pr) {
      uploadArea.textContent += 'PR=' + pr + '\n';
    }
  );
});
