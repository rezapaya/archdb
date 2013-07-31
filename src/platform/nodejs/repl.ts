/// <reference path="../../exports.ts"/>
/// <reference path="../../open.ts"/>
/// <reference path="../../open.ts"/>
/// <reference path="../../declarations/node.d.ts"/>

import fs = require('fs');
import path = require('path');
import stream = require('stream');
import vm = require('vm');
import util = require('util');
import repl = require('repl');
import Fiber = require('fibers');

class REPL extends repl.REPLServer {
  superEval: (str: string, context: any, file: string, cb: repl.EvalCb) => any;

  constructor(input: stream.ReadableStream, output: stream.WritableStream) {
    super({
      prompt: 'archdb> ',
      input: input,
      output: output
    });
    this.superEval = this.eval;
    this.eval = this.evalSync;
  }

  evalSync(str: string, context: any, file: string, cb: repl.EvalCb) {
    var fiberFn = () => {
      // var result, err;
      // try {
      //   result = vm.runInContext(str, context, file);
      // } catch (e) {
      //   err = e;
      // }
      // cb(err, result);
      this.superEval(str, context, file, cb);
    };

    Fiber(fiberFn).run();
  }

  createContext() {
    var connectFn = (opts) => {
      return new SyncConnection(openDb(opts));
    };
    var connectFsFn = (path) => {
      return connectFn({type: 'local', storage: 'fs', path: path});
    };
    var connectSampleFn = () => {
      var dir = path.join(process.env.HOME, '.archdb-sample');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      return connectFn({type: 'local', storage: 'fs', path: dir});
    };
    var rv = super.createContext();

    rv.connect = connectFn;
    rv.connectFs = connectFsFn;
    rv.sampleDb = connectSampleFn;

    return rv;
  }

  complete(line: string, cb: (completions: Array) => void) {
    // TODO use improved completion code
    super.complete(line, cb);
  }
}

class SyncConnection {
  constructor(private inner: Connection) { }

  begin(): SyncTransaction {
    var yieldCb = () => {
      this.inner.begin(cb);
    };
    var cb = (e: Error, tx: Transaction) => {
      err = e;
      rv = new SyncTransaction(tx); 
      fiber.run();
    };
    var err, rv;
    var fiber = Fiber.current;

    yield(yieldCb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  close() {
    var cb = (e: Error) => {
      err = e;
      fiber.run();
    };
    var err;
    var fiber = Fiber.current;

    this.inner.close(cb);
    Fiber.yield();
    if (err) throw err;
  }
}

class SyncTransaction {
  constructor(private inner: Transaction) { }

  domain(name: string): SyncDomain {
    return new SyncDomain(this.inner.domain(name)); 
  }

  commit() {
    var cb = (e: Error) => {
      err = e;
      fiber.run();
    };
    var err;
    var fiber = Fiber.current;

    this.inner.commit(cb);
    Fiber.yield();
    if (err) throw err;
  }
}

class SyncDomain {
  constructor(private inner: Domain) { }

  ins(value: any) {
    var cb = (e: Error, key: any) => {
      rv = key;
      err = e;
      fiber.run();
    };
    var err, rv;
    var fiber = Fiber.current;

    this.inner.ins(value, cb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  set(key: any, value: any) {
    var cb = (e: Error, old: any) => {
      rv = old;
      err = e;
      fiber.run();
    };
    var err, rv;
    var fiber = Fiber.current;

    this.inner.set(key, value, cb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  del(key: any) {
    var cb = (e: Error, old: any) => {
      rv = old;
      err = e;
      fiber.run();
    };
    var err, rv;
    var fiber = Fiber.current;

    this.inner.del(key, cb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  find(query: any): SyncCursor {
    return new SyncCursor(this.inner.find(query));
  }
}

class SyncCursor {
  started: boolean;
  currentFiber: any;
  currentRow: Row;
  err: Error;

  constructor(private inner: Cursor) {
    this.started = false;
    this.currentFiber = null;
    this.currentRow = null;
    this.err = null;
  }

  all(): Rowset {
    var cb = (e: Error, rowset: Rowset ) => {
      rv = rowset;
      err = e;
      fiber.run(); 
    };
    var err, rv;
    var fiber = Fiber.current;

    this.inner.all(cb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  one(): Row {
    var cb = (e: Error, row: Row) => {
      rv = row;
      err = e;
      fiber.run(); 
    };
    var err, rv;
    var fiber = Fiber.current;

    this.inner.one(cb);
    Fiber.yield();
    if (err) throw err;
    return rv;
  }

  next(): Row {
    var rowCb = (row: Row) => {
      this.currentRow = row;
      this.currentFiber.run();
    };
    var endCb = (err: Error) => {
      this.err = err; 
      this.currentRow = null;
      this.currentFiber.run();
    }

    this.currentFiber = Fiber.current;

    if (!this.started || this.inner.hasNext()) {
      if (!this.started) {
        this.started = true;
        this.inner.each(rowCb).then(endCb);
      } else {
        this.inner.next();
      }
      Fiber.yield();
    }

    if (this.err) throw this.err;
    return this.currentRow;
  }

  close() { this.inner.close(); }
}

exports.REPL = REPL;
