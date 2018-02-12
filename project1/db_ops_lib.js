'use strict';

const assert = require('assert');
const mongo = require('mongodb').MongoClient;


//used to build a mapper function for the update op.  Returns a
//function F = arg => body.  Subsequently, the invocation,
//F.call(null, value) can be used to map value to its updated value.
function newMapper(arg, body) {
  return new (Function.prototype.bind.call(Function, Function, arg, body));
}

//print msg on stderr and exit.
function error(msg) {
  console.error(msg);
  process.exit(1);
}

//export error() so that it can be used externally.
module.exports.error = error;

function db_close(db, callback) {
  if (typeof callback === 'undefined') {
    db.close(); //assume app exits only after close() completes
  }
  else {
    db.close(callback);
  }
}


function doCreate(db, op, callback) {
  assert.strictEqual(op.op, 'create');
  const collection = op.collection;
  if (!collection) {
    error(`no collection specified for ${JSON.stringify(op)}`);
  }
  const data = op.args || [];
  db.collection(collection).insertMany(data, function(err, result) {
    assert.strictEqual(err, null);
    assert.strictEqual(result.insertedCount, data.length);
    db_close(db, callback);
  });
}

function doRead(db, op, callback) {
  assert.strictEqual(op.op, 'read');
  const collection = op.collection;
  if (!collection) {
    error(`no collection specified for ${JSON.stringify(op)}`);
  }
  const q = op.args || {};
  db.collection(collection).find(q).toArray(function(err, data) {
    assert.strictEqual(err, null);
    data.forEach(function(d) { console.log(d); });
    db_close(db, callback);
  });
}

function doUpdate(db, op, callback) {
  assert.strictEqual(op.op, 'update');
  const collection = op.collection;
  if (!collection) {
    error(`no collection specified for ${JSON.stringify(op)}`);
  }
  const q = op.args || {};
  const fn = op.fn;
  if (!fn) {
    error(`no fn specified for update in ${JSON.stringify(op)}`);
  }
  if (!fn instanceof Array || fn.length != 2) {
    error(`bad fn specified for update in ${JSON.stringify(op)}`);
  }
  const mapper = newMapper(fn[0], fn[1]);
  const coll = db.collection(collection);
  coll.find(q).toArray(function(err, data) {
    assert.strictEqual(err, null);
    let n = 0;
    data.forEach(function(d) {
      const d1 = mapper.call(null, d);
      coll.updateOne(d, d1, function(err, result) {
	assert.strictEqual(err, null);
	assert.strictEqual(result.matchedCount, 1);
	n += 1;
	if (n === data.length) db_close(db, callback);
      });
    });
  });
}

function doDelete(db, op, callback) {
  assert.strictEqual(op.op, 'delete');
  const collection = op.collection;
  if (!collection) {
    error(`no collection specified for ${JSON.stringify(op)}`);
  }
  const q = op.args || {};
  db.collection(collection).deleteMany(q, function(err, result) {
    assert.strictEqual(err, null);
    db_close(db, callback);
  });
}

function doJsonOp(db, op, callback) {
  switch (op.op) {
  case 'create':
    return doCreate(db, op, callback);
    break;
  case 'read':
    return doRead(db, op, callback);
    break;
  case 'update':
    return doUpdate(db, op, callback);
    break;
  case 'delete':
    return doDelete(db, op, callback);
    break;
  default:
    error(`unknown op ${op.op}`);
  }
}

//perform op on mongo db specified by url.
function dbOp(url, op, callback) {
  mongo.connect(url, function(err, db) {
    doJsonOp(db, JSON.parse(op), callback);
  });
}

//make main dbOp() function available externally
module.exports.dbOp = dbOp;

