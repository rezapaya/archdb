describe('LocalIndex', function() {
  var dbStorage, tree, index, queue, generator;

  beforeEach(function(done) {
    queue = new JobQueue();
    dbStorage = new MemoryStorage();
    tree = new AvlTree(dbStorage);
    history = new AvlTree(dbStorage);
    generator = new UidGenerator();
    index = new LocalIndex('test', dbStorage, queue, tree, history, generator);

    index.set(1, {name: 'doc1'});
    index.set(2, {name: 'doc2'});
    index.set('3', {name: 'doc3'});
    index.set([4, 3], {name: 'doc4'});
    index.set(true, {name: 'doc5'}, done);
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

  it('appends an insert history entry on each insert', function(done) {
    historyShouldEql([
      {type: 'ins', key: 1, index: 'test', value: {name: 'doc1'}},
      {type: 'ins', key: 2, index: 'test', value: {name: 'doc2'}},
      {type: 'ins', key: '3', index: 'test', value: {name: 'doc3'}},
      {type: 'ins', key: [4, 3], index: 'test', value: {name: 'doc4'}},
      {type: 'ins', key: true, index: 'test', value: {name: 'doc5'}},
    ], done);
  });

  it('appends delete history entries on each update', function(done) {
    index.del('3', function() {
      historyShouldEql([
        {type: 'ins', key: 1, index: 'test', value: {name: 'doc1'}},
        {type: 'ins', key: 2, index: 'test', value: {name: 'doc2'}},
        {type: 'ins', key: '3', index: 'test', value: {name: 'doc3'}},
        {type: 'ins', key: [4, 3], index: 'test', value: {name: 'doc4'}},
        {type: 'ins', key: true, index: 'test', value: {name: 'doc5'}},
        {type: 'del', key: '3', index: 'test', value: {name: 'doc3'}},
      ], done);
    });
  });

  it('appends insert/delete history entries on each update', function(done) {
    index.set(2, 4);
    index.set([4, 3], 5, function() {
      historyShouldEql([
        {type: 'ins', key: 1, index: 'test', value: {name: 'doc1'}},
        {type: 'ins', key: 2, index: 'test', value: {name: 'doc2'}},
        {type: 'ins', key: '3', index: 'test', value: {name: 'doc3'}},
        {type: 'ins', key: [4, 3], index: 'test', value: {name: 'doc4'}},
        {type: 'ins', key: true, index: 'test', value: {name: 'doc5'}},
        {type: 'del', key: 2, index: 'test', value: {name: 'doc2'}},
        {type: 'ins', key: 2, index: 'test', value: 4},
        {type: 'del', key: [4, 3], index: 'test', value: {name: 'doc4'}},
        {type: 'ins', key: [4, 3], index: 'test', value: 5},
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
      dbStorage.get(node.value.ref, function(err, value) {
        value =
          {type: value[0], key: value[1], index: value[3], value: value[2]};
        items.push(value);
        if (value.value instanceof ObjectRef) {
          dbStorage.get(value.value.ref, function(err, val) {
            value.value = val;
            next();
          });
        } else {
          next();
        }
      })
    });
  }
});

describe('LocalCursor', function() {
  var dbStorage, tree, cursor, queue;
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
      var key = new BitArray(args[i++]);
      var value = args[i++];
      // mix inline values and object refs to test how the cursor
      // will transparently resolve references
      if (typeof value === 'string') {
        // store string values inline
        tree.set(key, value, next);
      } else {
        dbStorage.save(value, function(err, ref) {
          tree.set(key, new ObjectRef(ref), next);
        });
      }
    };
    next();
  }
});

function row(key, value) { 
  return new Row(key, value, null);
}

function rows(array) {
  array.forEach(function(r) { r.ref = null; });
  return array;
}
