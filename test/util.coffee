{
  JobQueue, Uid, Emitter, LinkedList, UidGenerator, ObjectRef
  normalize: n, denormalize: d
} = require('../src/util')

tests =
  'util':
    'JobQueue':
      '**setup**': -> @queue = new JobQueue()


      'runs async jobs serially': (done) ->
        cb1 = (arg) ->
          expect(arg).to.eql('one'); i++

        job1 = (cb) ->
          expect(i).to.eql(0)
          setImmediate(-> i++; cb('one'))

        job2 = (cb) ->
          expect(i).to.eql(2); setImmediate(cb); i++

        job3 = (cb) ->
          expect(i).to.eql(3); cb()

        i = 0

        @queue.add(cb1, job1)
        @queue.add(null, job2)
        @queue.add(done, job3)


    'Emitter':
      '**setup**': ->
        @cb = =>
          @args = @args.concat(Array.prototype.slice.call(arguments))

        @e = new Emitter()
        @args = []
        @e.on('ev', @cb)


      'subscribe': ->
        @e.on('ev', => @args = @args.concat([4, 5, 6]))
        @e.on('ev', => @args = @args.concat([7, 8, 9]))
        @e.emit('ev', 1, 2, 3)
        expect(@args).to.deep.eql([1, 2, 3, 4, 5, 6, 7, 8, 9])


      'unsubscribe': ->
        @e.once('ev', => @args = @args.concat([4, 5, 6]))
        @e.emit('ev', 1, 2, 3)
        expect(@args).to.deep.eql([1, 2, 3, 4, 5, 6])
        @e.emit('ev', 1, 2, 3)
        expect(@args).to.deep.eql([1, 2, 3, 4, 5, 6, 1, 2, 3])


      'subscribe once multiple times on empty emitter': ->
        @e = new Emitter()
        @e.once('ev', => @args = @args.concat([4, 5, 6]))
        @e.once('ev', => @args = @args.concat([2, 3, 4]))
        @e.emit('ev')
        expect(@args).to.deep.eql([4, 5, 6, 2, 3, 4])
        @e.emit('ev')
        expect(@args).to.deep.eql([4, 5, 6, 2, 3, 4])

        
    'LinkedList':
      '**setup**': ->
        @items = =>
          rv = []
          @l.each((i) -> rv.push(i))
          return rv

        @l = new LinkedList()
        @l.push(1)
        @l.push(2)
        @l.push(3)
        @l.push(4)


      'push': ->
        expect(@items()).to.deep.eql([1, 2, 3, 4])


      'shift': ->
        shifted = [@l.shift(), @l.shift(), @l.shift(), @l.shift()]
        expect(shifted).to.deep.eql([1, 2, 3, 4])
        expect(@items()).to.deep.eql([])
        expect(@l.head).to.be.null
        expect(@l.tail).to.be.null


      'remove': ->
        @l.remove(2)
        expect(@items()).to.deep.eql([1, 3, 4])
        @l.remove(1)
        expect(@items()).to.deep.eql([3, 4])
        @l.remove(4)
        expect(@items()).to.deep.eql([3])
        @l.remove(3)
        expect(@items()).to.deep.eql([])
        expect(@l.head).to.be.null
        expect(@l.tail).to.be.null


    'Normalization/denormalization':
      'normalize shallow object ref': ->
        expect(n(new ObjectRef('ref'))).to.eql('!or"ref"')


      'denormalize shallow object ref': ->
        expect(d('!or"ref"').valueOf()).to.eql(new ObjectRef('ref').valueOf())


      'normalize shallow uid': ->
        expect(n(new Uid('00000000000b0005050505050505'))).to.eql(
          '!id00000000000b0005050505050505')


      'denormalize shallow uid': ->
        expect(d('!id00000000000b0005050505050505')).to.eql(
          new Uid('00000000000b0005050505050505'))


      'normalize shallow date': ->
        expect(n(new Date(343434))).to.eql('!dt53d8a')


      'denormalize shallow date': ->
        expect(d('!dtfff1ff')).to.eql(new Date(0xfff1fF))


      'normalize deep date': ->
        expect(n({a: [{c: new Date(343434)}]})).to.deep.eql(
          {a: [{c: '!dt53d8a'}]})


      'denormalize deep date': ->
        expect(d({a: [{c: '!dt53d8a'}]})).to.deep.eql(
          {a: [{c: new Date(343434)}]})


      'normalize shallow regexp': ->
        expect(n(/abc\d/)).to.eql('!re,abc\\d')


      'denormalize shallow regexp': ->
        re = d('!re,abc\\d')
        expect(re.source).to.eql('abc\\d')
        expect(re.multiline).to.be.false
        expect(re.global).to.be.false
        expect(re.ignoreCase).to.be.false


      'normalize deep regexp': ->
        expect(n([{a:[/abc\d/ig]}])).to.eql([{a:['!regi,abc\\d']}])


      'denormalize deep regexp': ->
        re = d([[2,'!reim,abc\\d'],1])
        expect(re[0][1].source).to.eql('abc\\d')
        expect(re[0][1].multiline).to.be.true
        expect(re[0][1].global).to.be.false
        expect(re[0][1].ignoreCase).to.be.true


      'normalize strings': ->
        expect(n(['abc'])).to.eql(['abc'])
        expect(n(['!abc'])).to.eql(['!!abc'])
        expect(n('!re,abc\\d')).to.eql('!!re,abc\\d')


      'denormalize strings': ->
        expect(d(['abc'])).to.eql(['abc'])
        expect(d(['!!abc'])).to.eql(['!abc'])
        expect(d('!!re,abc\\d')).to.eql('!re,abc\\d')


    'UidGenerator': ->
      'generate':
        '**setup**': ->
          @suffix = '05050505050505'
          @time = 11
          @generator = new UidGenerator(suffix)


        'accepts timestamp argument': ->
          expect(@generator.generate(@time).hex).to.eql(
            '00000000000b0005050505050505')


        'increment counter (byte 7) for ids generated on same ms': ->
          expect(@generator.generate(@time).hex).to.equal(
            '00000000000b0005050505050505')
          expect(@generator.generate(@time).hex).to.equal(
            '00000000000b0105050505050505')
          expect(@generator.generate(@time).hex).to.equal(
            '00000000000b0205050505050505')


        'throws when more than 256 ids are generated on same ms': ->
          for i in [0...256]
            @generator.generate(@time)
          expect(=> @generator.generate(@time)).to.throw(Error)


    'Uid':
      'getTime returns timestamp the instance was generated': ->
        expect(new Uid('00000000000f0609090909090909').getTime()).to.eql(15)


run(tests)
