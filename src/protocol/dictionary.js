
CoSeMe.namespace('protocol.dictionary', (function(){
  'use strict';

  var primaryStrings = [
    '',
    '',
    '',
    'account',
    'ack',
    'action',
    'active',
    'add',
    'after',
    'all',
    'allow',
    'apple',
    'auth',
    'author',
    'available',
    'bad-protocol',
    'bad-request',
    'before',
    'body',
    'broadcast',
    'cancel',
    'category',
    'challenge',
    'chat',
    'clean',
    'code',
    'composing',
    'config',
    'contacts',
    'count',
    'create',
    'creation',
    'debug',
    'default',
    'delete',
    'delivery',
    'delta',
    'deny',
    'digest',
    'dirty',
    'duplicate',
    'elapsed',
    'enable',
    'encoding',
    'error',
    'event',
    'expiration',
    'expired',
    'fail',
    'failure',
    'false',
    'favorites',
    'feature',
    'features',
    'feature-not-implemented',
    'field',
    'first',
    'free',
    'from',
    'g.us',
    'get',
    'google',
    'group',
    'groups',
    'http://etherx.jabber.org/streams',
    'http://jabber.org/protocol/chatstates',
    'ib',
    'id',
    'image',
    'img',
    'index',
    'internal-server-error',
    'ip',
    'iq',
    'item-not-found',
    'item',
    'jabber:iq:last',
    'jabber:iq:privacy',
    'jabber:x:event',
    'jid',
    'kind',
    'last',
    'leave',
    'list',
    'max',
    'mechanism',
    'media',
    'message_acks',
    'message',
    'method',
    'microsoft',
    'missing',
    'modify',
    'mute',
    'name',
    'nokia',
    'none',
    'not-acceptable',
    'not-allowed',
    'not-authorized',
    'notification',
    'notify',
    'off',
    'offline',
    'order',
    'owner',
    'owning',
    'p_o',
    'p_t',
    'paid',
    'participant',
    'participants',
    'participating',
    'paused',
    'picture',
    'pin',
    'ping',
    'platform',
    'port',
    'presence',
    'preview',
    'probe',
    'prop',
    'props',
    'query',
    'raw',
    'read',
    'reason',
    'receipt',
    'received',
    'relay',
    'remote-server-timeout',
    'remove',
    'request',
    'required',
    'resource-constraint',
    'resource',
    'response',
    'result',
    'retry',
    'rim',
    's_o',
    's_t',
    's.us',
    's.whatsapp.net',
    'seconds',
    'server-error',
    'server',
    'service-unavailable',
    'set',
    'show',
    'silent',
    'stat',
    'status',
    'stream:error',
    'stream:features',
    'subject',
    'subscribe',
    'success',
    'sync',
    't',
    'text',
    'timeout',
    'timestamp',
    'to',
    'true',
    'type',
    'unavailable',
    'unsubscribe',
    'uri',
    'url',
    'urn:ietf:params:xml:ns:xmpp-sasl',
    'urn:ietf:params:xml:ns:xmpp-stanzas',
    'urn:ietf:params:xml:ns:xmpp-streams',
    'urn:xmpp:ping',
    'urn:xmpp:receipts',
    'urn:xmpp:whatsapp:account',
    'urn:xmpp:whatsapp:dirty',
    'urn:xmpp:whatsapp:mms',
    'urn:xmpp:whatsapp:push',
    'urn:xmpp:whatsapp',
    'user',
    'user-not-found',
    'value',
    'version',
    'w:g',
    'w:p:r',
    'w:p',
    'w:profile:picture',
    'w',
    'wait',
    'WAUTH-2',
    'x',
    'xmlns:stream',
    'xmlns',
    '1',
    'chatstate',
    'crypto',
    'enc',
    'class',
    'off_cnt',
    'w:g2',
    'promote',
    'demote',
    'creator'
  ];

  var secondaryStrings = [
    [
      'Bell.caf',
      'Boing.caf',
      'Glass.caf',
      'Harp.caf',
      'TimePassing.caf',
      'Tri-tone.caf',
      'Xylophone.caf',
      'background',
      'backoff',
      'chunked',
      'context',
      'full',
      'in',
      'interactive',
      'out',
      'registration',
      'sid',
      'urn:xmpp:whatsapp:sync',
      'flt',
      's16',
      'u8',
      'adpcm',
      'amrnb',
      'amrwb',
      'mp3',
      'pcm',
      'qcelp',
      'wma',
      'h263',
      'h264',
      'jpeg',
      'mpeg4',
      'wmv',
      'audio/3gpp',
      'audio/aac',
      'audio/amr',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/qcelp',
      'audio/wav',
      'audio/webm',
      'audio/x-caf',
      'audio/x-ms-wma',
      'image/gif',
      'image/jpeg',
      'image/png',
      'video/3gpp',
      'video/avi',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-flv',
      'video/x-ms-asf',
      '302',
      '400',
      '401',
      '402',
      '403',
      '404',
      '405',
      '406',
      '407',
      '409',
      '500',
      '501',
      '503',
      '504',
      'abitrate',
      'acodec',
      'app_uptime',
      'asampfmt',
      'asampfreq',
      'audio',
      'bb_db',
      'clear',
      'conflict',
      'conn_no_nna',
      'cost',
      'currency',
      'duration',
      'extend',
      'file',
      'fps',
      'g_notify',
      'g_sound',
      'gcm',
      'google_play',
      'hash',
      'height',
      'invalid',
      'jid-malformed',
      'latitude',
      'lc',
      'lg',
      'live',
      'location',
      'log',
      'longitude',
      'max_groups',
      'max_participants',
      'max_subject',
      'mimetype',
      'mode',
      'napi_version',
      'normalize',
      'orighash',
      'origin',
      'passive',
      'password',
      'played',
      'policy-violation',
      'pop_mean_time',
      'pop_plus_minus',
      'price',
      'pricing',
      'redeem',
      'Replaced by new connection',
      'resume',
      'signature',
      'size',
      'sound',
      'source',
      'system-shutdown',
      'username',
      'vbitrate',
      'vcard',
      'vcodec',
      'video',
      'width',
      'xml-not-well-formed',
      'checkmarks',
      'image_max_edge',
      'image_max_kbytes',
      'image_quality',
      'ka',
      'ka_grow',
      'ka_shrink',
      'newmedia',
      'library',
      'caption',
      'forward',
      'c0',
      'c1',
      'c2',
      'c3',
      'clock_skew',
      'cts',
      'k0',
      'k1',
      'login_rtt',
      'm_id',
      'nna_msg_rtt',
      'nna_no_off_count',
      'nna_offline_ratio',
      'nna_push_rtt',
      'no_nna_con_count',
      'off_msg_rtt',
      'on_msg_rtt',
      'stat_name',
      'sts',
      'suspect_conn',
      'lists',
      'self',
      'qr',
      'web',
      'w:b',
      'recipient',
      'w:stats',
      'forbidden',
      'aurora.m4r',
      'bamboo.m4r',
      'chord.m4r',
      'circles.m4r',
      'complete.m4r',
      'hello.m4r',
      'input.m4r',
      'keys.m4r',
      'note.m4r',
      'popcorn.m4r',
      'pulse.m4r',
      'synth.m4r',
      'filehash'
    ]
  ];

  var secondaryStringStart = 236;
  var secondaryStringEnd = secondaryStringStart + secondaryStrings.length;

  var primaryMap = {};
  for (var text, i = 0, l = primaryStrings.length; i < l; i++) {
    text = primaryStrings[i];
    text && (primaryMap[text] = i);
  }

  var secondaryMap = {};
  for (var subList, d = 0, l = secondaryStrings.length; d < l; d++) {
    subList = secondaryStrings[d];
    for (var text, i = 0, ll = subList.length; i < ll; i++) {
      text = subList[i];
      text && (secondaryMap[text] = [d + 236, i]);
    }
  }

  // Return an object {submap, code}. If `submap` is null
  // the token belongs to the primary strings.
  function token2Code(token) {
    var pair, result = { submap: null, code: null };
    if (primaryMap.hasOwnProperty(token)) {
      result.code = primaryMap[token];

    } else if (secondaryMap.hasOwnProperty(token)) {
      pair = secondaryMap[token];
      result.submap = pair[0];
      result.code = pair[1];
    }

    return result;
  }

  // Return an object {token, submap}. Due to the particular form of encoding
  // tokens, you should try to call this function with no submap. Then, if
  // `token` key is null, read the next byte and call code2Token() again passing
  // the read value as token and the value of submap key from the former call as
  // submap.
  function code2Token(code, submap) {
    var array, result = { token: null, submap: null };

    // Called with only code
    if (arguments.length === 1) {
      if (code >= secondaryStringStart && code < secondaryStringEnd) {
        result.submap = code - secondaryStringStart;
      } else {
        array = primaryStrings;
      }

    // Called with code and submap
    } else {
      if (submap > secondaryStrings.length) {
        throw new Error('Invalid subdictionary: ' + submap);
      }
      array = secondaryStrings[submap];
    }

    // If array, get the token
    if (array) {
      if (code < 0 || code >= array.length) {
        throw new Error('Invalid token: ' + code);
      } else if (!array[code]) {
        throw new Error('Invalid token or length');
      }
      result.token = array[code];
    }

    return result;
  }

  var STREAM_START = 1;

  var SHORT_LIST_MARK = 248;
  var LONG_LIST_MARK  = 249;
  var EMPTY_LIST_MARK =   0;

  var SURROGATE_MARK = 254;

  var SHORT_STRING_MARK = 252;
  var LONG_STRING_MARK  = 253;

  var JID_MARK = 250;

  var MAC_LENGTH = 4;

  var HEADER_LENGTH = 3;

  return {
    get code2Token() { return code2Token; },
    get token2Code() { return token2Code; },

    get STREAM_START() { return STREAM_START; },

    get SHORT_LIST_MARK() { return SHORT_LIST_MARK; },
    get LONG_LIST_MARK() { return LONG_LIST_MARK; },
    get EMPTY_LIST_MARK() { return EMPTY_LIST_MARK; },

    get SURROGATE_MARK() { return SURROGATE_MARK; },

    get SHORT_STRING_MARK() { return SHORT_STRING_MARK; },
    get LONG_STRING_MARK() { return LONG_STRING_MARK; },

    get JID_MARK() { return JID_MARK; },

    get MAC_LENGTH() { return MAC_LENGTH; },

    get HEADER_LENGTH() { return HEADER_LENGTH; }
  };
}()));
