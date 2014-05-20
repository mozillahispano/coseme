CoSeMe.namespace('contacts', (function(){
  'use strict';

  var logger = new CoSeMe.common.Logger('contacts');

  var _methods = CoSeMe.yowsup.getMethodsInterface();
  var _signals = CoSeMe.yowsup.getSignalsInterface();
  var _callbacks = {};
  var _contacts = [];

  _signals.registerListener('contacts_sync', _onResponse);
  _signals.registerListener('contacts_gotStatus', _onResponse);

  function _onResponse(id) {
    var callback = _callbacks[id];
    delete _callbacks[id];
    callback && callback.apply(this, [].slice.call(arguments,1));
  }

  function _sync(numbers, callback) {
    var id = _methods.call('contacts_sync', [numbers]);
    _callbacks[id] = callback;
  }

  function _getStatus(jids, callback) {
    var id = _methods.call('contacts_getStatus', [jids]);
    _callbacks[id] = callback;
  }

  function _getV2Response(registered, unregistered, statusMap) {
    var result = { c: [] };
    registered.forEach(function (user) {
      result.c.push(_newContactEntry(1, user, statusMap[user.jid]));
    });
    unregistered.forEach(function (user) {
      result.c.push(_newContactEntry(0, user));
    });
    return result;
  }

  function _newContactEntry(isIn, user, status) {
    var entry = {
      w: isIn,
      p: user.phone,
      n: user.jid.split('@')[0],
      get t() {
        console.warn('Deprecated with the new sync method.');
        return undefined;
      }
    };
    isIn && (entry.s = status);
    return entry;
  };

  return {
    setCredentials: function() {
      console.warn('Deprecated and useless. Please, remove.');
    },

    addContacts: function(contacts) {
      if (!Array.isArray(contacts)) {
        contacts = [contacts];
      }
      _contacts = _contacts.concat(contacts);
      logger.log('Contacts:', _contacts);
    },

    clearContacts: function() {
      _contacts = [];
    },

    query: function _query(onready, onerror) {
      if (_contacts.length === 0) { return; }

      // Try to sync in order to discern between registered and unregistered
      _sync(_contacts, function (registered, unregistered) {
        if (registered.length === 0 && unregistered.length === 0) {
          return onerror('invalid-sync-response');
        }

        // Now get statuses for registered ones
        var jids = registered.map(function (user) { return user.jid; });
        _getStatus(jids, function (statusMap) {
          if (registered.length > 0 && Object.keys(statusMap).length === 0) {
            return onerror('invalid-status-response');
          }

          // And translate to the former V2 sync format
          var response = _getV2Response(registered, unregistered, statusMap);
          onready(response);
        });
      });
    }
  };
}()));
