CoSeMe.namespace('auth', (function() {
  'use strict'

  var logger = new CoSeMe.common.Logger('auth');
  var ByteArray = CoSeMe.utils.ByteArrayWA;
  var Tree = CoSeMe.protocol.Tree;

  var username, password, callback;
  var mnc, mcc;
  var connection, outputKey;
  var authenticated = false;

  function pad(value, positions) {
    var padding = '';
    var str = value + '';
    if (str.length < positions) {
      padding = new Array(positions - str.length + 1).join('0');
    }
    return padding + str;
  }

  /*
   * Performs authentication with server given a user and a password.
   * If authentication succed, a valid connection is passed to the callback
   * as second parameter.
   *
   * Errors can be:
   *  - connection-refused if the connection can no be stablished.
   *  - auth-failed if the authentication fails for the given user and password
   *  - expired if the account has expired
   *
   *  Other errors can be possible but the former ones are the most important.
   */
  function authenticate(user, pass, mcc, mnc, cb) {
    mcc = pad(mcc, 3);
    mnc = pad(mnc, 3);
    username = user;
    password = pass;
    callback = cb;
    openConnection(function _onConnection(err, validConnection) {
      if (err) {
        return callback(err);
      }

      connection = validConnection;
      tryLogin(function _onLogin(err) {
        // Try to authenticate if we have a one-shot-rejected error, instead of
        // bubbling it up to the app
        if (err === 'one-shot-rejected') {
          authenticate(username, password, mcc, mnc, callback);
          return;
        }

        if (err) {
          return callback(err);
        }

        // On authenticated, pause the reader, establish the output key and
        // call the callback with the established connection.
        authenticated = true;
        connection.reader.suspend();
        connection.reader.onStreamStart = undefined;
        connection.reader.onTree = undefined;
        connection.writer.outputKey = outputKey;
        connection.jid = username + '@' + CoSeMe.config.domain;
        callback(null, connection);
      });
    });
  }

  function openConnection(callback) {
    var connection = new CoSeMe.connection.Connection();
    var host = CoSeMe.config.auth.host;
    var port = CoSeMe.config.auth.port;
    var connectionOptions = CoSeMe.config.auth.connectionOptions;

    logger.log('Connecting to:', host + ':' + port);
    connection.connect(
      host, port, connectionOptions,
      onConnected, onError
    );

    function onConnected () {
      callback && callback(null, connection);
    }

    function onError () {
      callback && callback('connection-refused');
    }
  }

  function tryLogin(callback) {
    logger.log('Starting login...');

    var domain = CoSeMe.config.domain;
    var resource = CoSeMe.config.tokenData.r;

    logger.log('Sending stream start, features & authentication');
    connection.writer.streamStart(domain, resource);
    connection.writer.write(getFeatures());
    connection.writer.write(getAuth(getNextChallenge()));

    waitForAnswer(function _onAnwser(loggingError) {
      if (loggingError) {
        switch (loggingError) {

          // Retry with no challenge
          case 'one-shot-rejected':
          // Authentication failed
          case 'auth-failed':
          case 'expired':
            return callback(loggingError);
          break;

          // Other stream errors
          default:
            logger.error('<stream:error>', loggingError);
            return callback(loggingError);
        }
      }

      callback(null);
    });
  }

  // Possible errors:
  //   'auth-failed' -> if authentication has failed
  //   'expired' -> if the account has expired
  //   'one-shot-rejected' -> if the one shot auth has failed
  //   <other> -> if <stream:error> received
  function waitForAnswer(callback) {
    logger.log('Waiting for stream start...');

    connection.reader.onStreamStart = _processAnswer;
    connection.reader.onTree = _processAnswer;
    connection.reader.startListening(connection);

    function _processAnswer(err, tree) {
      if (err) {
        return callback(err);
      }

      if (!tree) { return; }

      switch (tree.tag) {
        case 'stream:error':
          var streamError = tree.getChild('text').data;
          logger.error(streamError);
          callback(streamError);
        break;

        case 'start':
          logger.log('Got stream start! Waiting for challenge...');
        break;

        case 'stream:features':
          logger.log('Got the features.');
        break;

        case 'challenge':
          logger.log('Got the challenge! Sending answer...');
          sendResponseFor(tree.data);
        break;

        case 'failure':
          retryOrFail();
        break;

        case 'success':
          readSuccess(tree);
        break;

        default:
          logger.warn('Unexpected auth tree: ', tree.tag);
        break;
      }

      function sendResponseFor(challenge) {
        var authBlob = getAuthBlob(challenge);
        var response = new Tree('response', { data: authBlob });
        connection.writer.write(response);
      }

      function retryOrFail() {
        if (getNextChallenge() !== null) {
          logger.log('Looks like the one-shot challenge failed.' +
                     'Trying with no-challenge.');
          setNextChallenge(null);
          return callback('one-shot-rejected');
        }
        logger.log('Authentication failed!');
        callback('auth-failed');
      }

      function readSuccess(successTree) {
        if (successTree.getAttributeValue('status') === 'expired') {
          logger.warn('The accound has expired.');
          return callback('expired');
        }
        logger.log('Authentication success!');
        var expiration = successTree.getAttributeValue('expiration');
        expiration = parseInt(expiration, 10);
        if (!isNaN(expiration)) {
          connection.expiration = new Date(expiration * 1000);
        }
        setNextChallenge(successTree.data);
        callback(null);
      }
    }
  }

  // challenge in Latin1
  function getAuthBlob(challenge) {
    var keys = CoSeMe.auth.KeyStream.getKeys(password, challenge);

    // Setup KeyStreams
    connection.reader.inputKey =
      new CoSeMe.auth.KeyStream(keys.inputKey, keys.inputHMAC, 'input');
    outputKey =
      new CoSeMe.auth.KeyStream(keys.outputKey, keys.outputHMAC, 'output');

    // Setup response
    var utcNow = CryptoJS.enc.Latin1.parse(CoSeMe.time.utcTimestamp() + '');
    var msg = CryptoJS.enc.Latin1.parse(username);
    msg.concat(CryptoJS.enc.Latin1.parse(challenge));
    msg.concat(utcNow);
    msg.concat(CryptoJS.enc.Latin1.parse(CoSeMe.config.tokenData.u));
    msg.concat(CryptoJS.enc.Latin1.parse(' MccMnc/' + mcc + mnc));

    // Encode response
    var buffer = new ByteArray(msg.sigBytes).writeAll(msg);
    var encoded = outputKey.encodeMessage(buffer);

    // Prepare the complete mac + message buffer: signedBuffer
    var macLength = CoSeMe.config.auth.hmacLength;
    var signedBuffer = new ByteArray(macLength + encoded.text.array.sigBytes);
    for (var i = 0; i < macLength; i++) {
      signedBuffer.write(encoded.hmacSHA1.get(i));
    }
    return CryptoJS.enc.Latin1.stringify(
      signedBuffer.writeAll(encoded.text.array).array
    );
  }

  function getFeatures() {
    var features = [
      new Tree('receipt_acks'),
      new Tree('w:profile:picture', { attributes: {
        type: 'all'
      }}),
      new Tree('w:profile:picture', { attributes: {
        type: 'group'
      }}),
      new Tree('notification', { attributes: {
        type: 'participant'
      }}),
      new Tree('status', { attributes: {
        notification: 'true'
      }})
    ];

    return new Tree('stream:features', { children: features });
  };

  function getAuth(existingChallenge) {
    var data = '';
    if (existingChallenge) {
      logger.log('There is a existing challenge, trying one-shot auth!');
      data = getAuthBlob(existingChallenge);
    }
    return new Tree('auth', { attributes: {
      mechanism: 'WAUTH-2',
      user: username
    }, data: data });
  };

  var nextChallengeSetting = '__cosemeNextChallenge';

  function getNextChallenge() {
    return localStorage.getItem(nextChallengeSetting);
  }

  function setNextChallenge(value) {
    if (value === null) {
      localStorage.removeItem(nextChallengeSetting);
    }
    else {
      localStorage.setItem(nextChallengeSetting, value);
    }
  }

  return {
    authenticate: authenticate,

    get isAuthenticated() {
      return authenticated;
    }
  };

}()));

CoSeMe.namespace('auth', (function() {
  var logger = new CoSeMe.common.Logger('KeyStream');
  var ByteArrayWA = CoSeMe.utils.ByteArrayWA;

  /**
   * @param key is a ByteArrayWA
   */
  function KeyStream(key, macKey, name) {
    this.sequence = 0;
    this.name = name;
    this.key = key;
    this.macKey = macKey;
    this.encryptor = CryptoJS.algo.RC4WP.createEncryptor(
      this.key, CoSeMe.config.auth.rc4Options
    );
  };

  /**
   * Multiplex the nonce to be 4 and return the set of incoming / outgoing
   * and incoming hmac / outgoing hmac keys.
   *  - password is provided as base64 data
   *  - nonce is provided as a Latin1 string
   */
  KeyStream.getKeys = function(password, nonce) {
    try {
      logger.log('nonce (latin1):', nonce);
      logger.log('password (base64):', password);

      password = CryptoJS.enc.Base64.parse(password);
      var variations = {
        outputKey:  '\x01',
        outputHMAC: '\x02',
        inputKey:   '\x03',
        inputHMAC:  '\x04'
      };

      var keys = {};
      Object.keys(variations).forEach(function _calcKey(name) {
        var variation = variations[name];
        var salt = CryptoJS.enc.Latin1.parse(nonce + variation);
        var key = CryptoJS.PBKDF2(
          password, salt,
          CoSeMe.config.auth.pbkdf2Options
        );
        keys[name] = key;
      });
      logger.log('Keys:', keys);
      return keys;

    } catch (x) {
      logger.error(x);
      return null;
    }
  };

  /**
   * @param aMsg  cypher text, ByteArrayWA
   * @param aHmacSHA1 hmac, ByteArrayWA
   * TODO Error conditions verifications
   * @exception If calculated hmac is different from received hmac
   * @return RC4WP.decrypt(aMsg) INPLACE (so it actually returns cipherTxt)
   */
  KeyStream.prototype.decodeMessage = function(cipherTxt, aHmacSHA1) {

    var hmacCal = this.computeMac(cipherTxt).toString(CryptoJS.enc.Hex);

    var hmacTxt = CryptoJS.enc.Hex.stringify(aHmacSHA1.array);

    if (hmacTxt !== hmacCal.substring(0, hmacTxt.length)) {
      logger.error('INVALID MAC!');
      throw new Error('Invalid MAC');
    }

    var cipherData = cipherTxt.array;
    var plainTxt = this.encryptor.finalize(cipherData);

    return cipherTxt;
  };

  /**
   * @param aMsg plainText
   * @return {text: RC4WP(msg), hmacSHA1: HmacSHA1(RC4WP(msg)) }
   */
  // aMsg is a ByteArrayWA, since now...
  // Oh, and it modifies it in place! Copies suck!
  KeyStream.prototype.encodeMessage = function(aMsg) {

    // In place encryption! This modifies cipherwords also!
    var cipherwords = aMsg.array;
    this.encryptor.finalize(cipherwords);
    var hash = this.computeMac(aMsg);

    return {
      text: aMsg,
      hmacSHA1: new ByteArrayWA(hash.sigBytes).writeAll(hash)
    };
  };

  KeyStream.prototype.computeMac = function (message) {
    // Progressive HMAC is not supported with HmacSHA1_IP in order to avoid
    // copies so we need to append the sequence number (4-byte number),
    // calculate the hash and then remove the sequence.
    message.write(this.sequence, 4);
    var hash = CryptoJS.HmacSHA1_IP(message.array, this.macKey);
    message.rewind(4);
    this.sequence++;
    return hash;
  };

  return KeyStream;

}()));
