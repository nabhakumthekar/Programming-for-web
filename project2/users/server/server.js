const express = require('express');
const bodyParser = require('body-parser');


const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const MOVED_PERMANENTLY = 301;
const FOUND = 302;
const SEE_OTHER = 303;
const NOT_MODIFIED = 303;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function serve(port, model) {
  const app = express();
  app.locals.model = model;
  app.locals.port = port;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


function setupRoutes(app) {
  app.use('/users/:id', bodyParser.json());
  app.use('/users/:id', cacheUser(app));
  app.put('/users/:id', newUser(app));
  app.get('/users/:id', getUser(app));
  app.delete('/users/:id', deleteUser(app));
  app.post('/users/:id', updateUser(app));
}

module.exports = {
  serve: serve
}

function getUser(app) {
  return function(request, response) {
    if (!request.user) {
      response.sendStatus(NOT_FOUND);
    }
    else {
      response.json(request.user);
    }
  };
}

function deleteUser(app) {
  return function(request, response) {
    if (!request.user) {
      response.sendStatus(NOT_FOUND);
    }
    else {
      request.app.locals.model.users.deleteUser(request.params.id).
	then(() => response.sendStatus(NO_CONTENT)).
	catch((err) => {
	  console.error(err);
	  response.sendStatus(SERVER_ERROR);
	});
    }
  };
}

function newUser(app) {
  return function(request, response) {
    const userInfo = request.body;
    const id = request.params.id;
    if (typeof userInfo === 'undefined') {
      console.error(`missing body`);
      response.sendStatus(BAD_REQUEST);
    }
    else if (request.user) {
      request.app.locals.model.users.updateUser(id, userInfo).
	then(function(id) {
	  response.sendStatus(NO_CONTENT);
	}).
	catch((err) => {
	  console.error(err);
	  response.sendStatus(SERVER_ERROR);
	});
    }
    else {
      request.app.locals.model.users.newUser(id, userInfo).
	then(function(id) {
	  response.redirect(CREATED, requestUrl(request));
	}).
	catch((err) => {
	  console.error(err);
	  response.sendStatus(SERVER_ERROR);
	});
    }
  };
}

function updateUser(app) {
  return function(request, response) {
    const id = request.params.id;
    const userInfo = request.body;
    if (!request.user) {
      console.error(`user ${request.params.id} not found`);
      response.sendStatus(NOT_FOUND);
    }
    else {
      request.app.locals.model.users.updateUser(id, userInfo).
	then(function(id) {
	  response.redirect(SEE_OTHER, requestUrl(request));
	}).
	catch((err) => {
	  console.error(err);
	  response.sendStatus(SERVER_ERROR);
	});
    }
  };
}

function cacheUser(app) {
  return function(request, response, next) {
    const id = request.params.id;
    if (typeof id === 'undefined') {
      response.sendStatus(BAD_REQUEST);
    }
    else {
      request.app.locals.model.users.getUser(id, false).
	then(function(user) {
	  request.user = user;
	  next();
	}).
	catch((err) => {
	  console.error(err);
	  response.sendStatus(SERVER_ERROR);
	});
    }
  }
}

//Should not be necessary but could not get relative URLs to work
//in redirect().
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}

