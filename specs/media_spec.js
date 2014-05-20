describe('CoSeMe media', function() {

  describe('the `media` object', function() {
    it('exists', function() {
      expect(CoSeMe.media).toBeDefined();
    });

    it('has a upload() method', function() {
      expect(CoSeMe.media.upload).toBeDefined();
    });

    it('has a download() method', function() {
      expect(CoSeMe.media.download).toBeDefined();
    });
  });

  describe('the download method', function() {
    xit('gets content correctly', function() {
      var blob = null;
      var done = false;

      runs(function() {
        CoSeMe.media.download('https://www.google.es/images/srpr/logo4w.png', function(b) {
          alert('yay!');
          blob = b;
          done = true;
        });
      });

      waitsFor(function() {
        return done;
      }, 'done to be true, so onSuccess has been called', 2000);

      runs(function() {
        expect(blob).toBeDefined();
      });
    });

    it('fires onError correctly', function() {
      var done = false;
      var error;

      runs(function() {
        CoSeMe.media.download('http://www.asdfasdf.me/this/not/exist.html', null, function(e) {
          done = true;
          error = e;
        });
      });

      waitsFor(function() {
        return done;
      }, 'done to be true, so onError has been called', 2000);

      runs(function() {
        expect(error).toBeDefined();
      });
    });

    xit('fires onProgress correctly', function() {
      var done = false;
      var pr;

      runs(function() {
        CoSeMe.media.download('https://ssl.gstatic.com/s2/oz/images/up/login-f0291887b812758fc169a0282b6d8df1.png', null, null, function(pr) {
          done = true;
          pr = pr;
        });
      });

      waitsFor(function() {
        return done;
      }, 'done to be true, so onProgress has been called', 4000);

      runs(function() {
        expect(pr).toBeDefined();
      });
    });

  });

});
