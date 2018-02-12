#!/usr/bin/env nodejs

'use strict';

const path = require('path');  //for basename

//most code lives in db_ops_lib.js.  Must provide dbOp() and error().
const dbOps = require('./db_ops_lib'); 

if (process.argv.length != 4) {
  //check for correct number of cli arguments:
  //  0: path to nodejs
  //  1: program name db_ops
  //  2: URL
  //  3: OP
  dbOps.error(`usage: ${path.basename(process.argv[1])} MONGO_URL JSON_OP`);
}
process.argv.shift();              //remove path to nodejs
process.argv.shift();              //remove program name
const url = process.argv.shift();  //get db url
try {
  dbOps.dbOp(url, process.argv[0]);
}
catch(ex) {
  dbOps.error(ex);
}
  

	      
