'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const axios = require('axios');

function Users(baseUrl) {
  this.baseUrl = baseUrl;
}

//All action functions return promises.

Users.prototype.register = function(id, pw, info) {
  return axios.put(`${this.baseUrl}/users/${id}?pw=${pw}`,
		   info, { maxRedirects: 0 })
    .then((response) => response.data)
    .catch(function(err) {
      const status = err.response.status;
      if (status === 303) {
	return err.response.data;
      }
      else {
	throw err;
      }
    });
}

Users.prototype.login = function(id, pw) {
  return axios.put(`${this.baseUrl}/users/${id}/auth`,
		   { pw: pw }, { maxRedirects: 0 })
    .then((response) => response.data)
    .catch(function(err) {
      const status = err.response.status;
      if (status === 401 || status === 404) {
	return err.response.data;
      }
      else {
	throw err;
      }
    });
}

Users.prototype.info = function(id, authToken) {
  return axios.request({ url: `${this.baseUrl}/users/${id}`,
			 method: 'get',
			 headers: {
			   Authorization: `Bearer ${authToken}`
			 }
		       })
    .then((response) => response.data)
    .catch(function(err) {
      const status = err.response.status;
      if (status === 401 || status === 404) {
	return err.response.data;
      }
      else {
	throw err;
      }
    });

}


module.exports = { Users: Users };
