'use strict';

const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto-js');

const assert = require('assert');
const fs = require('fs');
const https = require('https');


const CREATED = 201;
const SEE_OTHER = 303;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const UNAUTHORIZED = 401;
const SERVER_ERROR = 500;


/*************************** Route Handlers ****************************/

function setupRoutes(app) {
  app.use(cors());
  app.use('/hello', function(req, res) { res.json({ hello: 'world' }); });
  app.use('/users/:id', bodyParser.json());
  app.put('/users/:id', registerUserHandler(app));
  app.get('/users/:id', getUserHandler(app));
  app.put('/users/:id/auth', loginUserHandler(app));
}

function registerUserHandler(app) {
  return function(req, res) {
    if (validateRegistrationParams(req, res)) {
      const id = req.params.id;
      const pw = req.query.pw;
      const userInfo = req.body;
      req.app.locals.model.users.newUser(id, hashPassword(pw), userInfo).
	then(function(insertId) {
	  assert.strictEqual(insertId, id);
	  const authToken = makeAuthToken(app, id);
	  res.set('Location', requestUrl(req));
	  res.status(CREATED).json({ status: 'CREATED', authToken: authToken });
	}).
	catch((err) => {
	  if (err === 'EXISTS') {
	    res.set('Access-Control-Expose-Headers', 'Location');
	    res.set('Location', requestUrl(req));
	    res.status(SEE_OTHER)
	      .json({ status: 'EXISTS',
		      info: `user ${id} already exists` });
	  }
	  else {
	    serverError(err, res);
	  }});
    }
  };
}

function validateRegistrationParams(req, res) {
  const pw = req.query.pw;
  const userInfo = req.body;
  let isOk = true;
  if (typeof userInfo === 'undefined') {
    console.error(`missing body`);
    res.status(BAD_REQUEST)
      .json({ status: 'missing-body',
	      info: 'register request must have a body'});
    isOk = false;
  }
  else if (typeof pw === 'undefined' || pw.trim().length === 0) {
    console.error(`missing password`);
    res.status(BAD_REQUEST)
      .json({ status: 'missing-password',
	      info: 'register request must have a pw query parameter'});
    isOk = false;
  }
  return isOk;
}

function getUserHandler(app) {
  return function(req, res) {
    const id = req.params.id;
    const auth = getBearerAuth(req);
    getUserInfo(app, id, res)
      .then(function(userInfo) {
	if (userInfo && (!auth || !checkAuthToken(id, auth))) {
	  res.status(UNAUTHORIZED)
	    .json( { "status": "ERROR_UNAUTHORIZED",
		     "info": `/users/${id} requires a bearer ` +
		             `authorization header`
		   });
	}
	else if (userInfo) {
	  res.json(userInfo);
	}
      });
  };
}


function loginUserHandler(app) {
  return function(req, res) {
    const id = req.params.id;
    const pw = req.body.pw;
    if (typeof pw === 'undefined' || pw.trim().length === 0) {
      sendUnauthorized(id, res);
    }
    else {
      getUserInfo(app, id, res, pw)
	.then((userInfo) => {
	  if (userInfo) {
	    res.json({ status: 'OK', authToken: makeAuthToken(app, id) });
	  }
	})
	.catch((err) => { serverError(err, res); });
    }
  }
}


function getUserInfo(app, id, res, pw) {
  return app.locals.model.users.getUser(id).
    then((info) => {
      if (info === 'NOT_FOUND') {
	res.status(NOT_FOUND)
	  .json( { status: 'ERROR_NOT_FOUND', info: `user ${id} not found` });
	return Promise.resolve(null);
      }
      else if (Array.isArray(info)) {
	if (pw && !checkPassword(pw, info[1])) {
	  sendUnauthorized(id, res);
	  return Promise.resolve(null);
	}
	return Promise.resolve(info[0]);
      }
      else {
	return Promise.resolve(null);
      }
    });
}

/*********************** Authentication Token **************************/

const SECRET = '!@1aSd*$aANE#'

function makeAuthToken(app, id) {
  const expiryTime = Date.now() + app.locals.authTimeout;
  const text = String(expiryTime) + ':' + id;
  return crypto.AES.encrypt(text, SECRET).toString();
}

function checkAuthToken(id, auth) {
  try {
    const text = crypto.AES.decrypt(auth, SECRET).toString(crypto.enc.Utf8);
    const m = text.match(/^(\d+):(.+)$/);
    return m && Date.now() < Number(m[1]) && m[2] === id;
  }
  catch (err) {
    return false;
  }
}

/*************************** Password Routines *************************/

const ROUNDS = 10;
function hashPassword(password) {
  return bcrypt.hashSync(password, ROUNDS);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

/************************* Utility Functions ***************************/

function sendUnauthorized(id, res) {
  res.status(UNAUTHORIZED)
    .json( { status: 'ERROR_UNAUTHORIZED',
	     info: `/users/${id}/auth requires a valid 'pw' `+
	           `password query parameter` });
}

function getBearerAuth(req) {
  const authorization = req.get('authorization');
  const m = authorization && authorization.match(/^\s*bearer\s*(\S+)/i);
  return m && m[1];
}

function serverError(err, res) {
  console.error(err);
  res.status(SERVER_ERROR)
    .json({ status: 'SERVER_ERROR',
	    info: 'a server error occurred' });
}

function requestUrl(req) {
  const port = req.app.locals.port;
  const url = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  const qIndex = url.indexOf('?');
  return (qIndex < 0) ? url : url.substr(0, qIndex);
}

/************************** Initialization *****************************/

function serve(options, model) {
  const port = options.port;
  const app = express();
  app.locals.model = model;
  app.locals.port = port;
  app.locals.authTimeout = options.authTimeout*1000;
  setupRoutes(app);
  https.createServer({
    key: fs.readFileSync(`${options.sslDir}/key.pem`),
    cert: fs.readFileSync(`${options.sslDir}/cert.pem`),
  }, app).listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = {
  serve: serve
};
