(function() {
  'use strict';

  var jid = config.friend + '@' + CoSeMe.config.domain;
  var logger = new CoSeMe.common.Logger('testing');

  var signals = {
    auth_success: null,
    auth_fail: null,
    message_received:
      function ack(msgId, from, data, timestamp, wantsReceipt) {
        wantsReceipt && MI.call('message_ack', [from, msgId]);
        ok('message_ack');
      },

    image_received: null,
    vcard_received: null,
    video_received: null,
    audio_received: null,
    location_received: null,

    message_error: null,

    receipt_messageSent: null,
    receipt_messageDelivered: function (to, id, type, participant, from) {
      MI.call('delivered_ack', [to, id, type, participant, from]);
    },
    receipt_visible: null,
    receipt_broadcastSent: null,
    status_dirty: null,

    presence_updated: null,
    presence_available: null,
    presence_unavailable: null,

    group_subjectReceived: null,
    group_createSuccess: null,
    group_createFail: null,
    group_endSuccess: null,
    group_gotInfo: null,
    group_infoError: null,
    group_addParticipantsSuccess: null,
    group_removeParticipantsSuccess: null,
    group_gotParticipants: null,
    group_setSubjectSuccess: null,
    group_messageReceived:
      function ack(msgId, from, author, data, timestamp, wantsReceipt) {
        wantsReceipt && MI.call('message_ack', [from, msgId]);
        ok('message_ack');
      },

    group_imageReceived: null,
    group_vcardReceived: null,
    group_videoReceived: null,
    group_audioReceived:
      function ack(msgId, from, preview, url, size, wantsReceipt) {
        wantsReceipt && MI.call('message_ack', [from, msgId]);
        ok('message_ack');
      },

    group_locationReceived: null,
    group_setPictureSuccess: null,
    group_setPictureError: null,
    group_gotPicture: null,
    group_gotGroups: null,

    notification_contactProfilePictureUpdated: null,
    notification_contactProfilePictureRemoved: null,
    notification_groupPictureUpdated: null,
    notification_groupPictureRemoved: null,
    notification_groupParticipantAdded: null,
    notification_groupParticipantRemoved: null,

    contact_gotProfilePictureId: null,
    contact_gotProfilePicture: null,
    contact_typing: null,
    contact_paused: null,
    contacts_sync: null,
    contacts_gotStatus: null,

    profile_setPictureSuccess: null,
    profile_setPictureError: null,
    profile_setStatusSuccess: null,

    ping: null,
    pong: null,
    disconnected: null,

    media_uploadRequestSuccess: null,
    media_uploadRequestFailed: null,
    media_uploadRequestDuplicate: null,
  };

  Object.keys(signals).forEach(function(signal) {
    var customCallback = signals[signal] || nop;
    SI.registerListener(signal, logCallback.bind(null, signal, customCallback));
  });

  function nop() {}

  var htmlLog = document.getElementById('addHere');
  function log(msg) {
    htmlLog.appendChild(document.createTextNode(msg + '\n'));
  }

  function logCallback(signal, customCallback) {
    var args = [].slice.call(arguments, 2);
    var msg =
      '<< SIGNAL `' + signal + '` with arguments: ' + JSON.stringify(args);
    log(msg);
    logger.log(msg);
    ok(signal);
    customCallback.apply(this, args);
  }

  function testAuth(onlyAuth, callback) {
    var method = 'auth_login';
    var params = [config.user, config.password];

    SI.registerListener('auth_success', function() {
      ok(method);
      MI.call('presence_sendAvailableForChat', ['Keko']);
      !onlyAuth && runOtherTests();
      callback && callback();
    });

    SI.registerListener('auth_fail', function() {
      fail(method);
    });

    MI.call(method, params);
  }

  function runOtherTests() {
    testMessageSend();
    testGroups();
    setTimeout(testMediaSend, 2000, 'wasaokase.jpg', 'image');
    setTimeout(testMediaSend, 6000, 'horse.ogg', 'audio');
    setTimeout(testMediaSend, 10000, 'small.ogv', 'video');
  }

  function testMessageSend() {
    var method = 'message_send';
    var params = [jid, 'ñoño'];
    var timeout;

    SI.registerListener('receipt_messageDelivered', function() {
      ok(method);
      clearTimeout(timeout);
    });

    timeout = setTimeout(fail, 5000, method);

    MI.call(method, params);
  }

  var gid;
  function testGroups() {
    var subject = 'Group at ' + Date.now();
    var method = 'group_create';
    var params = [subject];
    MI.call(method, params);
    SI.registerListener('group_createSuccess', function(groupId) {
      gid = groupId;
      ok(method);

      // Set the picture for the group
      CoSeMe.media.download('wasaokase.jpg', function _onBlob(blob) {
        var fr = new FileReader();
        fr.onloadend = function() {
          MI.call('group_setPicture', [gid, fr.result, fr.result]);
          addParticipant();
        }
        fr.readAsArrayBuffer(blob);
      });
    });
  }

  function addParticipant() {
    var method = 'group_addParticipants';
    var params = [gid, [jid]];
    MI.call(method, params);
    SI.registerListener('group_addParticipantsSuccess', function() {
      ok(method);
      sendGroupMessage();
    });
  }

  function sendGroupMessage() {
    MI.call('message_send', [gid, 'ñoño']);
    SI.registerListener('receipt_messageSent', function(from) {
      if (from === gid) {
        ok('group-send-message');
        groupGetParticipants();
      }
    });
  }

  function groupGetParticipants() {
    var method = 'group_getParticipants';
    var params = [gid];
    MI.call(method, params);
    SI.registerListener('group_gotParticipants', function() {
      ok(method);
      changeGroupSubject();
    });
  }

  function changeGroupSubject() {
    var method = 'group_setSubject';
    var params = [gid, 'Ending group'];
    MI.call(method, params);
    SI.registerListener('group_setSubjectSuccess', function() {
      ok(method);
      getGroupInfo();
    });
  }

  function getGroupInfo() {
    var method = 'group_getInfo';
    var params = [gid];
    MI.call(method, params);
    SI.registerListener('group_gotInfo', function() {
      ok(method);
      removeParticipant();
    });
  }

  function removeParticipant() {
    var method = 'group_removeParticipants';
    var params = [gid, [jid]];
    MI.call(method, params);
    SI.registerListener('group_removeParticipantsSuccess', function() {
      ok(method);
      endGroup();
    });
  }

  function endGroup() {
    var method = 'group_end';
    var params = [gid];
    MI.call(method, params);
    SI.registerListener('group_endSuccess', function() {
      ok(method);
    });
  }

  document.querySelector('[data-test="reconnect"] button')
  .onclick = function() {
    var conn = CoSeMe.connection.Connection();
    SI.registerListener('disconnected', function() {
      testAuth(true, function() {
        ok('reconnect');
      });
    });
    conn.socket.close(); // force to close
  };

  document.querySelector('[data-test="typing_send"] button')
  .onclick = function() {
    var method = 'typing_send';
    var params = [jid];
    installManualOk(method);

    MI.call(method, params);
  };

  document.querySelector('[data-test="typing_paused"] button')
  .onclick = function() {
    var method = 'typing_paused';
    var params = [jid];
    installManualOk(method, function() {
      MI.call(method, params);
    });

    MI.call(method, params);
  };

  document.querySelector('[data-test="profile_setStatus"] button')
  .onclick = function() {
    var method = 'profile_setStatus';
    var params = ['Working at ' + new Date()];
    installManualOk(method, function() {
      MI.call(method, params);
    });

    MI.call(method, params);
  };

  document.querySelector('#contacts-button')
  .onclick = function() {
    var jids, params = [
      document.getElementById('contacts-input').value.trim().split(',')
    ];
    if (params.length === 0) return;
    jids = params[0].map(function (phone) {
      return config.cc + phone + '@' + CoSeMe.config.domain;
    });
    MI.call('contacts_sync', params);
    MI.call('contacts_getStatus', [jids]);
    jids.forEach(function (jid) {
      MI.call('presence_request', [jid]);
    });
  };

  var mediaStore = {};

  // Step 01: Retrieve media and get the WA URL
  function testMediaSend(url, type) {
    var method = 'media_requestUpload';
    var testName = method + '-' + type;

    CoSeMe.media.download(url,
      function onLoad(blob) {
        saveBlob(blob);
      },
      function onError(err) {
        console.error('Problem loading test image ' + url);
        fail(testName);
      }
    );

    function saveBlob(blob) {
      var blobReader = new FileReader();
      blobReader.onloadend = function() {
        var binaryData = blobReader.result;
        var sha256 = CryptoJS.SHA256(binaryData).toString(CryptoJS.enc.Base64);
        mediaStore[sha256] = {
          name: url,
          sha256: sha256,
          type: type,
          size: blob.size,
          blob: blob
        };

        requestURL(mediaStore[sha256]);
      };

      blobReader.onerror = function() {
        console.error('Problem reading the blob for the test image.');
        fail(testName);
      };

      blobReader.readAsBinaryString(blob);
    }

    function requestURL(mediaData) {
      var params = [mediaData.sha256, mediaData.type, mediaData.size];

      SI.registerListener('media_uploadRequestSuccess', function(sha, url) {
        ok(testName);
        uploadMedia(sha, url);
      });

      try {
        MI.call(method, params);
      } catch (x) {
        fail(testName);
      }
    }
  }

  // Step 02: upload the media
  function uploadMedia(sha, url) {
    var testName = 'post-' + mediaStore[sha].type;
    CoSeMe.media.upload(jid, mediaStore[sha].blob, url,
      function onSuccess(downloadURL) {
        logger.log('Media available in ' + downloadURL);
        ok(testName);
        sendMedia(sha, downloadURL);
      },
      function onError() {
        fail(testName);
      }
    );
  }

  // Step 03: send the media
  function sendMedia(sha, url) {
    var mediaData = mediaStore[sha];
    var type = mediaData.type;
    var testName = 'send-' + type;
    var params = [jid, url, mediaData.name, mediaData.size];
    MI.call('message_' + type + 'Send', params);
    installManualOk(testName);
  }

  function ok(method) {
    var element =
      document.querySelector('[data-test="' + method + '" ] span');
    if (!element) return;
    element.innerHTML = 'OK!';
    logger.log('[V] Testing `' + method + '` OK!');
  }

  function fail(method) {
    var element =
      document.querySelector('[data-test="' + method + '"] span');
    element.innerHTML = 'FAIL!';
    logger.log('[X] Testing `' + method + '` FAIL!');
  }

  function installManualOk(method, callback) {
    var button = document.querySelector('[data-test="' + method + '"] ' +
                                        'button.verification');
    if (button) {
      button.onclick = function() {
        ok(method);
        callback && callback();
      };
    }
  };

  CoSeMe.common.Logger.disableAll();
  CoSeMe.common.Logger.enable('BinaryReader');
  CoSeMe.common.Logger.enable('BinaryWriter');
  testAuth(true);
}());
