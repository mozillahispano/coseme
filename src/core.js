
(function(global) {
  'use strict';

  global.CoSeMe = global.CoSeMe || {};

  function addAsConstructor(namespace, constructor) {
    namespace[constructor.name] = constructor;
  }

  function addAsSet(namespace, set) {
    var descriptor;
    for (var member in set) if (set.hasOwnProperty(member)) {
      descriptor = Object.getOwnPropertyDescriptor(set, member);
      Object.defineProperty(namespace, member, descriptor);
    }
  }

  global.CoSeMe.namespace = function (path, obj) {
    var name, pathNames = path.split('.');
    var currentNamespace = this;

    for (var remaining = pathNames.length; remaining; remaining--) {
      name = pathNames.shift();
      if (!name) continue;

      if (currentNamespace[name] === undefined) {
        currentNamespace[name] = {};
      }

      currentNamespace = currentNamespace[name];

      if (remaining === 1) {

        switch(typeof obj) {
          case 'function':
            if (!obj.name) {
              throw new Error('Error adding constructor to "' + name + '". ' +
                              'The constructor has no name.');
            } else {
              addAsConstructor(currentNamespace, obj);
            }
            break;

          case 'object':
            addAsSet(currentNamespace, obj);
            break;

          default:
            throw new Error('Error extending namespace "' + name + '". ' +
                            'Only objects or constructors can be added to ' +
                            'namespaces');
            break;
        }
      }
    }
    return currentNamespace;
  };

}(this));
