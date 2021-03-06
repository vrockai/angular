import {ddescribe, describe, it, iit, xit, expect, beforeEach, afterEach} from 'angular2/test_lib';

import { StringMap, ListWrapper } from 'angular2/src/facade/collection';
import { isPresent, StringWrapper } from 'angular2/src/facade/lang';
import { PromiseWrapper } from 'angular2/src/facade/async';

import { WebDriverExtension, bind, Injector, Options } from 'benchpress/benchpress';

export function main() {
  function createExtension(ids, caps) {
    return new Injector([
      ListWrapper.map(ids, (id) => bind(id).toValue(new MockExtension(id)) ),
      bind(Options.CAPABILITIES).toValue(caps),
      WebDriverExtension.bindTo(ids)
    ]).asyncGet(WebDriverExtension);
  }

  describe('WebDriverExtension.bindTo', () => {

    it('should bind the extension that matches the capabilities', (done) => {
      createExtension(['m1', 'm2', 'm3'], {'browser': 'm2'}).then( (m) => {
        expect(m.id).toEqual('m2');
        done();
      });
    });

    it('should throw if there is no match', (done) => {
      PromiseWrapper.catchError(
        createExtension(['m1'], {'browser': 'm2'}),
        (err) => {
          expect(isPresent(err)).toBe(true);
          done();
        }
      );
    });

  });
}

class MockExtension extends WebDriverExtension {
  id:string;

  constructor(id) {
    super();
    this.id = id;
  }

  supports(capabilities:StringMap):boolean {
    return StringWrapper.equals(capabilities['browser'], this.id);
  }
}
