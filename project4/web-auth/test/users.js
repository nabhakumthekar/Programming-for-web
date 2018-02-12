'use strict';

const assert = require('assert');

const users = require('../users/users.js');

const WS_URL = 'https://localhost:1236';
const PASSWORD = 'abcd1234';

const INFO = { firstName: 'test', lastName: 'user' };

function infoEquals(info1, info2=INFO) {
  const keys1 = Object.keys(info1);
  const keys2 = Object.keys(info2);
  return keys1.length === keys2.length &&
    keys1.each((k) => info1[k] === info2[k]);
}

describe("users web services", function() {

  let ws = null;
  let userId = null;
  let authToken = null;

  before("create instance", function(done) {
    ws = new users.Users(WS_URL);
    userId = `test-${String(new Date().getTime())}`;
    ws.register(userId, PASSWORD, INFO).then(function(result) {
      assert.strictEqual(result.status, 'CREATED');
      authToken = result.authToken;
      assert.notEqual(authToken, null);
      done();
    });
  });

  it("must access user info", function(done) {
    ws.info(userId, authToken).
      then((info) => assert.deepStrictEqual(info, INFO));
    done();
  });

  it("must login and access user info", function(done) {
    ws.login(userId, PASSWORD).
      then(function(result) {
	assert.strictEqual(result.status, 'OK');
	const loginToken = result.authToken;
	assert.notStrictEqual(authToken, null);
	return authToken;
      }).
      then(function(loginToken) {
	ws.info(userId, loginToken).
	  then((info) => assert.deepStrictEqual(info, INFO));
	done();
      });
  });

  it("duplicate registration must fail", function(done) {
    ws.register(userId, PASSWORD, INFO).
      then(function(result) {
	assert.strictEqual(result.status, 'EXISTS');
	done();
      });
  });
  
  it("login with bad userId must fail", function(done) {
    ws.login(userId + 'x', PASSWORD, INFO).
      then(function(result) {
	assert.strictEqual(result.status, 'ERROR_NOT_FOUND');
	done();
      });
  });
  
  it("login with bad password must fail", function(done) {
    ws.login(userId, PASSWORD + 'x', INFO).
      then(function(result) {
	assert.strictEqual(result.status, 'ERROR_UNAUTHORIZED');
	done();
      });
  });
  
  it("access user info with bad userId must fail", function(done) {
    ws.info(userId + 'x', authToken).
      then(function(result) {
	assert.strictEqual(result.status, 'ERROR_NOT_FOUND');
	done();
      });
  });

  it("access user info with bad authToken must fail", function(done) {
    ws.info(userId, '').
      then(function(result) {
	assert.strictEqual(result.status, 'ERROR_UNAUTHORIZED');
	done();
      });
  });
  
});
