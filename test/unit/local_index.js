describe('LocalIndex', function() {
  var db, dbStorage, tree, index, queue, generator, history;

  beforeEach(function(done) {
    queue = new JobQueue();
    dbStorage = new MemoryStorage();
    db = new LocalDatabase(dbStorage);
    tree = new AvlTree(dbStorage);
    history = new AvlTree(dbStorage);
    generator = new UidGenerator();
    index = new LocalIndex('test', db, dbStorage, queue, tree, history,
                           generator);
    index.id = 1;

    index.ins({name: 'doc1'});
    index.ins({name: 'doc2'});
    index.set('3', {name: 'doc3'});
    index.set([4, 3], {name: 'doc4'});
    index.set(true, {name: 'doc5'}, done);
  });

  it('insert new values using key sequence generator', function(done) {
    index.ins({name: 'doc6'}, function(err, key) {
      expect(key).to.eql(3);
      index.ins({name: 'doc7'}, function(err, key) {
        expect(key).to.eql(4);
      });
      index.find().all(function(err, items) {
        expect(rows(items)).to.deep.eql([
          row(true, {name: 'doc5'}),
          row(1, {name: 'doc1'}),
          row(2, {name: 'doc2'}),
          row(3, {name: 'doc6'}),
          row(4, {name: 'doc7'}),
          row('3', {name: 'doc3'}),
          row([4, 3], {name: 'doc4'})
        ]);
        done();
      });
    });
  });

  it('sets keys/values', function(done) {
    index.find().all(function(err, items) {
      expect(rows(items)).to.deep.eql([
        row(true, {name: 'doc5'}),
        row(1, {name: 'doc1'}),
        row(2, {name: 'doc2'}),
        row('3', {name: 'doc3'}),
        row([4, 3], {name: 'doc4'})
      ]);
      done();
    });
  });

  it('deletes keys/values', function(done) {
    index.del('3');
    index.del(2);
    index.find().all(function(err, items) {
      expect(rows(items)).to.deep.eql([
        row(true, {name: 'doc5'}),
        row(1, {name: 'doc1'}),
        row([4, 3], {name: 'doc4'})
      ]);
      done();
    });
  });

  it('returns old values when deleting keys', function(done) {
    index.del('3', function(err, oldRef) {
      expect(oldRef).to.be.instanceOf(ObjectRef);
      dbStorage.getIndexData(oldRef, function(err, oldVal) {
        expect(oldVal).to.deep.eql({name: 'doc3'});
        done();
      });
    });
  });

  it('returns old values when updating keys', function(done) {
    index.set(2, [1, 2], function(err, oldRef) {
      expect(oldRef).to.be.instanceOf(ObjectRef);
      dbStorage.getIndexData(oldRef, function(err, oldVal) {
        expect(oldVal).to.deep.eql({name: 'doc2'});
        done();
      });
    });
  });

  it('numbers are stored inline', function(done) {
    index.set(10, 11, function(err) {
      index.set(10, 12, function(err, oldVal) {
        expect(oldVal).to.eql(11);
        done();
      });
    });
  });

  it('booleans are stored inline', function(done) {
    index.set(10, true, function(err) {
      index.set(10, false, function(err, oldVal) {
        expect(oldVal).to.be.true;
        done();
      });
    });
  });

  it('appends insert history entries on each insert', function(done) {
    historyShouldEql([
      {type: 'ins', key: 1, index: 1, value: {name: 'doc1'}},
      {type: 'ins', key: 2, index: 1, value: {name: 'doc2'}},
      {type: 'ins', key: '3', index: 1, value: {name: 'doc3'}},
      {type: 'ins', key: [4, 3], index: 1, value: {name: 'doc4'}},
      {type: 'ins', key: true, index: 1, value: {name: 'doc5'}},
    ], done);
  });

  it('appends delete history entries on each delete', function(done) {
    index.del('3', function() {
      historyShouldEql([
        {type: 'ins', key: 1, index: 1, value: {name: 'doc1'}},
        {type: 'ins', key: 2, index: 1, value: {name: 'doc2'}},
        {type: 'ins', key: '3', index: 1, value: {name: 'doc3'}},
        {type: 'ins', key: [4, 3], index: 1, value: {name: 'doc4'}},
        {type: 'ins', key: true, index: 1, value: {name: 'doc5'}},
        {type: 'del', key: '3', index: 1, oldValue: {name: 'doc3'}},
      ], done);
    });
  });

  it('appends update history entries on each update', function(done) {
    index.set(2, 4);
    index.set([4, 3], 5, function() {
      historyShouldEql([
        {type: 'ins', key: 1, index: 1, value: {name: 'doc1'}},
        {type: 'ins', key: 2, index: 1, value: {name: 'doc2'}},
        {type: 'ins', key: '3', index: 1, value: {name: 'doc3'}},
        {type: 'ins', key: [4, 3], index: 1, value: {name: 'doc4'}},
        {type: 'ins', key: true, index: 1, value: {name: 'doc5'}},
        {type: 'upd', key: 2, index: 1, value: 4, oldValue: {name: 'doc2'}},
        {type: 'upd', key: [4, 3], index: 1, value: 5, oldValue: {name: 'doc4'}},
      ], done);
    });
  });

  function historyShouldEql(expected, cb) {
    var items = [], q, node;

    history.inOrder(null, function(err, next, node) {
      if (!next) {
        expect(items).to.deep.eql(expected);
        return cb();
      }
      var value = node.getValue();
      var val =
        {type: value[0], key: value[2], index: value[1], value: value[3]};
      if (val.type === HistoryEntryType.Insert) {
        val.type = 'ins';
      } else if (val.type === HistoryEntryType.Delete) {
        val.type = 'del';
        val.oldValue = val.value;
        delete val.value;
      } else {
        val.type = 'upd';
        val.oldValue = value[3];
        val.value = value[4];
      }

      items.push(val);

      if (val.value instanceof ObjectRef) {
        dbStorage.getIndexData(val.value, function(err, v) {
          val.value = v;
          if (val.oldValue instanceof ObjectRef) {
            dbStorage.getIndexData(val.oldValue, function(err, v) {
              val.oldValue = v;
              next();
            });
          } else {
            next();
          }
        });
      } else if (val.oldValue instanceof ObjectRef){
        dbStorage.getIndexData(val.oldValue, function(err, v) {
          val.oldValue = v;
          next();
        });
      } else {
        next();
      }
    })
  }
});

describe('LocalCursor', function() {
  var db, dbStorage, tree, cursor, queue;
  var expected = [
    row(1, {name: 'doc1'}),
    row(2, {name: 'doc2'}),
    row(3, 'doc3'),
    row(4, {name: 'doc4'}),
    row(5, 'doc5'),
    row('ab', 'doc6'),
    row('abc', 'doc7'),
    row([1, 2], {name: 'doc9'}),
    row([1, 2, 3], 'doc10'),
    row([1, 2, 3, 4], 'doc11')
  ];

  function testWithQuery(query, expected, desc) {
    describe(desc, function() {
      beforeEach(function(done) {
        queue = new JobQueue();
        dbStorage = new MemoryStorage();
        db = new LocalDatabase(dbStorage);
        tree = new AvlTree(dbStorage);
        cursor = new LocalCursor(dbStorage, queue, tree, query);

        insertKv(1, {name: 'doc1'}, 2, {name: 'doc2'}, 3, 'doc3', 4,
                 {name: 'doc4'}, 5, 'doc5', 'ab', 'doc6', 'abc', 'doc7',
                 [1, 2], {name: 'doc9'}, [1, 2, 3], 'doc10', 
                 [1, 2, 3, 4], 'doc11', done);
      });

      it('query each', function(done) {
        var i = 0;
        cursor.each(function(row) {
          row.ref = null;
          expect(row).to.deep.eql(expected[i++]);
        }, function() { expect(i).to.eql(expected.length); done(); });
      });

      it('query all', function(done) {
        cursor.all(function(err, items) {
          expect(rows(items)).to.deep.eql(expected);
          done();
        });
      });

      it('query one', function(done) {
        cursor.one(function(err, row) {
          row.ref = null;
          expect(row).to.deep.eql(expected[0]);
          done();
        });
      });
    });
  }

  testWithQuery(null, expected, 'without query');
  testWithQuery({$lte: 5}, expected.slice(0, 5), 'with query: $lte: 5');
  testWithQuery({$lt: 5}, expected.slice(0, 4), 'with query: $lt: 5');
  testWithQuery({$gte: 2}, expected.slice(1), 'with query: $gte: 2');
  testWithQuery({$gt: 2}, expected.slice(2), 'with query: $gt: 2');
  testWithQuery({$gte: 2, $lte: 5}, expected.slice(1, 5),
                'with query: $gte: 2, $lte: 5');
  testWithQuery({$gt: 2, $lte: 5}, expected.slice(2, 5),
                'with query: $gt: 2, $lte: 5');
  testWithQuery({$gte: 2, $lt: 5}, expected.slice(1, 4),
                'with query: $gte: 2, $lt: 5');
  testWithQuery({$gt: 2, $lt: 5}, expected.slice(2, 4),
                'with query: $gt: 2, $lt: 5');
  testWithQuery({$like: 'ab'}, expected.slice(5, 7), 'with query: $like: ab');
  testWithQuery({$like: 'abc'}, expected.slice(6, 7),
                'with query: $like: abc');
  testWithQuery({$like: [1, 2]}, expected.slice(7),
                'with query: $like: [1, 2]');
  testWithQuery({$like: [1, 2, 3]}, expected.slice(8),
                'with query: $like: [1, 2, 3]');
  testWithQuery({$like: [1, 2, 3, 4]}, expected.slice(9),
                'with query: $like: [1, 2, 3, 4]');
  testWithQuery({$eq: [1, 2, 3, 4]}, expected.slice(9),
                'with query: $eq: [1, 2, 3, 4]');
  testWithQuery({$eq: 'ab'}, expected.slice(5, 6), 'with query: $eq: ab');

  function insertKv() {
    var args = arguments;
    var cb = args[args.length - 1];
    var i = 0;
    var next = function(err) {
      if (i === args.length - 1) {
        return cb();
      }
      var key = args[i++];
      var value = args[i++];
      // mix inline values and object refs to test how the cursor
      // will transparently resolve references
      if (typeof value === 'string') {
        // store string values inline
        tree.set(key, value, next);
      } else {
        dbStorage.saveIndexData(value, function(err, ref) {
          tree.set(key, ref, next);
        });
      }
    };
    next();
  }
});

function row(key, value) { 
  return new IndexRow(key, value, null);
}

function rows(array) {
  array.forEach(function(r) { r.ref = null; });
  return array;
}
