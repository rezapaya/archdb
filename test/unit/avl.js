describe('AvlTree', function() {
  var dbStorage, tree;

  beforeEach(function() {
    dbStorage = new MemoryStorage();
    tree = new AvlTree(dbStorage);
  });

  it('manages committed and uncommitted data transparently', function(done) {
    var rootRef;
    insCommit(tree, 1, 1, function() {
      expect(tree.count).to.eql(1);
      expect(inspectStorage(tree.rootRef)).to.deep.eql([1]);
      insCommit(tree, 2, 3, function() {
        expect(tree.count).to.eql(3);
        expect(inspectStorage(tree.rootRef)).to.deep.eql([
          2,
        1,  3
        ]);
        insCommit(tree, 4, 7, function() {
          expect(tree.count).to.eql(7);
          expect(inspectStorage(tree.rootRef)).to.deep.eql([
                4, 
            2,      6,
          1,  3,  5,  7
          ]);
          insCommit(tree, 8, 15, function() {
            expect(tree.count).to.eql(15);
            expect(inspectStorage(tree.rootRef)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,       14,
            1,  3,  5,  7,   9, 11,   13, 15
            ]);
            // save the persisted rootRef
            rootRef = tree.rootRef;
            insTransaction(tree, 16, 31, function() {
              expect(tree.count).to.eql(31);
              tree.levelOrder(function(err, items) {
                // this state is only visible in the current transaction
                expect(items).to.deep.eql([
                16,
                8, 24,
                4, 12, 20, 28,
                2, 6, 10, 14, 18, 22, 26, 30,
                1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31
                ]);
                // not committed, so the persisted tree state wasn't
                // modified
                expect(inspectStorage(rootRef)).to.deep.eql([
                               8, 
                      4,               12,
                  2,      6,      10,       14,
                1,  3,  5,  7,   9, 11,   13, 15
                ]);
                tree.commit(true, function(err) {
                  expect(inspectStorage(tree.rootRef)).to.deep.eql([
                  16,
                  8, 24,
                  4, 12, 20, 28,
                  2, 6, 10, 14, 18, 22, 26, 30,
                  1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31
                  ]);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  function generateAvlRotationSuite(title, ins, del, delSeq, inspect) {
    describe(title, function() {
      describe('height', function() {
        it('is logarithmic', function(done) {
          function cb(err, node) {
            expect(tree.count).to.eql(256);
            expect(node.height).to.eql(8);
            done();
          }
          ins(tree, 1, 256, function() {
            if (tree.root) cb(null, tree.root);
            else tree.resolveNode(tree.rootRef, cb); 
          });
        });
      });

      describe('iterate', function() {
        var size = 80;
        beforeEach(function(done) {
          ins(tree, size, 1, done);
        });

        it('in order', function(done) {
          inOrder(null, tree, function(items) {
            expect(tree.count).to.eql(80);
            expectFromTo(items, 1, size);
            done();
          });
        });

        it('in order with filter', function(done) {
          var i = 1;
          function testFilter() {
            inOrder(new BitArray(i), tree, function(items) {
              expectFromTo(items, i, size);
              i++;
              if (i <= size) setImmediate(testFilter());
              else done();
            });
          }
          testFilter();
        });

        it('reverse in order', function(done) {
          revOrder(null, tree, function(items) {
            expect(tree.count).to.eql(80);
            expectFromTo(items, size, 1);
            done();
          });
        });

        it('reverse in order with filter', function(done) {
          var i = size;
          function testFilter() {
            revOrder(new BitArray(i), tree, function(items) {
              expectFromTo(items, i, 1);
              i--;
              if (i >= 1) setImmediate(testFilter());
              else done();
            });
          }
          testFilter();
        });
      });

      describe('descending insert rotations', function() {
        it('24-22', function(done) {
          ins(tree, 24, 22, function(err) {
            expect(tree.count).to.eql(3);
            expect(inspect(tree)).to.deep.eql([
                                         23, 
                         22,                            24
            ]);
            done();
          });
        });

        it('24-20', function(done) {
          ins(tree, 24, 20, function(err) {
            expect(tree.count).to.eql(5);
            expect(inspect(tree)).to.deep.eql([
                                         23, 
                         21,                            24,
                 20,             22
            ]);
            done();
          });
        });

        it('24-19', function(done) {
          ins(tree, 24, 19, function(err) {
            expect(tree.count).to.eql(6);
            expect(inspect(tree)).to.deep.eql([
                                         21, 
                         20,                            23,
                 19,                            22,             24
            ]);
            done();
          });
        });

        it('24-18', function(done) {
          ins(tree, 24, 18, function(err) {
            expect(tree.count).to.eql(7);
            expect(inspect(tree)).to.deep.eql([
                                         21, 
                         19,                            23,
                 18,             20,            22,             24
            ]);
            done();
          });
        });

        it('24-16', function(done) {
          ins(tree, 24, 16, function(err) {
            expect(tree.count).to.eql(9);
            expect(inspect(tree)).to.deep.eql([
                                         21, 
                         19,                            23,
                 17,             20,            22,             24,
              16,   18
            ]);
            done();
          });
        });

        it('24-15', function(done) {
          ins(tree, 24, 15, function(err) {
            expect(tree.count).to.eql(10);
            expect(inspect(tree)).to.deep.eql([
                                         21, 
                         17,                            23,
                 16,             19,            22,             24,
              15,             18,   20
            ]);
            done();
          });
        });

        it('24-14', function(done) {
          ins(tree, 24, 14, function(err) {
            expect(tree.count).to.eql(11);
            expect(inspect(tree)).to.deep.eql([
                                         21, 
                         17,                             23,
                 15,              19,            22,             24,
              14,   16,        18,   20
            ]);
            done();
          });
        });

        it('24-13', function(done) {
          ins(tree, 24, 13, function(err) {
            expect(tree.count).to.eql(12);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         15,                             21,
                 14,             16,              19,          23,
              13,                              18,   20,    22,   24
            ]);
            done();
          });
        });

        it('24-12', function(done) {
          ins(tree, 24, 12, function(err) {
            expect(tree.count).to.eql(13);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         15,                             21,
                 13,             16,              19,          23,
              12,   14,                        18,   20,    22,   24
            ]);
            done();
          });
        });

        it('24-11', function(done) {
          ins(tree, 24, 11, function(err) {
            expect(tree.count).to.eql(14);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         13,                             21,
                 12,             15,              19,          23,
              11,             14,   16,        18,   20,    22,   24
            ]);
            done();
          });
        });

        it('24-10', function(done) {
          ins(tree, 24, 10, function(err) {
            expect(tree.count).to.eql(15);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         13,                             21,
                 11,             15,              19,          23,
              10,   12,       14,   16,        18,   20,    22,   24
            ]);
            done();
          });
        });

        it('24-8', function(done) {
          ins(tree, 24, 8, function(err) {
            expect(tree.count).to.eql(17);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         13,                             21,
                 11,             15,              19,          23,
               9,   12,       14,   16,        18,   20,    22,   24,
             8, 10
            ]);
            done();
          });
        });

        it('24-7', function(done) {
          ins(tree, 24, 7, function(err) {
            expect(tree.count).to.eql(18);
            expect(inspect(tree)).to.deep.eql([
                                         17, 
                         13,                             21,
                  9,             15,              19,          23,
               8,   11,       14,   16,        18,   20,    22,   24,
             7,   10, 12
            ]);
            done();
          });
        });

        it('24-6', function(done) {
          ins(tree, 24, 6, function(err) {
            expect(tree.count).to.eql(19);
            expect(inspect(tree)).to.deep.eql([
                                          17, 
                          13,                             21,
                  9,              15,              19,          23,
              7,      11,      14,   16,        18,   20,    22,   24,
            6,  8,  10, 12
            ]);
            done();
          });
        });

        it('24-5', function(done) {
          ins(tree, 24, 5, function(err) {
            expect(tree.count).to.eql(20);
            expect(inspect(tree)).to.deep.eql([
                                           17, 
                            9,                             21,
                  7,               13,               19,          23,
              6,      8,       11,     15,        18,   20,    22,   24,
            5,               10, 12, 14, 16
            ]);
            done();
          });
        });

        it('24-4', function(done) {
          ins(tree, 24, 4, function(err) {
            expect(tree.count).to.eql(21);
            expect(inspect(tree)).to.deep.eql([
                                           17, 
                            9,                             21,
                  7,               13,               19,          23,
              5,      8,       11,     15,        18,   20,    22,   24,
            4,  6,           10, 12, 14, 16
            ]);
            done();
          });
        });

        it('24-3', function(done) {
          ins(tree, 24, 3, function(err) {
            expect(tree.count).to.eql(22);
            expect(inspect(tree)).to.deep.eql([
                                           17, 
                            9,                             21,
                  5,               13,               19,          23,
              4,      7,       11,     15,        18,   20,    22,   24,
            3,      6,  8,   10, 12, 14, 16
            ]);
            done();
          });
        });

        it('24-2', function(done) {
          ins(tree, 24, 2, function(err) {
            expect(tree.count).to.eql(23);
            expect(inspect(tree)).to.deep.eql([
                                           17, 
                            9,                             21,
                  5,               13,               19,          23,
              3,      7,       11,     15,        18,   20,    22,   24,
            2,  4,  6,  8,   10, 12, 14, 16
            ]);
            done();
          });
        });

        it('24-1', function(done) {
          ins(tree, 24, 1, function(err) {
            expect(tree.count).to.eql(24);
            expect(inspect(tree)).to.deep.eql([
                                           9, 
                            5,                             17,
                  3,                 7,             13,             21,
              2,      4,         6,      8,     11,     15,     19,     23, 
            1,                                10, 12, 14, 16, 18, 20, 22, 24
            ]);
            done();
          });
        });
      });

      describe('descending delete rotations', function() {
        beforeEach(function(done) {
          ins(tree, 24, 1, done);
        });

        it('24-22', function(done) {
          del(tree, 24, 22, function(err) {
            expect(tree.count).to.eql(21);
            expect(inspect(tree)).to.deep.eql([
                                           9, 
                            5,                             17,
                  3,                 7,             13,             19,
              2,      4,         6,      8,     11,     15,     18,     21, 
            1,                                10, 12, 14, 16,         20
            ]);
            done();
          });
        });

        it('24-19', function(done) {
          del(tree, 24, 19, function(err) {
            expect(tree.count).to.eql(18);
            expect(inspect(tree)).to.deep.eql([
                                           9, 
                            5,                             13,
                  3,                 7,             11,             17,
              2,      4,         6,      8,     10,     12,     15,     18, 
            1,                                                14, 16
            ]);
            done();
          });
        });

        it('24-16', function(done) {
          del(tree, 24, 16, function(err) {
            expect(tree.count).to.eql(15);
            expect(inspect(tree)).to.deep.eql([
                                           9, 
                            5,                             13,
                  3,                 7,             11,             15,
              2,      4,         6,      8,     10,     12,     14,
            1
            ]);
            done();
          });
        });

        it('24-13', function(done) {
          del(tree, 24, 13, function(err) {
            expect(tree.count).to.eql(12);
            expect(inspect(tree)).to.deep.eql([
                                           5, 
                            3,                             9,
                  2,                 4,            7,             11,
              1,                               6,      8,     10,     12
            ]);
            done();
          });
        });

        it('24-10', function(done) {
          del(tree, 24, 10, function(err) {
            expect(tree.count).to.eql(9);
            expect(inspect(tree)).to.deep.eql([
                                           5, 
                            3,                             7,
                  2,                 4,            6,             9,
              1,                                              8
            ]);
            done();
          });
        });

        it('24-7', function(done) {
          del(tree, 24, 7, function(err) {
            expect(tree.count).to.eql(6);
            expect(inspect(tree)).to.deep.eql([
                                           3, 
                            2,                             5,
                  1,                                4,            6
            ]);
            done();
          });
        });

        it('24-4', function(done) {
          del(tree, 24, 4, function(err) {
            expect(tree.count).to.eql(3);
            expect(inspect(tree)).to.deep.eql([
                                           2, 
                            1,                             3
            ]);
            done();
          });
        });

        it('24-2', function(done) {
          del(tree, 24, 2, function(err) {
            expect(tree.count).to.eql(1);
            expect(inspect(tree)).to.deep.eql([1]);
            done();
          });
        });

        it('24-1', function(done) {
          del(tree, 24, 1, function(err) {
            expect(tree.count).to.eql(0);
            expect(inspect(tree)).to.deep.eql([]);
            done();
          });
        });
      });

      describe('acending insert rotations', function() {
        it('1-3', function(done) {
          ins(tree, 1, 3, function(err) {
            expect(tree.count).to.eql(3);
            expect(inspect(tree)).to.deep.eql([
              2, 
            1,  3 
            ]);
            done();
          });
        });

        it('1-5', function(done) {
          ins(tree, 1, 5, function(err) {
            expect(tree.count).to.eql(5);
            expect(inspect(tree)).to.deep.eql([
                2, 
            1,      4,
                  3,  5
            ]);
            done();
          });
        });

        it('1-6', function(done) {
          ins(tree, 1, 6, function(err) {
            expect(tree.count).to.eql(6);
            expect(inspect(tree)).to.deep.eql([
                  4, 
              2,      5,
            1,  3,      6
            ]);
            done();
          });
        });

        it('1-7', function(done) {
          ins(tree, 1, 7, function(err) {
            expect(tree.count).to.eql(7);
            expect(inspect(tree)).to.deep.eql([
                  4, 
              2,      6,
            1,  3,  5,  7
            ]);
            done();
          });
        });

        it('1-9', function(done) {
          ins(tree, 1, 9, function(err) {
            expect(tree.count).to.eql(9);
            expect(inspect(tree)).to.deep.eql([
                    4, 
               2,         6,
            1,    3,   5,    8,
                           7,  9
            ]);
            done();
          });
        });

        it('1-10', function(done) {
          ins(tree, 1, 10, function(err) {
            expect(tree.count).to.eql(10);
            expect(inspect(tree)).to.deep.eql([
                      4, 
               2,             8,
            1,    3,      6,      9,
                        5,  7,      10
            ]);
            done();
          });
        });

        it('1-11', function(done) {
          ins(tree, 1, 11, function(err) {
            expect(tree.count).to.eql(11);
            expect(inspect(tree)).to.deep.eql([
                      4, 
               2,             8,
            1,    3,      6,      10,
                        5,  7,   9, 11
            ]);
            done();
          });
        });

        it('1-12', function(done) {
          ins(tree, 1, 12, function(err) {
            expect(tree.count).to.eql(12);
            expect(inspect(tree)).to.deep.eql([
                          8, 
                  4,             10,
              2,      6,      9,     11,
            1,  3,  5,  7,             12
            ]);
            done();
          });
        });

        it('1-13', function(done) {
          ins(tree, 1, 13, function(err) {
            expect(tree.count).to.eql(13);
            expect(inspect(tree)).to.deep.eql([
                          8, 
                  4,             10,
              2,      6,      9,     12,
            1,  3,  5,  7,         11, 13
            ]);
            done();
          });
        });

        it('1-14', function(done) {
          ins(tree, 1, 14, function(err) {
            expect(tree.count).to.eql(14);
            expect(inspect(tree)).to.deep.eql([
                          8, 
                  4,               12,
              2,      6,      10,       13,
            1,  3,  5,  7,   9, 11,       14
            ]);
            done();
          });
        });

        it('1-15', function(done) {
          ins(tree, 1, 15, function(err) {
            expect(tree.count).to.eql(15);
            expect(inspect(tree)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,       14,
            1,  3,  5,  7,   9, 11,   13, 15
            ]);
            done();
          });
        });

        it('1-16', function(done) {
          ins(tree, 1, 16, function(err) {
            expect(tree.count).to.eql(16);
            expect(inspect(tree)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,       14,
            1,  3,  5,  7,   9, 11,   13, 15,
                                            16 
            ]);
            done();
          });
        });

        it('1-17', function(done) {
          ins(tree, 1, 17, function(err) {
            expect(tree.count).to.eql(17);
            expect(inspect(tree)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,        14,
            1,  3,  5,  7,   9, 11,   13,    16,
                                           15, 17 
            ]);
            done();
          });
        });

        it('1-18', function(done) {
          ins(tree, 1, 18, function(err) {
            expect(tree.count).to.eql(18);
            expect(inspect(tree)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,        16,
            1,  3,  5,  7,   9, 11,   14,    17,
                                    13, 15,    18 
            ]);
            done();
          });
        });

        it('1-19', function(done) {
          ins(tree, 1, 19, function(err) {
            expect(tree.count).to.eql(19);
            expect(inspect(tree)).to.deep.eql([
                           8, 
                  4,               12,
              2,      6,      10,         16,
            1,  3,  5,  7,   9, 11,   14,    18,
                                    13, 15, 17, 19 
            ]);
            done();
          });
        });

        it('1-20', function(done) {
          ins(tree, 1, 20, function(err) {
            expect(tree.count).to.eql(20);
            expect(inspect(tree)).to.deep.eql([
                             8, 
                  4,                      16,
              2,      6,            12,            18,
            1,  3,  5,  7,      10,     14,     17,    19,
                               9, 11, 13, 15,            20 
            ]);
            done();
          });
        });

        it('1-21', function(done) {
          ins(tree, 1, 21, function(err) {
            expect(tree.count).to.eql(21);
            expect(inspect(tree)).to.deep.eql([
                             8, 
                  4,                      16,
              2,      6,            12,            18,
            1,  3,  5,  7,      10,     14,     17,     20,
                               9, 11, 13, 15,         19, 21 
            ]);
            done();
          });
        });

        it('1-22', function(done) {
          ins(tree, 1, 22, function(err) {
            expect(tree.count).to.eql(22);
            expect(inspect(tree)).to.deep.eql([
                             8, 
                  4,                      16,
              2,      6,            12,              20,
            1,  3,  5,  7,      10,     14,      18,     21,
                               9, 11, 13, 15,  17, 19,     22 
            ]);
            done();
          });
        });

        it('1-23', function(done) {
          ins(tree, 1, 23, function(err) {
            expect(tree.count).to.eql(23);
            expect(inspect(tree)).to.deep.eql([
                             8, 
                  4,                      16,
              2,      6,            12,              20,
            1,  3,  5,  7,      10,     14,      18,      22,
                               9, 11, 13, 15,  17, 19,  21, 23
            ]);
            done();
          });
        });

        it('1-24', function(done) {
          ins(tree, 1, 24, function(err) {
            expect(tree.count).to.eql(24);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          8,                             20,
                  4,            12,              18,            22,
              2,      6,    10,     14,      17,     19,    21,     23,
            1,  3,  5,  7, 9, 11, 13, 15,                             24 
            ]);
            done();
          });
        });
      });

      describe('ascending delete rotations', function() {
        beforeEach(function(done) {
          ins(tree, 1, 24, done);
        });

        it('1-3', function(done) {
          del(tree, 1, 3, function(err) {
            expect(tree.count).to.eql(21);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          8,                             20,
                  6,            12,              18,            22,
              4,      7,    10,     14,      17,     19,    21,     23,
                5,         9, 11, 13, 15,                             24 
            ]);
            done();
          });
        });

        it('1-5', function(done) {
          del(tree, 1, 5, function(err) {
            expect(tree.count).to.eql(19);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          8,                             20,
                  6,            12,              18,            22,
                      7,    10,     14,      17,     19,    21,     23,
                           9, 11, 13, 15,                             24 
            ]);
            done();
          });
        });

        it('1-6', function(done) {
          del(tree, 1, 6, function(err) {
            expect(tree.count).to.eql(18);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          12,                             20,
                  8,            14,              18,            22,
              7,     10,    13,     15,      17,     19,    21,     23,
                    9, 11,                                            24 
            ]);
            done();
          });
        });

        it('1-7', function(done) {
          del(tree, 1, 7, function(err) {
            expect(tree.count).to.eql(17);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          12,                             20,
                  10,           14,              18,            22,
               8,    11,    13,     15,      17,     19,    21,     23,
                 9,                                               24 
            ]);
            done();
          });
        });

        it('1-9', function(done) {
          del(tree, 1, 9, function(err) {
            expect(tree.count).to.eql(15);
            expect(inspect(tree)).to.deep.eql([
                                         16, 
                         12,                             20,
                  10,           14,              18,            22,
                     11,    13,     15,      17,     19,    21,     23,
                                                                      24
            ]);
            done();
          });
        });

        it('1-12', function(done) {
          del(tree, 1, 12, function(err) {
            expect(tree.count).to.eql(12);
            expect(inspect(tree)).to.deep.eql([
                                         20, 
                         16,                            22,
                 14,             18,             21,            23,
             13,     15,     17,     19,                           24
            ]);
            done();
          });
        });

        it('1-15', function(done) {
          del(tree, 1, 15, function(err) {
            expect(tree.count).to.eql(9);
            expect(inspect(tree)).to.deep.eql([
                                         20, 
                         18,                            22,
                 16,             19,             21,            23,
                    17,                                            24
            ]);
            done();
          });
        });

        it('1-18', function(done) {
          del(tree, 1, 18, function(err) {
            expect(tree.count).to.eql(6);
            expect(inspect(tree)).to.deep.eql([
                                         22, 
                         20,                            23,
                 19,             21,                             24
            ]);
            done();
          });
        });

        it('1-21', function(done) {
          del(tree, 1, 21, function(err) {
            expect(tree.count).to.eql(3);
            expect(inspect(tree)).to.deep.eql([
                                         23, 
                         22,                            24,
            ]);
            done();
          });
        });

        it('1-23', function(done) {
          del(tree, 1, 23, function(err) {
            expect(tree.count).to.eql(1);
            expect(inspect(tree)).to.deep.eql([24]);
            done();
          });
        });

        it('1-24', function(done) {
          del(tree, 1, 24, function(err) {
            expect(tree.count).to.eql(0);
            expect(inspect(tree)).to.deep.eql([]);
            done();
          });
        });
      });

      describe('delete internal nodes', function() {
        beforeEach(function(done) {
          ins(tree, 1, 24, done);
        });

        it('20', function(done) {
          delSeq(tree, 20, function(err) {
            expect(tree.count).to.eql(23);
            expect(inspect(tree)).to.deep.eql([
                                          16, 
                          8,                             19,
                  4,            12,              18,            22,
              2,      6,    10,     14,      17,            21,     23,
            1,  3,  5,  7, 9, 11, 13, 15,                             24 
            ]);
            done();
          });
        });

        it('16', function(done) {
          delSeq(tree, 20, 16, function(err) {
            expect(tree.count).to.eql(22);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          8,                             19,
                  4,            12,              18,            22,
              2,      6,    10,     14,      17,            21,     23,
            1,  3,  5,  7, 9, 11, 13,                                 24 
            ]);
            done();
          });
        });

        it('12', function(done) {
          delSeq(tree, 20, 16, 12, function(err) {
            expect(tree.count).to.eql(21);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          8,                             19,
                  4,            11,              18,            22,
              2,      6,    10,     14,      17,            21,     23,
            1,  3,  5,  7, 9,     13,                                 24 
            ]);
            done();
          });
        });

        it('11', function(done) {
          delSeq(tree, 20, 16, 12, 11, function(err) {
            expect(tree.count).to.eql(20);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          8,                             19,
                  4,            10,              18,            22,
              2,      6,     9,     14,      17,            21,     23,
            1,  3,  5,  7,        13,                                 24 
            ]);
            done();
          });
        });

        it('10', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, function(err) {
            expect(tree.count).to.eql(19);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          8,                             19,
                  4,            13,              18,            22,
              2,      6,     9,     14,      17,            21,     23,
            1,  3,  5,  7,                                            24 
            ]);
            done();
          });
        });

        it('13', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, function(err) {
            expect(tree.count).to.eql(18);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          8,                             19,
                  4,             9,              18,            22,
              2,      6,            14,      17,            21,     23,
            1,  3,  5,  7,                                            24 
            ]);
            done();
          });
        });

        it('9', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, function(err) {
            expect(tree.count).to.eql(17);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          4,                             19,
                  2,             8,              18,            22,
              1,      3,     6,     14,      17,            21,     23,
                           5,  7,                                      24 
            ]);
            done();
          });
        });

        it('19', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, function(err) {
            expect(tree.count).to.eql(16);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          4,                             22,
                  2,             8,              18,            23,
              1,      3,     6,     14,      17,     21,            24,
                           5,  7
            ]);
            done();
          });
        });

        it('22', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, function(err) {
            expect(tree.count).to.eql(15);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          4,                             21,
                  2,             8,              18,            23,
              1,      3,     6,     14,      17,                    24,
                           5,  7
            ]);
            done();
          });
        });

        it('21', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, function(err) {
            expect(tree.count).to.eql(14);
            expect(inspect(tree)).to.deep.eql([
                                          15, 
                          4,                             18,
                  2,             8,              17,            23,
              1,      3,     6,     14,                             24,
                           5,  7
            ]);
            done();
          });
        });

        it('15', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15,
                 function(err) {
            expect(tree.count).to.eql(13);
            expect(inspect(tree)).to.deep.eql([
                                          14, 
                          4,                             18,
                  2,             6,              17,            23,
              1,      3,     5,     8,                              24,
                                  7
            ]);
            done();
          });
        });

        it('18', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18,
                 function(err) {
            expect(tree.count).to.eql(12);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          4,                            14,
                  2,             5,              8,             23,
              1,      3,                     7,              17,    24
            ]);
            done();
          });
        });

        it('14', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14,
                 function(err) {
            expect(tree.count).to.eql(11);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          4,                             8,
                  2,             5,              7,             23,
              1,      3,                                     17,    24
            ]);
            done();
          });
        });

        it('23', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 function(err) {
            expect(tree.count).to.eql(10);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          4,                             8,
                  2,             5,              7,             17,
              1,      3,                                            24
            ]);
            done();
          });
        });

        it('8', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, function(err) {
            expect(tree.count).to.eql(9);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          4,                             17,
                  2,             5,               7,             24,
              1,      3
            ]);
            done();
          });
        });

        it('17', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, function(err) {
            expect(tree.count).to.eql(8);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          4,                             7,
                  2,             5,                              24,
              1,      3
            ]);
            done();
          });
        });

        it('7', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, 7, function(err) {
            expect(tree.count).to.eql(7);
            expect(inspect(tree)).to.deep.eql([
                                          4, 
                          2,                             6,
                  1,             3,              5,              24
            ]);
            done();
          });
        });

        it('4', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, 7, 4, function(err) {
            expect(tree.count).to.eql(6);
            expect(inspect(tree)).to.deep.eql([
                                          3, 
                          2,                             6,
                  1,                             5,              24
            ]);
            done();
          });
        });

        it('3', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, 7, 4, 3, function(err) {
            expect(tree.count).to.eql(5);
            expect(inspect(tree)).to.deep.eql([
                                          2, 
                          1,                             6,
                                                 5,              24
            ]);
            done();
          });
        });

        it('2', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, 7, 4, 3, 2, function(err) {
            expect(tree.count).to.eql(4);
            expect(inspect(tree)).to.deep.eql([
                                          6, 
                          1,                             24,
                                    5
            ]);
            done();
          });
        });

        it('6', function(done) {
          delSeq(tree, 20, 16, 12, 11, 10, 13, 9, 19, 22, 21, 15, 18, 14, 23,
                 8, 17, 7, 4, 3, 2, 6, function(err) {
            expect(tree.count).to.eql(3);
            expect(inspect(tree)).to.deep.eql([
                                          5, 
                          1,                             24
            ]);
            done();
          });
        });
      });

      describe('random access', function() {
        beforeEach(function(done) { ins(tree, 1, 80, done); });

        it('inserted keys', function() {
          expect(lookup(tree, 1)).to.eql('2');
          expect(lookup(tree, 2)).to.eql('4');
          expect(lookup(tree, 10)).to.eql('20');
          expect(lookup(tree, 45)).to.eql('90');
          expect(lookup(tree, 50)).to.eql('100');
          expect(lookup(tree, 80)).to.eql('160');
        });

        it('updated keys', function(done) {
          tree.set(1, 1, function() {
            tree.set(2, 2, function() {
              tree.set(10, 10, function() {
                tree.set(45, 45, function() {
                  expect(lookup(tree, 1)).to.eql(1);
                  expect(lookup(tree, 2)).to.eql(2);
                  expect(lookup(tree, 10)).to.eql(10);
                  expect(lookup(tree, 45)).to.eql(45);
                  done();
                });
              });
            });
          });
        });

        it('inexistent keys', function() {
          expect(lookup(tree, 0)).to.be.null;
          expect(lookup(tree, 81)).to.be.null;
          expect(lookup(tree, 100)).to.be.null;
        });
      });
    });
  }

  function inspectStorageTree(tree) {
    return inspectStorage(tree.rootRef);
  }

  function inOrder(min, tree, cb) {
    var rv = [];
    tree.inOrder(min, function(err, next, node) {
      if (!next) return cb(rv);
      rv.push(node.key.normalize());
      next();
    });
  };

  function revOrder(max, tree, cb) {
    var rv = [];
    tree.revInOrder(max, function(err, next, node) {
      if (!next) return cb(rv);
      rv.push(node.key.normalize());
      next();
    });
  };

  function expectFromTo(items, from, to) {
    var expected = [];
    for (var i = from;from < to ? i <= to : i >= to;from < to ? i++ : i--) {
      expected.push(i);
    }
    expect(expected).to.deep.eql(items);
  }

  function inspectStorage(rootRef) {
    var rv = [], q, node, data;

    if (!rootRef) return rv;

    q = [];
    q.push(rootRef);
    while (q.length) {
      var val = q.shift().valueOf();
      data = dbStorage.indexNode[val];
      rv.push(data[0]);
      if (data[2]) q.push(denormalize(data[2]));
      if (data[3]) q.push(denormalize(data[3]));
    }
  
    return rv;
  }
  function inspect(tree) {
    // level-order iteration for inspecting/debugging the tree
    var rv = [], q, node;

    if (!tree.root) return rv;

    q = [];
    q.push(tree.root);
    while (q.length) {
      node = q.shift();
      rv.push(node.key.normalize());
      if (node.left) q.push(node.left);
      if (node.right) q.push(node.right);
    }
  
    return rv;
  }
  function insCommit(tree, from, to, cb) {
    var i = from;
    var next = function(err) {
      if (from < to ? i > to : i < to) {
        return tree.commit(true, cb);
      }
      tree.set(i, (((from < to) ? i++ : i--) * 2).toString(), next);
    };
    next();
  }
  function delCommit(tree, from, to, cb) {
    var i = from;
    var next = function(err) {
      if (from < to ? i > to : i < to) {
        return tree.commit(true, cb);
      }
      tree.del(((from < to) ? i++ : i--), next);
    };
    next();
  }
  function delSeqTransaction() {
    var args = arguments;
    var tree = args[0];
    var cb = args[arguments.length - 1];
    var i = 1;
    var next = function(err) {
      if (i === args.length - 1) {
        return cb();
      }
      tree.del(args[i++], next);
    };
    next();
  }
  function delSeqCommit() {
    var args = arguments;
    var tree = args[0];
    var cb = args[arguments.length - 1];
    var i = 1;
    var next = function(err) {
      if (i === args.length - 1) {
        return tree.commit(true, cb);
      }
      tree.del(args[i++], next);
    };
    next();
  }
  function insTransaction(tree, from, to, cb) {
    var i = from;
    var next = function(err) {
      if (from < to ? i > to : i < to) {
        return cb();
      }
      tree.set(i, (((from < to) ? i++ : i--) * 2).toString(), next);
    };
    next();
  }
  function delTransaction(tree, from, to, cb) {
    var i = from;
    var next = function(err) {
      if (from < to ? i > to : i < to) {
        return cb();
      }
      tree.del(((from < to) ? i++ : i--), next);
    };
    next();
  }
  function lookup(tree, key) {
    var rv;
    tree.get(key, function(err, value) { rv = value; });
    return rv;
  }

  generateAvlRotationSuite('uncommitted', insTransaction, delTransaction,
                           delSeqTransaction, inspect);
  generateAvlRotationSuite('committed', insCommit, delCommit,
                           delSeqCommit, inspectStorageTree);
});

describe('AvlNode', function() {
  var node;

  beforeEach(function() {
    node = new AvlNode(5, 'value');
    node.leftRef = 'abc';
    node.rightRef = 'def';
  });

  it('normalizes to a simple array', function() {
    expect(node.normalize()).to.deep.eql([5, 'value', 'abc', 'def', 0]);
  });

  it('has attributes correctly set', function() {
    expect(node.key.normalize()).to.eql(5);
    expect(node.value).to.eql('value');
    expect(node.leftRef).to.eql('abc');
    expect(node.rightRef).to.eql('def');
    expect(node.height).to.eql(0);
  });
});
