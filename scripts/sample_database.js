#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

var archdb = require('archdb');
var Faker = require('Faker');
var wrench = require('wrench');

var dbPath = path.join(process.env.HOME, '.archdb-sample');

if (fs.existsSync(dbPath)) wrench.rmdirSyncRecursive(dbPath);
fs.mkdirSync(dbPath);

function newCustomer() {
  return {
    name: Faker.Name.findName(),
    gender: Faker.Helpers.randomize(['male', 'female']),
    email: Faker.Internet.email(),
    address: {
      zipCode: Faker.Address.zipCode(),
      city: Faker.Address.city(),
      streetAddress: Faker.Address.streetAddress(),
      usState: Faker.Address.usState()
    },
    phone: Faker.PhoneNumber.phoneNumber(),
    dateOfBirth: Faker.Helpers.randomize([
      new Date(Date.UTC(1984, 7, 17, 5, 50)),
      new Date(Date.UTC(1982, 8, 14, 14, 15)),
      new Date(Date.UTC(1970, 1, 2, 4)),
      new Date(Date.UTC(1995, 3, 5, 22)),
      new Date(Date.UTC(2000, 11, 10, 10))
    ])
  };
}

var batchSize = 100000;
var remaining = 200000;

function checkUsage() {
  if (remaining > 0) setImmediate(function() { insert(batchSize); });
  else console.log('Start: ', begin, 'End:', new Date());
}

function insert(total) {
  var db = archdb.db({type: 'local', storage: 'leveldb', path: dbPath})
  // var db = archdb.db({type: 'local', storage: 'fs', path: dbPath})
  db.open(function(err) {
    db.begin(function(err, tx) {
      if (err) throw err;
      var customers = tx.domain('customers');
      var count = 0;
      function next() {
        customers.ins(newCustomer(), function(err, key) {
          if (err) throw err;
          if (++count % 10000 === 0) console.log('Row count', key);
          if (count === total){
            return tx.commit(function(err) {
              if (err) throw err;
              db.close(function(err) {
                if (err) throw err;
                setImmediate(checkUsage);
                remaining -= count;
              });
            });
          }
          setImmediate(next);
        });
      }
      next();
    });
  });
}


var begin = new Date();
insert(batchSize);

