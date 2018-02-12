const assert = require('assert');

const USERS = 'users';
const DATA = '_data';
const PASSWORD = '_password';

const EXISTS_ERROR = 11000;

function Users(db) {
  this.db = db;
  this.users = db.collection(USERS);
}

Users.prototype.getUser = function(id) {
  const searchSpec = { _id: id };
  return this.users.find(searchSpec).toArray().
    then(function(users) {
      return new Promise(function(resolve, reject) {
	if (users.length === 1) {
	  resolve([users[0][DATA], users[0][PASSWORD]]);
	}
	else if (users.length === 0) {
	  resolve('NOT_FOUND');
	}
	else {
	  reject(new Error(`cannot find user ${id}`));
	}
      });
    });
}

Users.prototype.newUser = function(id, password, user) {
  const d = { _id: id, [PASSWORD]: password, [DATA]: user };
  return this.users.insertOne(d)
    .then(function(results) {
      return new Promise((resolve) => resolve(results.insertedId));      
    })
    .catch(function(err) {
      throw (err.code && err.code === EXISTS_ERROR) ? "EXISTS" : err;
    });
}

module.exports = {
  Users: Users
};
