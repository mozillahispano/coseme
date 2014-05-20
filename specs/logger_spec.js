describe('CoSeMe logger', function() {

  var Logger = CoSeMe.common.Logger;

  var testMessage = 'Test log!';
  var testTopic = 'Test topic',
      anotherTopic = 'Another topic',
      additionalTopic = 'Another one';
  var MESSAGE = 1, FILE = 2, TOPIC = 3;

  function parseTrace(trace) {
    var parsed = [];
    var messageAndMeta = trace.split('~');
    parsed[MESSAGE] = messageAndMeta[0].trim();

    var metaAndTopic = messageAndMeta[1].split(' [');
    parsed[FILE] = metaAndTopic[0].trim();
    parsed[TOPIC] = metaAndTopic[1] ? ('[' + metaAndTopic[1]) : undefined;
    return parsed;
  }

  beforeEach(function() {
    ['log', 'warn', 'error'].forEach(function(method) {
      sinon.spy(console, method);
    });
    Logger.on();
  });

  afterEach(function() {
    ['log', 'warn', 'error'].forEach(function(method) {
      console[method].restore();
    });
  });

  describe('the `Logger` intances', function() {

    it('can leave a `log()` message in the console', function() {
      var logger = new Logger();

      logger.log(testMessage);

      var completeMessage = console.log.args[0][0];
      expect(console.log.calledOnce).toBe(true);
      expect(completeMessage.indexOf(testMessage)).not.toBeLessThan(0);
    });

    it('can leave a `warn()` message in the console', function() {
      var logger = new Logger();

      logger.warn(testMessage);

      var completeMessage = console.warn.args[0][0];
      expect(console.warn.calledOnce).toBe(true);
      expect(completeMessage.indexOf(testMessage)).not.toBeLessThan(0);
    });

    it('can leave an `error()` message in the console', function() {
      var logger = new Logger();

      logger.error(testMessage);

      var completeMessage = console.error.args[0][0];
      expect(console.error.calledOnce).toBe(true);
      expect(completeMessage.indexOf(testMessage)).not.toBeLessThan(0);
    });

    describe('traces', function() {
      it('have the form `message ~ line [topic]`', function() {
        var logger = new Logger(testTopic);

        logger.log(testMessage);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings.length).toBe(4);
        expect(matchings[FILE].indexOf('logger_spec.js:71'))
          .not.toBeLessThan(0);
        expect(matchings[MESSAGE].indexOf(testMessage)).not.toBeLessThan(0);
        expect(matchings[TOPIC].indexOf(testTopic)).not.toBeLessThan(0);
      });

      it('if no topic, they have the form `message ~ line`', function() {
        var logger = new Logger();

        logger.log(testMessage);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings.length).toBe(4);
        expect(matchings[TOPIC]).not.toBeDefined();
      });

      it('can serialize dates', function() {
        var logger = new Logger();
        var date = new Date(), dateString = date.toString();

        logger.log(date);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings[MESSAGE]).toBe(dateString);
      });

      it('can serialize exceptions', function() {
        var logger = new Logger();
        var error = new Error('Test error');

        logger.log(error);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings[MESSAGE].startsWith('Error: "Test error"'));
      });

      it('can serialize objects', function() {
        var logger = new Logger();
        var obj = { a: [1,2,3] };

        logger.log(obj);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings[MESSAGE]).toBe(JSON.stringify(obj));
      });

      it('combines several messages and objects separated by spaces',
      function() {
        var logger = new Logger();
        var obj = { a: [1,2,3] };

        logger.log('Obj', obj);

        var completeMessage = console.log.args[0][0];
        var matchings = parseTrace(completeMessage);
        expect(matchings[MESSAGE]).toBe('Obj ' + JSON.stringify(obj));
      });
    });
  });

  describe('the `Logger`', function() {

    it('can be completely disabled', function() {
      Logger.off();

      var logger = new Logger();

      logger.log(testMessage);

      expect(console.log.called).toBe(false);
    });

    it('can be filtered by topic', function() {
      var logger1 = new Logger(testTopic);
      var logger2 = new Logger(anotherTopic);

      var filter = {};
      filter[testTopic] = true;
      filter[anotherTopic] = false;

      Logger.select(filter);

      logger1.log(testMessage);
      logger2.log(testMessage);

      expect(console.log.calledOnce).toBe(true);
      var completeMessage = console.log.args[0][0];
      expect(completeMessage.indexOf(anotherTopic)).toBe(-1)
    });

    it('allows disable all topics', function() {
      var logger1 = new Logger(testTopic);
      var logger2 = new Logger(anotherTopic);
      var logger3 = new Logger();

      Logger.disableAll();

      logger1.log(testMessage);
      logger2.log(testMessage);
      logger3.log(testMessage);

      expect(console.log.calledOnce).toBe(true);
      var completeMessage = console.log.args[0][0];
      expect(completeMessage.indexOf(anotherTopic)).toBe(-1)
      expect(completeMessage.indexOf(testTopic)).toBe(-1)
    });

    it('allows enable all topics', function() {
      var logger1 = new Logger(testTopic);
      var logger2 = new Logger(anotherTopic);
      var logger3 = new Logger();

      Logger.enableAll();

      logger1.log(testMessage);
      logger2.log(testMessage);
      logger3.log(testMessage);

      expect(console.log.calledThrice).toBe(true);
      var completeMessage = console.log.args[0][0];
      expect(completeMessage.indexOf(testTopic)).not.toBeLessThan(0)
      completeMessage = console.log.args[1][0];
      expect(completeMessage.indexOf(anotherTopic)).not.toBeLessThan(0)
    });

    it('allows enable some topics', function() {
      var logger1 = new Logger(testTopic);
      var logger2 = new Logger(anotherTopic);
      var logger3 = new Logger(additionalTopic);

      Logger.disableAll();
      Logger.enable(testTopic, anotherTopic)

      logger1.log(testMessage);
      logger2.log(testMessage);
      logger3.log(testMessage);

      expect(console.log.calledTwice).toBe(true);
      var completeMessage = console.log.args[0][0];
      expect(completeMessage.indexOf(testTopic)).not.toBeLessThan(0)
      completeMessage = console.log.args[1][0];
      expect(completeMessage.indexOf(anotherTopic)).not.toBeLessThan(0)
    });

    it('allows disable some topics', function() {
      var logger1 = new Logger(testTopic);
      var logger2 = new Logger(anotherTopic);
      var logger3 = new Logger(additionalTopic);

      Logger.enableAll();
      Logger.disable(testTopic, anotherTopic)

      logger1.log(testMessage);
      logger2.log(testMessage);
      logger3.log(testMessage);

      expect(console.log.calledOnce).toBe(true);
      var completeMessage = console.log.args[0][0];
      expect(completeMessage.indexOf(additionalTopic)).not.toBeLessThan(0)
    });

    it('preserves configuration when a new logger with an ' +
       'already used topic is created', function() {
      var logger1 = new Logger(testTopic);

      Logger.disable(logger1);
      var logger2 = new Logger(testTopic);
      logger2.log(testMessage);

      expect(console.log.called).toBe(false);
    });

  });

});
