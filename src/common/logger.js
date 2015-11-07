CoSeMe.namespace('common', (function(){
  'use strict';

  var isOn = CoSeMe.config.logger;

  function Logger(topic) {
    this._topic = topic || null;
    if (!topics.hasOwnProperty(topic)) {
      Logger.topics[topic] = true;
    }
  }

  Object.defineProperty(Logger, 'topics', { value: {} });
  var topics = Logger.topics;

  Logger.on = function() {
    isOn = true;
  };

  Logger.off = function() {
    isOn = false;
  };

  Logger.disable = function() {
    Array.prototype.forEach.call(arguments, function(topic) {
      topics[topic] = false;
    });
  };

  Logger.enable = function() {
    Array.prototype.forEach.call(arguments, function(topic) {
      topics[topic] = true;
    });
  };

  Logger.disableAll = function() {
    Object.keys(topics).forEach(function(topic) {
      topics[topic] = false;
    });
  };

  Logger.enableAll = function() {
    Object.keys(topics).forEach(function(topic) {
      topics[topic] = true;
    });
  };

  Logger.select = function(selection) {
    Object.keys(selection).forEach(function(topic) {
      topics[topic] = !!selection[topic];
    });
  };

  Logger.prototype.log = function() {
    this._message(arguments, 'log');
  };

  Logger.prototype.warn = function() {
    this._message(arguments, 'warn');
  };

  Logger.prototype.error = function() {
    this._message(arguments, 'error');
  };

  Logger.prototype._message = function(args, kind) {
    if (!isOn || this._topic && !topics[this._topic]) return;

    kind = kind || 'log';

    var stack; // creepy trick to obtain the current stack
    try { throw new Error() } catch(err) { stack = err.stack; }
    var where = stack.split('\n')[2];
    var message = getMessage(this._topic, where, args);
    putMessage(kind, message);
  }

  function getMessage(topic, where, args) {
    var token, tokens = [];
    for (var i = 0, l = args.length; i < l; i++) {
      token = stringify(args[i]);
      tokens.push(token)
    }
    tokens.push('~ ' + where);
    if (topic) {
      tokens.push('[' + topic + ']');
    }

    return tokens.join(' ');
  }

  function stringify(obj) {
    var string;

    // Already a string
    if (typeof obj === 'string') {
      string = obj;

    // An exception
    } else if (obj instanceof Error) {
      var stack = obj.stack || '';
      var sanitizedStack = stack.replace(/\n/g, ' > ');
      string = obj.name + ': "' + obj.message + '" at ' + sanitizedStack;

    // A date or regular expression
    } else if (obj instanceof Date || obj instanceof RegExp) {
      string = obj.toString();

    // Stringify by default
    } else {
      string = JSON.stringify(obj);
    }

    // Deeper exploration
    if (string === '{}') {

      // An event
      if (obj.target && obj.type) {
        var data = stringify(obj.data ? obj.data : undefined);
        var obj = stringify(obj.target);
        string = stringify({ type: obj.type, target: obj.target, data: data});
      }

    }

    return string;
  }

  function putMessage(kind, message) {
    var console = window.console;

    if (CoSeMe.config.customLogger) {
      console = CoSeMe.config.customLogger;
    }

    if (typeof console[kind] !== 'function') {
      kind = 'log';
    }
    console[kind](message);
  }

  return Logger;
}()));
