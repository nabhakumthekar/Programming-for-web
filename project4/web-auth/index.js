#!/usr/bin/env nodejs

'use strict';

//nodejs dependencies
const fs = require('fs');
const process = require('process');

//external dependencies
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');
const mustache = require('mustache');

//local dependencies
const options = require('./options');
const users = require('./users/users');

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

const USER_COOKIE_SEPARATOR = '|';
const USER_COOKIE = 'userId';

const MIN_PW_LENGTH = 8;

const LOGIN_URL = '/login.html';
const REGISTER_URL = '/register.html';
const ACCOUNT_URL = '/user-account.html';
const LOGOUT_URL = '/logout';

/*************************** Form Definitions **************************/

const LOGIN_FORM = {
  title: 'User LOGIN',
  url: LOGIN_URL,
  action: 'Login',
  linkUrl: REGISTER_URL,
  linkAction: 'Register',
  infos: [
    {
      name: 'email',
      friendlyName: 'Email Address',
      checkFn: 	(v, info) => v.match(/^.+\@.+$/),
      errorFn: (v, info) =>
	`The ${info.friendlyName} must be of the form "user@domain".`
    },
    {
      name: 'password',
      friendlyName: 'Password',
      type: 'password',
      checkFn: 	(v, info) => //not necessary as per specs
	v.length >= MIN_PW_LENGTH && v.match(/\d/) && !v.match(/\s/),
      errorFn: (v, info) =>
	`The ${info.friendlyName} must contain at least ${MIN_PW_LENGTH} ` +
	`non-space characters with at least one digit.`
    },
  ],
};

const REGISTRATION_FORM = {
  title: 'User Registration',
  url: REGISTER_URL,
  action: 'Register',
  linkUrl: LOGIN_URL,
  linkAction: 'Login',
  infos: [
    {
      name: 'firstName',
      friendlyName: 'First Name'
    },
    {
      name: 'lastName',
      friendlyName: 'Last Name'
    },
    {
      name: 'email',
      friendlyName: 'Email Address',
      checkFn: 	(v, info) => v.match(/^.+\@.+$/),
      errorFn: (v, info) =>
	`The ${info.friendlyName} must be of the form "user@domain".`
    },
    {
      name: 'password',
      friendlyName: 'Password',
      type: 'password',
      checkFn: 	(v, info) =>
	v.length >= MIN_PW_LENGTH && v.match(/\d/) && !v.match(/\s/),
      errorFn: (v, info) =>
	`The ${info.friendlyName} must contain at least ${MIN_PW_LENGTH} ` +
	`non-space characters with at least one digit.`
    },
    {
      name: 'confirmPassword',
      friendlyName: 'Confirm Password',
      type: 'password',
    }	  
  ],
  multiCheckers: [
    {
      names: [ 'confirmPassword', 'password' ],
      multiCheckFn: (values, infos) =>
	values.password === values.confirmPassword,
      multiErrorFn: (values, infos) =>
       `The ${infos.confirmPassword.friendlyName} and ` +
 	  `${infos.password.friendlyName} fields do not match`
    }
  ]
};

/*************************** Route Handling ****************************/

function setupRoutes(app) {
  app.get('/', rootRedirectHandler(app));
  app.get(LOGIN_URL, loginDisplayHandler(app));
  app.get(REGISTER_URL, registrationDisplayHandler(app));
  app.post(LOGIN_URL, loginHandler(app));
  app.post(REGISTER_URL, registrationHandler(app));
  app.get(ACCOUNT_URL, userAccountDisplayHandler(app));
  app.post(LOGOUT_URL, logoutHandler(app));
}

function rootRedirectHandler(app) {
  return function(req, res) {
    res.redirect(ACCOUNT_URL);
  };
}

function loginDisplayHandler(app) {
  return function(req, res) {
    displayHandler(app, LOGIN_FORM, res);
  };
}

function loginHandler(app) {
  return function(req, res) {
    const form = LOGIN_FORM;
    const [values, errors] = valuesAndErrors(form, req);
    if (errors.hasErrors() > 0) {
      displayHandler(app, LOGIN_FORM, res, values, errors);
    }
    else {
      app.users.login(values.email, values.password)
	.then(function(result) {
	  if (result.status === 'OK') {
	    const authInfo = new AuthInfo(values.email, result.authToken);
	    res.cookie(USER_COOKIE, authInfo.cookie(), { maxAge: 86400*1000 });
	  }
	  else {
	    errors.formError = result.info;
	  }
	})
	.catch(function(err) {
	  console.log(err);
	  errors.formError = 'Server error.';
	})
	.then(function() {
	  if (errors.hasErrors()) {
	    displayHandler(app, LOGIN_FORM, res, values, errors);
	  }
	  else {
	    res.redirect(ACCOUNT_URL);
	  }
	});      
    }
  };
}

function registrationDisplayHandler(app) {
  return function(req, res) {
    displayHandler(app, REGISTRATION_FORM, res);
  };
}

function registrationHandler(app) {
  return function(req, res) {
    const form = REGISTRATION_FORM;
    const [values, errors] = valuesAndErrors(form, req);
    if (errors.hasErrors() > 0) {
      displayHandler(app, REGISTRATION_FORM, res, values, errors);
    }
    else {
      const userInfo = {
	firstName: values.firstName,
	lastName: values.lastName
      };
      app.users.register(values.email, values.password, userInfo)
	.then(function(result) {
	  if (result.status === 'EXISTS') {
	    errors.formError = result.info;
	  }
	  else {
	    const authInfo = new AuthInfo(values.email, result.authToken);
	    res.cookie(USER_COOKIE, authInfo.cookie(), { maxAge: 86400*1000 });
	  }
	})
	.catch(function(err) {
	  console.log(err);
	  errors.formError = 'Server error.';
	})
	.then(function() {
	  if (errors.hasErrors()) {
	    displayHandler(app, REGISTRATION_FORM, res, values, errors);
	  }
	  else {
	    res.redirect(ACCOUNT_URL);
	  }
	});      
    }
  };
}

function userAccountDisplayHandler(app) {
  return function(req, res) {
    if (!req.cookies[USER_COOKIE]) {
      displayHandler(app, LOGIN_FORM, res);
    }
    else {
      const authInfo = new AuthInfo(req.cookies[USER_COOKIE]);
      app.users.info(authInfo.id, authInfo.authToken)
	.then(function(result) {
	  if (result.status) {
	    res.redirect(LOGIN_URL);
	  }
	  else {
	    res.send(doMustache(app, 'user-account', result));
	  }
	})
	.catch(function(err) {
	  console.log(err);
	  res.redirect(LOGIN_URL);
	});
    }
  };
}

function logoutHandler(app) {
  return function(req, res) {
    res.cookie(USER_COOKIE, '', { maxAge: -1 });
    res.redirect('/');
  };
}

/************************** Form Utilities *****************************/

function displayHandler(app, form, res, values={}, errors={}) {
  const fields =
    form.infos.map((info) => ({
      info: info,
      value: info.type === 'password' ? '' :  values[info.name],
      error: errors[info.name]
    }));
  const view = {
    title: form.title,
    action: form.action,
    url: form.url,
    linkAction: form.linkAction,
    linkUrl: form.linkUrl,
    errors: errors,
    fields: fields
  };
  res.send(doMustache(app, 'form', view));
}

function valuesAndErrors(form, req) {
  const values = {};
  const errors = new Errors();
  for (const info of form.infos) {
    const name = info.name;
    const v = req.body[name];
    values[name] = v;
    if (!info.isOptional &&
	(typeof v === 'undefined' || v === null || v.trim().length == 0)) {
      errors[name] = `${info.friendlyName} must be specified`;
    }
    else if (v && info.checkFn) {
      if (!info.checkFn(v, info)) {
	if (info.errorFn) {
	  errors[name] = info.errorFn(v, info);
	}
	else {
	  errors[name] = `Bad value for ${info.friendlyName}`;
	}
      }
    }
  }
  multiCheck(form, values, errors);
  const ret = [values, errors];
  return ret;
}

function multiCheck(form, values, errors) {
  if (!form.multiCheckers) return;
  const infos = {};
  form.infos.forEach((info) => infos[info.name] = info);
  const multiCheckers = form.multiCheckers || []
  for (const checker of multiCheckers) {
    const {multiCheckFn, names, multiErrorFn, errorKey} = checker;
    if (names && names.length > 0 && multiCheckFn &&
	names.every((n) => values[n])) {
      if (!multiCheckFn(values, infos)) {
	errors[errorKey || names[0]] =  multiErrorFn(values, infos);
      }
    }
  }
}

  
/****************************** Utilities ******************************/

function Errors() { }
Errors.prototype.hasErrors = function() {
  return Object.keys(this).length > 0;
};

function AuthInfo() {
  let id = null, authToken = null;
  if (arguments.length === 1) {
    [authToken, id] = arguments[0].split(USER_COOKIE_SEPARATOR);
  }
  else {
    [id, authToken] = arguments;
  }
  this.id = id;
  this.authToken = authToken;
}
AuthInfo.prototype.id = function() { return this.id; }  
AuthInfo.prototype.authToken = function() { return this.authToken; }  
AuthInfo.prototype.cookie = function() {
  return `${this.authToken}${USER_COOKIE_SEPARATOR}${this.id}`;
}
  
function doMustache(app, templateId, view) {
  const templates = { footer: app.templates.footer };
  return mustache.render(app.templates[templateId], view, templates);
}

/*************************** Initialization ****************************/

function setupTemplates(app) {
  app.templates = {};
  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

function initialize(options) {
  console.log(options);
  process.chdir(__dirname);
  const port = options.port;
  console.log(port);
  const app = express();
  app.use(cookieParser());
  setupTemplates(app);
  app.users = new users.Users(options.wsUrl);
  app.use(express.static(STATIC_DIR));
  app.use(bodyParser.urlencoded({extended: true}));
  setupRoutes(app);
  https.createServer({
    key: fs.readFileSync(`${options.sslDir}/key.pem`),
    cert: fs.readFileSync(`${options.sslDir}/cert.pem`),
  }, app).listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

initialize(options);
