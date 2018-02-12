'use strict';

const dbOps = require('../db_ops_lib');

const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const url = 'mongodb://localhost:27017/test_db';
const collection = 'tests';

describe("dbops-with-callbacks", function() {

  function makeOp(op, args) {
    args = args || 'null'
    return ` {
      "op": "${op}",
      "collection": "${collection}",
      "args": ${args}
    } `
  }

  function verify(db, collection, query, condition, callback) {
    const coll = db.collection(collection);
    coll.find(query).toArray(
      function(err, docs) {
	assert.strictEqual(err, null);
	condition(docs);
	if (callback) callback();
      });
  }

  const DATA1 = [
    { "x": 1 },
    { "y": 22 },
    { "z": 32 }
  ]
    

  let db = null;

  before("connect", function(done) {
    mongo.connect(url, function(err, conn) {
      assert.strictEqual(err, null);
      db = conn;
      done();
    })
  });

  after(function(done) {
    db.close();
    done();
  });


  beforeEach("clear collection",  function(done) {
    db.collection(collection)
      .deleteMany({}, function(err, r) {
	assert.strictEqual(err, null);
	done();
      });
  });

  afterEach("clear collection",  function(done) {
    db.collection(collection)
      .deleteMany({}, function(err, r) {
	assert.strictEqual(err, null);
	done();
      });
  });

  
  it('should find inserted docs', function(done) {
    const op = makeOp('create', JSON.stringify(DATA1));
    dbOps.dbOp(url, op, function(err, result) {
      assert.strictEqual(err, null);
      verify(db, collection, {},
	     (docs) => assert.strictEqual(docs.length, DATA1.length));
      for (const d of DATA1) {
  	verify(db, collection, d,
	       (docs) => assert.strictEqual(docs.length, 1));
      }
      done();
    });
  });
	    
  it('should delete inserted docs', function(done) {
    const createOp = makeOp('create', JSON.stringify(DATA1));
    dbOps.dbOp(url, createOp, function(err, result) {
      assert.strictEqual(err, null);
      const data1 = DATA1.slice();
      const d = data1.pop();
      const deleteOp = makeOp('delete', JSON.stringify(d));
      dbOps.dbOp(url, deleteOp, function(err, result) {
	assert.strictEqual(err, null);
	verify(db, collection, {},
	       (docs) => assert.strictEqual(docs.length, data1.length),
	       done);
      });
    });
  });
	    
  const ARG = 'v';
  const KEY = 'x', VALUE = 42;
  const BODY = `
    { return (typeof ${ARG}.${KEY} === 'undefined')
      ? ${ARG}
      : {${KEY}: ${VALUE}};
    }`;
  
  it('should update inserted docs', function(done) {
    const createOp = makeOp('create', JSON.stringify(DATA1));
    dbOps.dbOp(url, createOp, function(err, result) {
      assert.strictEqual(err, null);
      const data1 = DATA1.map(function(d) {
	return (typeof d[KEY] === 'undefined') ? d : { [KEY]: VALUE };
      });
      const updateOp = JSON.stringify(
	{ op: 'update', collection: collection, fn: [ ARG, BODY ] });
      dbOps.dbOp(url, updateOp, function(err, result) {
  	assert.strictEqual(err, null);
  	verify(db, collection, {},
  	       (docs) => {
		 const docs1 = docs.map((d) => {
		   const d1 = Object.assign({}, d);
		   delete(d1._id);
		   return d1;
		 });
  		 assert.strictEqual(docs.length, data1.length);
  		 assert.deepEqual(docs1, data1);
  	       },
  	       done);
      });
    });
  });
	    
});

