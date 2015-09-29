CoSeMe.namespace('yowsup', (function() {
  'use strict';

  var stringFromUtf8 = CoSeMe.utils.stringFromUtf8;
  var utf8FromString = CoSeMe.utils.utf8FromString;

  var logger = new CoSeMe.common.Logger('yowsupAPI');

  function registerListener(aSignal, aListener) {
    // Listeners are actually a list...
    if (aSignal in CoSeMe.yowsup.connectionmanager.signals) {
      CoSeMe.yowsup.connectionmanager.signals[aSignal].push(aListener);
    }
  }

  function call(aMethod, aParams) {
    try {
      return CoSeMe.yowsup.connectionmanager.methods[aMethod].apply(undefined, aParams);
    } catch (x) {
      logger.error('Error invoking', aMethod, 'with', aParams);
      logger.error('Error details:', x);
      throw x;
    }
  }

  function getSignalsInterface() {
    return {
      registerListener: registerListener
    };
  }

  function getMethodsInterface() {
    return {
      call: call,

      // This isn't defined on the doc...
      registerCallback: function(aMethod, aHandler) {
        CoSeMe.yowsup.connectionmanager.methods[aMethod] = aHandler;
      }
    };
  }


  return {
    getSignalsInterface: getSignalsInterface,
    getMethodsInterface: getMethodsInterface
  };

// signalsInterface = y.getSignalsInterface()
// methodsInterface = y.getMethodsInterface()
// signalsInterface.registerListener('auth_success', onAuthSuccess)
// methodsInterface.call('auth_login', ('username', 'password'))


}()));

CoSeMe.namespace('yowsup.readerThread', (function() {
  'use strict';

  var stringFromUtf8 = CoSeMe.utils.stringFromUtf8;
  var utf8FromString = CoSeMe.utils.utf8FromString;

  var logger = new CoSeMe.common.Logger('ReaderThread');

  var _requests = [];

  var _lastPongTime = 0;
  var _pingInterval = 120;

  // _connection.socket should be a socket though
  var _connection = null;
  var _signalInterface;

  var ProtocolTreeNode = CoSeMe.protocol.Tree;


  var processNode = {
    result: function(iqType, idx, node) {
      var props = node.getChild('props');
      if (props) {
        getProperties(props.getAllChildren());
      }
      else if (idx in _requests) {
        _requests[idx](node);
        delete _requests[idx];
      }
    },

    error: function(iqType, idx, node) {
      if (idx in _requests) {
        _requests[idx](node);
        delete _requests[idx];
      }
    },

    get: function(iqType, idx, node) {
      var childNode = node.getChild(0);
      if (node.getAttributeValue('xmlns') === 'urn:xmpp:ping') {
        _signalInterface.onPing && _signalInterface.onPing(idx);
        _signalInterface.send('ping', [idx]);
      } else if (ProtocolTreeNode.tagEquals(childNode,'query') &&
                 node.getAttributeValue('from') &&
                 'http://jabber.org/protocol/disco#info' == childNode.getAttributeValue('xmlns')) {
        var pin = childNode.getAttributeValue('pin');
        var timeoutString = childNode.getAttributeValue('timeout');
        if (pin) {
          // TO-DO! I can't find the code for this anywhere!
          // self.eventHandler.onRelayRequest(pin,timeoutSeconds,idx)
        }
      }
    },

    set: function(iqType, idx, node) {
      // As far as I know thid doesn't actually DO anything...
      var childNode = node.getChild(0);
      if (ProtocolTreeNode.tagEquals(childNode,'query')) {
        var xmlns = childNode.getAttributeValue('xmlns');

        if (xmlns == 'jabber:iq:roster') {
          var itemNodes = childNode.getAllChildren('item');
          itemNodes.forEach(function (itemNode) {
            var jid = itemNode.getAttributeValue('jid');
            var subscription = itemNode.getAttributeValue('subscription');
            var ask = itemNode.getAttributeValue('ask');
          });
        }
      }
    }
  };

  function getProperties(propertyNodes) {
    var properties = {};
    var stringProperties = {};
    propertyNodes.forEach(function (node) {
      var name = node.getAttributeValue('name');
      if (name) {
        properties[name] = node.getAttributeValue('value');
        if (!stringProperties[name]) {
          properties[name] = parseInt(properties[name], 10);
        }
      }
    });
    _signalInterface.send('got_properties', [properties]);
  }

  function onError(evt) {
    var reason = evt.data;
    logger.error('Socket error due to:', evt, '!');
    _signalInterface.send('disconnected', [reason]);
  }

  /**
   * This is attached to reader.onTree when authenticate success.
   */
  function handleNode(err, node) {
    try {

      if (ProtocolTreeNode.tagEquals(node, 'iq')) {
        var iqType = node.getAttributeValue('type');
        var idx = node.getAttributeValue('id') || '';
        if (!iqType || !processNode[iqType]) {
          var error = 'Invalid or missing iq type: ' + iqType;
          throw error;
        }
        processNode[iqType](iqType, idx, node);

      } else if (ProtocolTreeNode.tagEquals(node,'presence')) {
        var xmlns = node.getAttributeValue('xmlns');
        var jid = node.getAttributeValue('from');

        if (!xmlns || ((xmlns == 'urn:xmpp') && jid )) {
          var presenceType = node.getAttributeValue('type');
          if (presenceType == 'unavailable') {
            var last = node.getAttributeValue('last');
            _signalInterface.send('presence_unavailable', [jid, last && parseInt(last, 10)]);
          } else if (!presenceType || (presenceType == 'available')) {
            _signalInterface.send('presence_available', [jid]);
          }
        } else if (xmlns == 'w' && jid) {
          var status = stringFromUtf8(node.getAttributeValue('status'));

          if (status == 'dirty') {
            //categories = self.parseCategories(node); #@@TODO, send along with signal
            logger.log('Will send DIRTY');
            _signalInterface.send('status_dirty');
            logger.log('DIRTY sent');
          }
        }

      } else if (ProtocolTreeNode.tagEquals(node, 'message')) {
        parseMessage(node);

      } else if (ProtocolTreeNode.tagEquals(node, 'receipt')) {
        var toAttribute = node.getAttributeValue('to');
        var fromAttribute = node.getAttributeValue('from');
        var msgId = node.getAttributeValue('id');
        var type = node.getAttributeValue('type');
        var participant = node.getAttributeValue('participant');

        if (!fromAttribute || !msgId) {
          logger.error('Malformed receipt, can not determine the origin.');
          return;
        }

        var params = [
          fromAttribute,
          msgId,
          type,
          participant,
          toAttribute
        ];

        if (fromAttribute == "s.us") {
          _signalInterface.send("profile_setStatusSuccess", ["s.us", msgId]);
          return;
        }
        _signalInterface.send("receipt_messageDelivered", params);
        return;

      } else if (ProtocolTreeNode.tagEquals(node, 'chatstate')) {
        var from = node.getAttributeValue('from');
        var signal;
        if (node.getChild('composing')) {
          signal = 'contact_typing';

        } else if (node.getChild('paused')) {
          signal = 'contact_paused';

        }
        _signalInterface.send(signal, [from])

      } else if (ProtocolTreeNode.tagEquals(node, 'ack')) {
        var klass = node.getAttributeValue('class');
        var from = node.getAttributeValue('from');
        var id = node.getAttributeValue('id');
        if (klass === 'message' && from) {
          _signalInterface.send('receipt_messageSent', [from, id]);
        }

      } else if (ProtocolTreeNode.tagEquals(node, 'notification')) {
        var type = node.getAttributeValue('type');
        var from = node.getAttributeValue('from');
        var timestamp = parseInt(node.getAttributeValue("t"), 10);
        var msgId = node.getAttributeValue('id');

        if (type === 'participant') {
          var notification = 'notification_groupParticipant';
          var action = node.getChild(0).tag;
          var jid = node.getChild(0).getAttributeValue('jid');

          if (action === 'add') {
            notification += 'Added';

          } else if (action === 'remove') {
            notification += 'Removed';

          } else {
            console.error('Participant notification not understood');
          }

          _signalInterface
            .send(notification, [from, jid, null, timestamp, msgId, null]);

        } else if (type === 'picture') {
          var prefix = from.indexOf('-') >= 0 ? 'group' : 'contactProfile';
          var notification = 'notification_' + prefix + 'Picture';
          var action = node.getChild(0).tag;
          var pictureId = node.getChild(0).getAttributeValue('id');
          var author = node.getChild(0).getAttributeValue('author');

          if (action === 'set') {
            notification += 'Updated';

          } else if (action === 'delete') {
            notification += 'Removed';

          } else {
            console.error('Picture notification not understood');
          }

          _signalInterface
            .send(notification, [from, timestamp, msgId, pictureId, author]);
        }
        else if (type === 'subject') {
          var displayName = node.getAttributeValue('notify');
          var notification = 'notification_group';
          var bodyNode = node.getChild(0);
          var author = node.getAttributeValue('participant');
          notification += bodyNode.getAttributeValue('event') === 'add' ?
                          'Created' : 'SubjectUpdated';

          var subject = stringFromUtf8(bodyNode.data);

          _signalInterface
            .send(notification, [from, timestamp, msgId, subject, displayName,
                                 author]);
        }
        else if (type === 'status') {
          var bodyNode = node.getChild(0);
          var status = stringFromUtf8(bodyNode.data);
          _signalInterface.send('notification_status', [from, msgId, status]);
        }
        else {
          // ignore, but at least acknowledge it
          _signalInterface.onUnknownNotification(from, msgId, type);
        }
      }

    } catch (x) {
      logger.error(x);
      // Should probably do something here...
    }
  }

  function parseMessage(messageNode) {
    var bodyNode = messageNode.getChild("body"),
        newSubject = bodyNode ? stringFromUtf8(bodyNode.data) : "",
        msgData = null,
        timestamp = Number(messageNode.getAttributeValue("t")).valueOf(),
        isGroup = false,
        isBroadcast = false,
        fromAttribute = messageNode.getAttributeValue("from"),
        author = messageNode.getAttributeValue("participant"),
        pushName = messageNode.getAttributeValue('notify'),
        msgId = messageNode.getAttributeValue("id"),
        attribute_t = messageNode.getAttributeValue("t"),
        typeAttribute = messageNode.getAttributeValue("type"),
        wantsReceipt = false;

    pushName = pushName && stringFromUtf8(pushName);

    logger.log("Parsing message:",  messageNode);

    function processMedia(childNode) {
      var mediaUrl = childNode.getAttributeValue("url");
      var mediaType = childNode.getAttributeValue("type");
      var mediaSize = childNode.getAttributeValue("size");
      var encoding = childNode.getAttributeValue("encoding");
      var mediaPreview = childNode.data;
      var wantsReceipt = true;

      var mediaProcessor = {
        // These functions are surprisingly similar, aren't they?...
        image: function(childNode) {
          if (isGroup) {
            _signalInterface.send("group_imageReceived",
                                  [msgId, fromAttribute, author, mediaPreview,
                                  mediaUrl, mediaSize, wantsReceipt]);
          } else {
            _signalInterface.send("image_received", [msgId, fromAttribute, mediaPreview, mediaUrl,
                                                     mediaSize, wantsReceipt, isBroadcast]);
          }
        },

        video: function(childNode) {
          if (isGroup) {
            _signalInterface.send("group_videoReceived",
                                  [msgId, fromAttribute, author, mediaPreview, mediaUrl,
                                   mediaSize, wantsReceipt]);
          } else {
            _signalInterface.send("video_received", [msgId, fromAttribute, mediaPreview,
                                                     mediaUrl, mediaSize, wantsReceipt, isBroadcast]);
          }
        },


        audio: function(childNode) {
          if (isGroup) {
            _signalInterface.send("group_audioReceived",
                                  [msgId, fromAttribute, author,
                                  mediaUrl, mediaSize, wantsReceipt]);
          } else {
            _signalInterface.send("audio_received",
                                  [msgId, fromAttribute, mediaUrl,
                                  mediaSize, wantsReceipt, isBroadcast]);
          }
        },

        location: function(childNode) {
          logger.log("Location Childnode:", childNode);
          var mlatitude = childNode.getAttributeValue("latitude");
          var mlongitude = childNode.getAttributeValue("longitude");
          var name = stringFromUtf8(childNode.getAttributeValue("name")) || "";

          if (isGroup) {
            _signalInterface.send("group_locationReceived",
                                  [msgId, fromAttribute, author, name, mediaPreview,
                                   mlatitude, mlongitude, wantsReceipt]);
          } else {
            _signalInterface.send("location_received",
                                  [msgId, fromAttribute, name, mediaPreview, mlatitude,
                                  mlongitude, wantsReceipt, isBroadcast]);
          }
        },

        vcard: function(childNode) {
          //#return
          //#mediaItem.preview = messageNode.getChild("media").data
          logger.log("VCARD:", childNode);
          var vcardData = childNode.getChild("vcard").toString();
          var vcardName = stringFromUtf8(
            childNode.getChild("vcard").getAttributeValue("name"));

          if (vcardData) {
            var n = vcardData.indexOf(">") +1;
            vcardData = vcardData.substr(n,vcardData.length - n);
            vcardData = vcardData.replace("</vcard>","");

            if (isGroup) {
                _signalInterface.send("group_vcardReceived",
                                      [msgId, fromAttribute, author, vcardName,
                                       vcardData, wantsReceipt]);
            } else {
              _signalInterface.send("vcard_received",
                                    [msgId, fromAttribute, vcardName,
                                     vcardData, wantsReceipt, isBroadcast]);
            }
          }
        }
      };

      if (encoding == "raw" && mediaPreview) {
        mediaPreview = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(mediaPreview));
      }

      try {
        mediaProcessor[mediaType](childNode);
      } catch (x) {
        logger.error("Unknown media type!", x);
        return;
      }

    }

    function processActive(childNode) {
      var notify_name;
      var stamp_str;
      var xmlns;
      var stamp;
      if (ProtocolTreeNode.tagEquals(childNode,"request")) {
        wantsReceipt = true;
      } else if (ProtocolTreeNode.tagEquals(childNode,"notify")) {
        notify_name = stringFromUtf8(childNode.getAttributeValue("name"));
      } else if (ProtocolTreeNode.tagEquals(childNode,"delay")) {
        xmlns = childNode.getAttributeValue("xmlns");
        if ("urn:xmpp:delay" == xmlns) {
          stamp_str = childNode.getAttributeValue("stamp");
          if (stamp_str) {
            stamp = stamp_str;
            timestamp = self.parseOfflineMessageStamp(stamp)*1000;
          }
        }
      } else if (ProtocolTreeNode.tagEquals(childNode,"x")) {
        xmlns = childNode.getAttributeValue("xmlns");
        if ("jabber:x:event" == xmlns && msgId) {
          if (fromAttribute == "broadcast") {
            _signalInterface.send("receipt_broadcastSent", [msgId]);
          }
        } else if ("jabber:x:delay" == xmlns) {
          return; // #@@TODO FORCED CONTINUE, WHAT SHOULD I DO HERE? #wtf?
          stamp_str = childNode.getAttributeValue("stamp");
          if (stamp_str) {
            stamp = stamp_str;
            timestamp = stamp;
          }
        }
      } else {
        if (ProtocolTreeNode.tagEquals(childNode,"delay") ||
            !ProtocolTreeNode.tagEquals(childNode,"received") || !msgId) {
          return; // WTF-redux
          var receipt_type = childNode.getAttributeValue("type");
          if (!receipt_type || receipt_type == "delivered") {
            _signalInterface.send("receipt_messageDelivered", [fromAttribute, msgId]);
          } else if (receipt_type == "visible") {
            _signalInterface.send("receipt_visible", [fromAttribute, msgId]);
          }
        }
      }
    }

    // This sucks. No, bar that. This raises the bar on sucking... but I don't have
    // neither the time nor the inclination to refactor this now.
    function processChildNode(childNode) {

      if (ProtocolTreeNode.tagEquals(childNode,"request")) {
        wantsReceipt = true;
      } else if (ProtocolTreeNode.tagEquals(childNode,"broadcast")) {
        isBroadcast = true;
      } else if (ProtocolTreeNode.tagEquals(childNode,"media") && msgId) {
        logger.log("Multimedia message!");
        processMedia(childNode);

      } else if (ProtocolTreeNode.tagEquals(childNode, "body") && msgId) {
        msgData = childNode.data;

      } else if (!ProtocolTreeNode.tagEquals(childNode,"active")) {
        processActive(childNode);
      }
    }

    var parser = {
      error: function() {
        var errorNodes = messageNode.getAllChildren("error");
        errorNodes.forEach(function(errorNode) {
        var codeString = errorNode.getAttributeValue("code");
        var errorCode = Number(codeString).valueOf();
          _signalInterface.send("message_error", [data.msgId, data.fromAttribute, errorCode]);
        });
      },

      subject: function() {
        var receiptRequested = false;
        var requestNodes = messageNode.getAllChildren("request");
        receiptRequested = requestNodes.some(function (requestNode) {
          return (requestNode.getAttributeValue("xmlns") == "urn:xmpp:receipts");
        });
        if (newSubject) {
          _signalInterface.send("group_subjectReceived",
                                [msgId, fromAttribute, author, newSubject,
                                 Number(attribute_t).valueOf(),  receiptRequested]);
        }
      },

      text: function() {
        wantsReceipt = false;
        var messageChildren = messageNode.children || [];
        messageChildren.forEach(processChildNode);
      },

      media: function() {
        wantsReceipt = true;
        var messageChildren = messageNode.children || [];
        messageChildren.forEach(processChildNode);
      }
    };

    if (newSubject.contains("New version of WhatsApp Messenger is now available")) {
      logger.log("Rejecting server message");
      return; // #REJECT THIS FUCKING MESSAGE!
    }

    if (fromAttribute.contains('-')) {
      isGroup = true;
    }

    try {
      parser[typeAttribute]();
    } catch (x) {
      logger.error(x);
      throw new Error("Unknown type of message:" + typeAttribute + "!");
    }

    if (msgData) {
      // Change the UTF-8 representation to the internal JS representation
      msgData = stringFromUtf8(msgData);
      wantsReceipt = true;
      if (isGroup) {
        _signalInterface.send("group_messageReceived", [msgId, fromAttribute, author, msgData,
                                                        timestamp, wantsReceipt, pushName]);

      } else {
        _signalInterface.send("message_received", [msgId, fromAttribute, msgData, timestamp,
                                                   wantsReceipt, pushName, isBroadcast]);
      }
    }
  }



  // TO-DO
  function parsePingResponse(node) {
    var idx = node.getAttributeValue("id"); // FIXME: Why this?
    this.lastPongTime = Date.now();
  }

  function parseGroupInfo(node) {
    var jid = node.getAttributeValue("from");
    var groupNode = node.getChild(0);
    if (groupNode.toString().contains('error code')) {
      _signalInterface.send("group_infoError",[0]); // @@TODO replace with real error code
    } else {
      ProtocolTreeNode.require(groupNode,"group");
      //gid = groupNode.getAttributeValue("id");
      var owner = groupNode.getAttributeValue("owner");
      var subject = stringFromUtf8(groupNode.getAttributeValue("subject"));
      var subjectT = groupNode.getAttributeValue("s_t");
      var subjectOwner = groupNode.getAttributeValue("s_o");
      var creation = groupNode.getAttributeValue("creation");

      _signalInterface.send("group_gotInfo",[jid, owner, subject, subjectOwner, subjectT, creation]);
    }
  }

  function parseGetGroups(node) {
    var groups = [];
    var id = node.getAttributeValue('id');
    node.children.forEach(function (groupNode) {
      groups.push({
        gid: groupNode.getAttributeValue('id'),
        subject: stringFromUtf8(groupNode.getAttributeValue('subject'))
      });
    });
    _signalInterface.send('group_gotParticipating', [groups, id]);
  }

  function parseGetPicture(node) {
    var jid = node.getAttributeValue("from");
    var isGroup = jid.contains('-');
    if (node.getAttributeValue('type') === 'error') {
      _signalInterface.send(isGroup ?
                            'group_gotPicture' :
                            'contact_gotProfilePicture', [jid, null, null]);
      return;
    }
    var  pictureNode = node.getChild("picture");
    if (pictureNode) {
      var picture = CoSeMe.utils.latin1ToBlob(pictureNode.data, 'image/jpeg');
      var pictureId = Number(pictureNode.getAttributeValue('id')).valueOf();
      if (isGroup) {
        _signalInterface.send("group_gotPicture", [jid, pictureId, picture]);
      } else {
        _signalInterface.send(
          "contact_gotProfilePicture", [jid, pictureId, picture]);
      }
    }
  }

  function parseGroupCreated(node) {
    var id = node.getAttributeValue('id');
    if (node.getAttributeValue('type') === 'error') {
      var errorCode = node.getChild(0).getAttributeValue('code');
      _signalInterface.send('group_createFail', [errorCode, id]);

    } else {
      var groupNode = node.getChild(0);
      ProtocolTreeNode.require(groupNode, 'group');
      var groupId = groupNode.getAttributeValue('id');
      _signalInterface.send('group_createSuccess', [groupId + '@g.us', id]);
    }
  }

  function parseAddedParticipants(node) {
    var jabberId = node.getAttributeValue("from");
    var jabberIds = [];
    var type, child, addNodes = node.getAllChildren("add");

    for (var i = 0, l = addNodes.length; i < l; i++) {
      child = addNodes[i];
      type = child.getAttributeValue('type');
      if (type === 'success') {
        jabberIds.push(child.getAttributeValue('participant'));
      }
      else {
        logger.log('Failed to add',
                   childCount.getAttributeValue('participant'));
      }
    }

    _signalInterface.send("group_addParticipantsSuccess",
                              [jabberId, jabberIds])
  }

  function parseRemovedParticipants(node) {
    var jabberId = node.getAttributeValue("from");
    var jabberIds = [];
    var type, child, removeNodes = node.getAllChildren("remove");

    for (var i = 0, l = removeNodes.length; i < l; i++) {
      child = removeNodes[i];
      type = child.getAttributeValue('type');
      if (type === 'success') {
        jabberIds.push(child.getAttributeValue('participant'));
      }
      else {
        logger.log('Failed to remove',
                    childCount.getAttributeValue('participant'));
      }
    }

    _signalInterface.send("group_removeParticipantsSuccess",
                              [jabberId, jabberIds])
  }

  function parseSetPicture(node) {
    var id = node.getAttributeValue('id');
    var jabberId = node.getAttributeValue("from");
    var prefix = (jabberId.indexOf('-') >= 0) ? 'group' : 'profile';
    var picNode = node.getChild("picture");
    var pictureId;

    if (node.getAttributeValue('type') === 'error') {
      _signalInterface.send(prefix + "_setPictureError", [0, id]);
    } else {
      pictureId = parseInt(picNode.getAttributeValue("id"), 10);
      _signalInterface.send(prefix + "_setPictureSuccess", [pictureId, id]);
    }

  }

  function parseGroupEnded(node) {
    var leaveNode = node.getChild(0);
    var groupNode = leaveNode.getChild(0);
    var jabberId = groupNode.getAttributeValue("id");
    _signalInterface.send("group_endSuccess", [jabberId]);
  }

  function parseGroupSubject(node) {
    var jabberId = node.getAttributeValue("from");
    _signalInterface.send("group_setSubjectSuccess", [jabberId])
  }

  function parseGroups(node) {
    var groupNode, children = node.getAllChildren("group");
    var jabberId, owner, subject, subjectT, subjectOwner, creation;

    for (var i = 0, l = children.length; i < l; i++) {
      groupNode = children[i];

      jabberId = groupNode.getAttributeValue("id") + "@g.us";
      owner = groupNode.getAttributeValue("owner");
      subject = groupNode.getAttributeValue("subject")
      subjectT = groupNode.getAttributeValue("s_t")
      subjectOwner = groupNode.getAttributeValue("s_o")
      creation = groupNode.getAttributeValue("creation")

      _signalInterface.send(
        "group_gotInfo",
        [
          jabberId, owner, subject,
          subjectOwner, parseInt(subjectT, 10), parseInt(creation)
        ]
      );
    }
  }

  function parseParticipants(node) {
    var jabberId = node.getAttributeValue("from");
    var children = node.getAllChildren("participant");
    var child, jabberIds = []
    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      jabberIds.push(child.getAttributeValue("jid"))
    }
    _signalInterface.send("group_gotParticipants", [jabberId, jabberIds]);
  }

  function parseLastOnline(node) {
    var jabberId = node.getAttributeValue("from");
    var firstChild = node.getChild(0);

    if (firstChild.toString().indexOf("error") >= 0)
      return;

    ProtocolTreeNode.require(firstChild, "query");
    var seconds = firstChild.getAttributeValue("seconds");

    if (seconds !== null && jabberId !== null) {
      seconds = parseInt(firstChild.getAttributeValue("seconds"), 10);
      _signalInterface.send("presence_updated", [jabberId, seconds]);
    } else {
      logger.error("Malformed query result!");
    }
  }

  function parseContactsSync(node) {
    var inNode = node.getChild('sync') &&
                 node.getChild('sync').getChild('in');
    var outNode = node.getChild('sync') &&
                  node.getChild('sync').getChild('out');
    var registered = inNode ? inNode.children : [] ;
    var unregistered = outNode ? outNode.children : [];
    registered = registered.map(function (userNode) {
      return { phone: userNode.data, jid: userNode.getAttributeValue('jid') };
    });
    unregistered = unregistered.map(function (userNode) {
      return { phone: userNode.data, jid: userNode.getAttributeValue('jid') };
    });
    _signalInterface.send(
      'contacts_sync',
      [node.getAttributeValue('id'), registered, unregistered]
    );
  }

  function parseContactsStatus(node) {
    var statuses = {};
    var statusNode = node.getChild('status');
    var users = statusNode ? statusNode.children : [];
    users.forEach(function (userNode) {
      statuses[userNode.getAttributeValue('jid')] =
        stringFromUtf8(userNode.data);
    });
    _signalInterface.send(
      'contacts_gotStatus',
      [node.getAttributeValue('id'), statuses]
    );
  }

  function parseGetPictureIds(node) {
    var jabberId = node.getAttributeValue("from");
    var groupNode = node.getChild("list");
    var child, children = groupNode.getAllChildren("user");

    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      _signalInterface.send(
        "contact_gotProfilePictureId",
        [child.getAttributeValue("jid"), child.getAttributeValue("id")]
      );
    }
  }

  function parseRequestUpload(_hash, iqNode) {
    var mediaNode = iqNode.getChild("media");

    if (mediaNode) {
      var url = mediaNode.getAttributeValue("url");
      var resumeFrom = mediaNode.getAttributeValue("resume");
      if (!resumeFrom) {
        resumeFrom = 0;
      }

      if (url) {
        _signalInterface.send("media_uploadRequestSuccess", [_hash, url, resumeFrom]);
      } else {
        _signalInterface.send("media_uploadRequestFailed", [_hash]);
      }
    } else {
      var duplicateNode = iqNode.getChild("duplicate");

      if (duplicateNode) {
        var url = duplicateNode.getAttributeValue("url");
        _signalInterface.send("media_uploadRequestDuplicate", [_hash, url]);
      } else {
        _signalInterface.send("media_uploadRequestFailed", [_hash]);
      }
    }
  }

  var alive = false;

  return {
    set socket(aSocket) {
      if (aSocket) {
        _connection = aSocket;
        _connection.reader.onTree = handleNode;
        _connection.reader.resume();
        alive = true;
      } else {
        _connection.reader.onStreamStart = undefined;
        _connection.reader.onTree = undefined;
        _connection.onconnectionclosed = undefined;
        _connection.onconnectionlost = undefined;
        _connection = aSocket;
        alive = false;
      }
    },

    get requests() {
      return _requests;
    },

    parseRequestUpload: parseRequestUpload,

    parsePingResponse: parsePingResponse,

    parseGroupInfo: parseGroupInfo,

    parseGetGroups: parseGetGroups,

    parseGetPicture: parseGetPicture,

    parseGroupCreated: parseGroupCreated,

    parseAddedParticipants: parseAddedParticipants,

    parseRemovedParticipants: parseRemovedParticipants,

    parseSetPicture: parseSetPicture,

    parseGroupEnded: parseGroupEnded,

    parseGroupSubject: parseGroupSubject,

    parseGroups: parseGroups,

    parseParticipants: parseParticipants,

    parseLastOnline: parseLastOnline,

    parseContactsSync: parseContactsSync,

    parseContactsStatus: parseContactsStatus,

    parseGetPictureIds: parseGetPictureIds,

    // Not very pretty but then, what is?
    set signalInterface(si) {
      _signalInterface = si;
    },

    get signalInterface() {
      return _signalInterface;
    },

    isAlive: function() {
      return alive;
    },

    terminate: function(){
	  return true;
    },

    sendDisconnected: function(reason) {
      _signalInterface.send('disconnected', [reason]);
    }
  };
}()));

CoSeMe.namespace('yowsup.connectionmanager', (function() {

  var stringFromUtf8 = CoSeMe.utils.stringFromUtf8;
  var utf8FromString = CoSeMe.utils.utf8FromString;

  var logger = new CoSeMe.common.Logger('ConnectionManager');

  function fireEvent(aSignal, aParams) {
    // To-do: To be faithful with Yowsup, this should spawn a thread per handler
    signalHandlers[aSignal].forEach(function (aHandler) {
      try {
        aHandler.apply(undefined, aParams);
      } catch (x) {
        logger.error('FireEvent exception!', x);
      }
    });
  }

  // We will implement the high level interface of Yowsup so other users of the
  // library can port to this one directly
  var signalHandlers = {
      auth_success: [],
      auth_fail: [],

      message_received: [],
      image_received: [],
      vcard_received: [],
      video_received: [],
      audio_received: [],
      location_received: [],

      message_error: [],

      receipt_messageSent: [],
      receipt_messageDelivered: [],
      receipt_visible: [],
      receipt_broadcastSent: [],
      status_dirty: [],

      presence_updated: [],
      presence_available: [],
      presence_unavailable: [],

      group_subjectReceived: [],
      group_createSuccess: [],
      group_createFail: [],
      group_endSuccess: [],
      group_gotInfo: [],
      group_infoError: [],
      group_addParticipantsSuccess: [],
      group_removeParticipantsSuccess: [],
      group_gotParticipants: [],
      group_gotParticipating: [],
      group_setSubjectSuccess: [],
      group_messageReceived: [],
      group_imageReceived: [],
      group_vcardReceived: [],
      group_videoReceived: [],
      group_audioReceived: [],
      group_locationReceived: [],
      group_setPictureSuccess: [],
      group_setPictureError: [],
      group_gotPicture: [],
      group_gotGroups: [],

      notification_contactProfilePictureUpdated: [],
      notification_contactProfilePictureRemoved: [],
      notification_groupCreated: [],
      notification_groupSubjectUpdated: [],
      notification_groupPictureUpdated: [],
      notification_groupPictureRemoved: [],
      notification_groupParticipantAdded: [],
      notification_groupParticipantRemoved: [],
      notification_status: [],


      contact_gotProfilePictureId: [],
      contact_gotProfilePicture: [],
      contact_typing: [],
      contact_paused: [],
      contacts_sync: [],
      contacts_gotStatus: [],

      profile_setPictureSuccess: [],
      profile_setPictureError: [],
      profile_setStatusSuccess: [],

      ping: [],
      pong: [],
      got_properties: [],
      disconnected: [],

      media_uploadRequestSuccess: [],
      media_uploadRequestFailed: [],
      media_uploadRequestDuplicate: []

  };



  // Python: ProtocolTreeNode(tag,attributes,children=None,data=None):
  // This function just translates the new interface to the old one...
  // And yeah, I know it's sinister, but it was easier this way
  function newProtocolTreeNode(aTag, aAttributes, aChildren, aData) {
    return new CoSeMe.protocol.Tree(aTag, {
      attributes: aAttributes,
      children: aChildren,
      data: aData
    });
  };



  // Persistent state, per connectionmanager.py
  var self = {
    // Warning: Not really a thread :P
    readerThread: CoSeMe.yowsup.readerThread,
    autoPong: true,
    state: 0,
    socket: null,
    jid: null,
    out: null,
    currKeyId: 0,

    _writeNode: function (aNode) {
      logger.log('Write node called with ', aNode);
      if (self.state == 2) {
        self.out.write(aNode, this._onErrorSendDisconnected);
      }
    },

    _onErrorSendDisconnected: function (error) {
      if (error && self.state !== 0) {
        self.state = 0;
        self.readerThread.socket = null;
        self.readerThread.sendDisconnected(error);
        logger.error('Error writing!', error);
      }
    },

    getMessageNode: function(aJid, aChild) {
      var messageChildren = [];
      if (aChild instanceof Array) {
        messageChildren = messageChildren.concat(aChild);
      } else {
        messageChildren.push(aChild);
      }

      var msgId = Math.floor(Date.now() / 1000)  + '-' + self.currKeyId;

      var messageNode = newProtocolTreeNode('message', {
        to: aJid,
        type: aChild.tag === 'media' ? 'media' : 'text', // TODO: See for vcard
        id: msgId
      }, messageChildren);

      self.currKeyId++;

      return messageNode;
    },

    sendMessage:  function() {
      var aParams = Array.prototype.slice.call(arguments);
      var aFun = aParams.shift();
      var node = aFun.apply(self, aParams);
      var jid =
        (typeof aParams[0] === 'string') || (aParams[0] instanceof String) ?
            aParams[0] :
            'broadcast';
      var messageNode = self.getMessageNode(jid, node);
      self._writeNode(messageNode);
      // To-Do: Check that ProtocolTreeNode has getAttributeValue!!!
      return messageNode.getAttributeValue('id');
    },

    mediaNode: function() {
      var aParams = Array.prototype.slice.call(arguments);
      var aFun = aParams.shift();
      var mediaType = aFun.apply(self, aParams);
      var url = aParams[1];
      var name = utf8FromString(aParams[2]);
      var size = aParams[3];

      if (typeof size !== 'string') {
        size = size.toString();
      }

      var attributes = {
        xmlns: 'urn:xmpp:whatsapp:mms',
        type: mediaType,
        file: name,
        size: size,
        url: url
      };
      var thumbnail = aParams[4];
      if (thumbnail) {
        attributes.encoding = 'raw';
      }
      // TODO: AFAIK, this is not supported yet
      var live = aParams[5];
      if (live) {
        attributes.origin = 'live';
      }
      var seconds = aParams[6];
      if (seconds) {
        attributes.seconds = seconds.toString(10);
      }
      var mmNode = newProtocolTreeNode('media', {
        xmlns: 'urn:xmpp:whatsapp:mms',
        type: mediaType,
        file: name,
        size: size,
        url: url
      }, null, thumbnail);
      return mmNode;
    },

    sendReceipt: function(jid, mid, type) {
      attributes = {
        to: jid,
        id: mid,
        t: Date.now()
      };
      type && (attributes.type = type);
      self._writeNode(newProtocolTreeNode('receipt', attributes));
    },

    sendNotificationAck: function(to, id, type) {
      var attributes = {
        'class': 'notification',
        id: id,
        'to' : to
      };
      type && (attributes.type = type);

      self._writeNode(newProtocolTreeNode('ack', attributes));
    },

    getReceiptAck: function(to, id, type, participant, from) {
      var attributes = {
        'class': 'receipt',
        id: id,
        'to' : to
      };
      from && (attributes.from = from);
      type && (attributes.type = type);
      participant && (attributes.participant = participant);

      return newProtocolTreeNode('ack', attributes);
    },

    getSubjectMessage: function (aTo, aMsgId, aChild) {
      var messageNode = newProtocolTreeNode('message',
        {to: aTo, type: 'subject', id: aMsgId}, [aChild]);
      return messageNode;
    },

    iqId: 0,
    verbose: true,
    makeId: function(prefix) {
      self.iqId++;
      var idx;
      if (self.verbose) {
        idx = prefix + self.iqId;
      } else {
        idx = self.iqId.toString(16);
      }
      return idx;
    },

    sendKeepalive: function() {
      self._writeNode(null);
    },

    sendPing: function() {
      var idx = self.makeId('ping_');
      var iqNode =
        newProtocolTreeNode('iq', {type: 'get', xmlns: 'w:p', to: self.domain, id: idx});
      self._writeNode(iqNode);
    },

    sendPong: function(aIdx) {
      var iqNode =
        newProtocolTreeNode('iq', {type: 'result', to: self.domain, id: aIdx});
      self._writeNode(iqNode);
    }
  };

  function sendChatState(aJid, aState, media) {
    var attributes = media ? { media: media } : undefined;
    var stateNode = newProtocolTreeNode(aState, attributes);
    var chatstateNode =
      newProtocolTreeNode('chatstate', { to: aJid }, [ stateNode ]);
    self._writeNode(chatstateNode);
  }

  function modifyGroupParticipants(aOperation, aCallback, aGjid, aParticipants) {
      var idx = self.makeId(aOperation + '_group_participants_');

      var participantNodes = [];
      aParticipants.forEach(function(aPart) {
        participantNodes.push(newProtocolTreeNode('participant', {
          jid: aPart
        }));
      });

      var operation =
        newProtocolTreeNode(aOperation, undefined, participantNodes);

      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'set',
        to: aGjid,
        xmlns: 'w:g'
      }, [operation]);

      self.readerThread.requests[idx] = aCallback;
      self._writeNode(iqNode);
  }


  function sendSetPicture(aJid, preview, aImageData) {
      var children = [];
      var idx = self.makeId('set_picture_');

      var picture = newProtocolTreeNode(
        'picture',
        { },
        null,
        aImageData
      );
      children.push(picture);

      if (preview) {
        var thumb = newProtocolTreeNode(
          'picture',
          { type: 'preview' },
          null,
          preview
        );
        children.push(thumb);
      }

      var iqNode = newProtocolTreeNode(
        'iq',
        {
          id: idx,
          to: aJid,
          type: 'set',
          xmlns: 'w:profile:picture'
        },
        children,
        null
      );

      self.readerThread.requests[idx] = self.readerThread.parseSetPicture;
      self._writeNode(iqNode);
      return idx;
  }

  function sendGetPicture(aJid) {
    var id = self.makeId('get_picture_');
    var pictureNode = newProtocolTreeNode('picture');
    var iqNode = newProtocolTreeNode('iq', {
      id: id,
      type: 'get',
      to: aJid,
      xmlns: 'w:profile:picture'
    }, [pictureNode]);
    self.readerThread.requests[id] = self.readerThread.parseGetPicture;
    self._writeNode(iqNode);
  }

  function sendPostAuthentication() {
    sendClientConfig('S40', 'en', 'GB');
    sendGetServerProperties();
    sendGetGroups();
    sendGetPrivacyList();
  }

  function sendClientConfig(platform, language, country) {
    logger.log('Sending client config...');
    var id = self.makeId('config_');
    var configNode = newProtocolTreeNode('config', {
      platform: platform,
      lg: language,
      lc: country,
      clear: '0'
    });
    var iqNode = newProtocolTreeNode('iq', {
      id: id,
      type: 'set',
      to: CoSeMe.config.domain,
      xmlns: 'urn:xmpp:whatsapp:push'
    }, [configNode]);
    self._writeNode(iqNode);
  }

  function sendGetServerProperties() {
    logger.log('Asking for server properties...');
    var id = self.makeId('get_server_properties_');
    var iqNode = newProtocolTreeNode('iq', {
      type: 'get',
      to: CoSeMe.config.domain,
      xmlns: 'w'
    }, [newProtocolTreeNode('props')]);
    self._writeNode(iqNode);
  }

  function sendGetGroups() {
    logger.log('Asking for groups...');
    var id = self.makeId('get_groups_');
    _sendGetGroups(id, 'participating');
    self.readerThread.requests[id] = self.readerThread.parseGetGroups;
    return id;
  }

  function _sendGetGroups(id, type) {
    var commandNode = newProtocolTreeNode('list', { type: type });
    var iqNode = newProtocolTreeNode('iq', {
      id: id,
      type: 'get',
      to: 'g.us',
      xmlns: 'w:g'
    }, [commandNode]);
    self._writeNode(iqNode);
  }

  function sendGetPrivacyList() {
    var id = self.makeId('privacylist_');
    var commandNode = newProtocolTreeNode('list', { name: 'default' });
    var queryNode = newProtocolTreeNode('query', undefined, [commandNode]);
    var iqNode = newProtocolTreeNode('iq', {
      id: id,
      type: 'get',
      xmlns: 'jabber:iq:privacy'
    }, [queryNode]);
    self._writeNode(iqNode);
  }

  var methodList = {

    is_online: function () {
      return self.socket && self.socket.socket &&
             self.socket.socket.readyState === 'open';
    },

    /*
     * Authentication
     */
    auth_login: function(aUsername, aPassword, mcc, mnc) {
        logger.log('auth_login called for', aUsername);
        CoSeMe.auth.authenticate(aUsername, aPassword, mcc, mnc,
        function(err, aConn) {
          try {
            if (!err && aConn) {
              self.socket = aConn;
              self.expiration = aConn.expiration;
              self.socket.onconnectionclosed = self._onErrorSendDisconnected;
              self.socket.onconnectionlost = self._onErrorSendDisconnected;
              self.readerThread.socket = self.socket;
              self.readerThread.signalInterface = {
                onPing: (self.autoPong ? self.sendPong : null),
                onUnknownNotification: self.sendNotificationAck,
                send: fireEvent
              };
              self.jid = self.socket.jid;
              self.out = self.socket.writer;
              self.state = 2;
              self.domain = CoSeMe.config.domain;
              sendPostAuthentication();
              fireEvent('auth_success', [aUsername, null]);
            } else {
              logger.warn('Authentication failed: ', err);
              fireEvent('auth_fail', [aUsername, null, err]);
            }
          } catch (x) {
            logger.error('Error authenticating!', x);
            self.state = 0;
            fireEvent('auth_fail', [aUsername, null]);
          }
        });
    },

    /*
     * Message Sending
     */

    // I still think that the @syntax sucks :P
    // TO-DO TO-DO: aText should be re-coded so every byte is duplicated.
    // (0x00 0x1A becomes 0x00 0x00 0x00 0x1A) so the highest byte is 0 ALWAYS...
    // At the moment, corner case for the future
    message_send: self.sendMessage.bind(self, function(aJid, aText) {
      // Change the byte representation to UTF-8.
      aText = utf8FromString(aText);
      return newProtocolTreeNode('body', undefined, undefined, aText);
    }),

    typing_send: function(aJid) {
      sendChatState(aJid, 'composing');
    },

    typing_paused: function(aJid) {
      sendChatState(aJid, 'paused');
    },

    /*
     * Media
     */

    // Hmm... To-Do? I don't think this will actually work...
    message_imageSend: self.sendMessage.bind(self, self.mediaNode.bind(self, function() {
      return 'image';
    })),
    message_videoSend: self.sendMessage.bind(self, self.mediaNode.bind(self, function() {
      return 'video';
    })),
    message_audioSend: self.sendMessage.bind(self, self.mediaNode.bind(self, function() {
      return 'audio';
    })),

    message_locationSend: self.sendMessage.bind(self,
      function(aJid, aLatitude, aLongitude, aPreview) {
      return newProtocolTreeNode('media',
          {xmlns: 'urn:xmpp:whatsapp:mms',
           type: 'location',
           latitude: aLatitude,
           longitude: aLongitude},
          null, aPreview);
    }),
    message_vcardSend: self.sendMessage.bind(self, function(aJid, aData, aName) {
      aName = utf8FromString(aName);
      var cardNode = newProtocolTreeNode('vcard', {name: aName}, null, aData);
      return newProtocolTreeNode('media',
          {xmlns: 'urn:xmpp:whatsapp:mms', type: 'vcard'}, [cardNode]);
    }),

    //Message and Notification Acks

    message_ack: function(aJid, aMsgId, type) {
      self.sendReceipt(aJid, aMsgId, type);
    },
    notification_ack: function(aJid, aNotificationId, type) {
      self.sendNotificationAck(aJid, aNotificationId, type);
    },
    delivered_ack: function(aTo, aMsgId, type, participant, from) {
      self._writeNode(
        self.getReceiptAck(aTo, aMsgId, type, participant, from)
      );
    },
    visible_ack: function(aJid, aMsgId) {
      self._writeNode(self.getReceiptAck(aJid, aMsgId, 'visible'));
    },
    read_ack: function(aJid, aMsgId) {
      self._writeNode(self.getReceiptAck(aJid, aMsgId, 'read'));
    },
    subject_ack: function(aJid, aMessageId) {
      logger.log('Sending subject recv receipt...');
      var receivedNode = newProtocolTreeNode('received',
                                             {xmlns: 'urn:xmpp:receipts'});
      var messageNode = self.getSubjectMessage(aJid, aMessageId, receivedNode);
      self._writeNode(messageNode);
    },

    // Keep Alive

    keepalive: self.sendKeepalive,
    ping: self.sendPing,
    pong: self.sendPong,

    //Groups

    group_getInfo: function(aJid) {
      var idx = self.makeId('get_g_info_');
      var queryNode = newProtocolTreeNode('query');
      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'get',
        to: aJid,
        xmlns: 'w:g'
      }, [queryNode]);

      self.readerThread.requests[idx] = self.readerThread.parseGroupInfo;
      self._writeNode(iqNode);
    },

    group_getPicture: sendGetPicture,

    group_create: function(aSubject) {
      var idx = self.makeId('create_group_');
      var groupNode = newProtocolTreeNode('create', {
        subject: utf8FromString(aSubject)
      });
      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'set',
        to: 'g.us',
        xmlns: 'w:g'
      }, [groupNode]);

      self.readerThread.requests[idx] = self.readerThread.parseGroupCreated;
      self._writeNode(iqNode);
      return idx;
    },

    group_addParticipants: function(aGjid, aParticipants) {
      modifyGroupParticipants(
        'add',
        self.readerThread.parseAddedParticipants,
        aGjid,
        aParticipants);
    },

    group_removeParticipants: function(aGjid, aParticipants) {
      modifyGroupParticipants(
        'remove',
        self.readerThread.parseRemovedParticipants,
        aGjid,
        aParticipants);
    },

    group_setPicture: sendSetPicture,

    group_end: function(aGjid) {
      var  idx = self.makeId('leave_group_');

      var groupNodes = [];
      groupNodes.push(newProtocolTreeNode('group', { id: aGjid }));

      var  leaveNode = newProtocolTreeNode('leave', undefined, groupNodes);

      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'set',
        to: 'g.us',
        xmlns: 'w:g'
      }, [leaveNode]);

      self.readerThread.requests[idx] = self.readerThread.parseGroupEnded;
      self._writeNode(iqNode);
    },

    group_setSubject: function(aGjid, aSubject) {
      aSubject = utf8FromString(aSubject);
      var idx = self.makeId('set_group_subject_');
      var subjectNode = newProtocolTreeNode('subject', { value: aSubject });
      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'set',
        to: aGjid,
        xmlns: 'w:g'
      }, [subjectNode]);

      self.readerThread.requests[idx] = self.readerThread.parseGroupSubject;
      self._writeNode(iqNode);
    },

    group_getParticipants: function(aGjid) {
      var idx = self.makeId('get_participants_');

      var listNode = newProtocolTreeNode('list');
      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        type: 'get',
        to: aGjid,
        xmlns: 'w:g'
      }, [listNode]);

      self.readerThread.requests[idx] = self.readerThread.parseParticipants;
      self._writeNode(iqNode);
    },

    group_getParticipating: function () {
      return sendGetGroups()
    },

    // Presence

    presence_sendAvailable: function(aPushname) {
      var attrs = { type : 'available' };
      if (aPushname) {
        attrs.name = utf8FromString(aPushname);
      }
      var presenceNode = newProtocolTreeNode('presence', attrs)
      self._writeNode(presenceNode);
    },

    presence_request: function(jid) {
      methodList.presence_subscribe(jid);
      var id = self.makeId('last_');
      var iqNode = newProtocolTreeNode('iq', {
        to: jid,
        type: 'get',
        id: id,
        xmlns: 'jabber:iq:last'
      }, [newProtocolTreeNode('query')]);
      self.readerThread.requests[id] = self.readerThread.parseLastOnline;
      self._writeNode(iqNode);
    },

    presence_sendUnavailable: function() {
      var presenceNode = newProtocolTreeNode('presence', {type: 'unavailable'});
      self._writeNode(presenceNode);
    },

    presence_sendAvailableForChat: function(aPushname) {
      var attrs = { type : 'active' };
      if (aPushname) {
        attrs.name = utf8FromString(aPushname);
      }
      var presenceNode = newProtocolTreeNode('presence', attrs);
      self._writeNode(presenceNode);
    },

    presence_subscribe: function(aJid) {
      var presenceNode = newProtocolTreeNode(
        'presence', {type: 'subscribe', to: aJid});
      self._writeNode(presenceNode);
    },

    presence_unsubscribe: function(aJid) {
      var presenceNode = newProtocolTreeNode(
        'presence', {type: 'unsubscribe', to: aJid});
      self._writeNode(presenceNode);
    },

    // Contacts

    contacts_sync: function (numbers) {
      var id = self.makeId('sync_');
      var jid = self.jid;
      var syncNode = newProtocolTreeNode('sync', {
        mode: 'full',
        context: 'background',
        sid: CoSeMe.time.utcTimestamp(),
        last: 'true',
        index: '0'
      }, numbers.map(function (userphone) {
        return newProtocolTreeNode('user', undefined, undefined, userphone);
      }));
      var iqNode = newProtocolTreeNode('iq', {
        to: jid,
        type: 'get',
        id: id,
        xmlns: 'urn:xmpp:whatsapp:sync'
      }, [syncNode]);
      self.readerThread.requests[id] = self.readerThread.parseContactsSync;
      self._writeNode(iqNode);
      return id;
    },

    contacts_getStatus: function (jids) {
      var id = self.makeId('getstatus_');
      var iqNode = newProtocolTreeNode('iq', {
        to: CoSeMe.config.domain,
        type: 'get',
        id: id,
        xmlns: 'status'
      }, [newProtocolTreeNode('status', undefined, jids.map(function (jid) {
        return newProtocolTreeNode('user', { jid: jid });
      }))]);
      self.readerThread.requests[id] = self.readerThread.parseContactsStatus;
      self._writeNode(iqNode);
      return id;
    },

    contact_getProfilePicture: sendGetPicture,

    picture_getIds: function(aJids) {
      var idx = self.makeId('get_picture_ids_');
      self.readerThread.requests[idx] = self.readerThread.parseGetPictureIds;

      var innerNodeChildren = [];
      aJids.forEach(function (aJid) {
        innerNodeChildren.push(newProtocolTreeNode('user', {jid: aJid}));
      });

      var queryNode = newProtocolTreeNode('list', {}, innerNodeChildren);
      var iqNode = newProtocolTreeNode('iq', {id: idx, type: 'get',
                                      xmlns: 'w:profile:picture'}, [queryNode]);

      self._writeNode(iqNode);
    },

    // Profile

    profile_getPicture: function() {
      sendGetPicture(self.jid);
    },

    profile_setStatus: function(aStatus) {
      aStatus = utf8FromString(aStatus);
      var id = self.makeId('sendsetstatus_');
      var statusNode =
        newProtocolTreeNode('status', undefined, undefined, aStatus);
      var iqNode = newProtocolTreeNode('iq', {
        to: 's.whatsapp.net',
        type: 'set',
        id: id,
        xmlns: 'status'
      }, [statusNode]);
      self._writeNode(iqNode);

      return id;
    },

    profile_setPicture: function (preview, thumb) {
      return sendSetPicture(self.jid, preview, thumb);
    },

    // Misc

    ready: function() {
      if (self.readerThread.isAlive()) {
        logger.warn('Reader already started');
        return 0;
      }

      logger.log('Starting reader...');
      // Nothiing to do here, really... or is it?
      // TO-DO?
      return 1;
    },

    getVersion: function() { return CoSeMe.config.tokenData['v']; },

    getExpirationDate: function () {
     return self.expiration;
    },

    disconnect: function(aReason) {
      logger.log('Disconnect sequence initiated...');
      if (self.readerThread.isAlive()) {
        logger.log('Sending term signal to reader thread');
        self.readerThread.terminate();
        // TO-DO!!!! CHECK THE METHOD NAME!!!!
        self.socket.socket.close();
        self.readerThread.sendDisconnected(aReason);
      }

      logger.log('Disconnected!', aReason);
      self.state = 0;
    },

    media_requestUpload: function(aB64Hash, aT, aSize, aB64OrigHash) {
      var idx = self.makeId('upload_');

      // NOTE! TO-DO! parseRequestUpload will have it's arguments REVERSED!
      self.readerThread.requests[idx] =
        self.readerThread.parseRequestUpload.bind(undefined, aB64Hash);

      if (typeof aSize !== 'string') {
        aSize = aSize.toString(10);
      }

      var attribs = {hash: aB64Hash, type: aT, size: aSize};

      if (aB64OrigHash) {
        attribs.orighash = aB64OrigHash;
      }

      var mediaNode = newProtocolTreeNode('media', attribs);
      var iqNode = newProtocolTreeNode('iq', {
        id: idx,
        to: 's.whatsapp.net',
        type: 'set',
        xmlns: 'w:m',
      }, [mediaNode]);
      self._writeNode(iqNode);
    },

   message_broadcast: self.sendMessage.bind(undefined, function(aJids, aContent) {
     var jidNodes = [];
     aJids.forEach(function(aJid) {
       jidNodes.push(newProtocolTreeNode('to', {'jid': aJid}));
     });

     var broadcastNode = newProtocolTreeNode('broadcast', null, jidNodes);

     var messageNode = newProtocolTreeNode('body', null, null, aContent);

     return [broadcastNode, messageNode];
   }),

   clientconfig_send: function(aSound, aPushID, aPreview, aPlatform) {
     var idx = self.makeId('config_');
     var configNode =
       newProtocolTreeNode('config', {
                             xmlns: 'urn:xmpp:whatsapp:push',
                             sound: aSound,
                             id: aPushID,
                             preview: aPreview ? '1':'0',
                             platform: aPlatform});
     var iqNode =
       newProtocolTreeNode('iq',
                           {id: idx, type: 'set', to: self.domain},
                           [configNode]);

    self._writeNode(iqNode);
   },

   group_getGroups: function(aGtype) {
     var idx = self.makeId('get_groups_');
     self.readerThread.requests[idx] = self.readerThread.parseGroups;

     var queryNode = newProtocolTreeNode('list',{xmlns: 'w:g', type: aGtype});
     var iqNode = newProtocolTreeNode('iq',{id: idx, type: 'get', to: 'g.us'},
                                      [queryNode]);

     self._writeNode(iqNode);
   },

   picture_get: function(aJid) {
     var idx = self.makeId('get_picture_');

    //#@@TODO, ?!
    self.readerThread.requests[idx] =  self.readerThread.parseGetPicture;

     var listNode =
       newProtocolTreeNode('picture',
                           {xmlns: 'w:profile:picture', type: 'image'});
     var iqNode =
       newProtocolTreeNode('iq',{id: idx, to: aJid, type: 'get'}, [listNode]);

     self._writeNode(iqNode);
   },

   status_update: function(aStatus) {
     aStatus = utf8FromString(aStatus);
     var bodyNode = newProtocolTreeNode('body', null, null, aStatus);
     var messageNode = self.getMessageNode('s.us', bodyNode);
     self._writeNode(messageNode);
     return messageNode.getAttributeValue('id');
   }

  };

  return {
    get methods() {
      return methodList;
    },
    get signals() {
      return signalHandlers;
    },
    fireEvent: fireEvent,
    get jid() {
      return self.jid;
    }
  };
})());
