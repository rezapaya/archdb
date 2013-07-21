/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

class LocalIndex {
  constructor(private dbStorage: DbStorage, private queue: JobQueue,
      private tree: DbIndexTree, private history: DbIndexTree) { }

  set(key: any, value: any, cb: ObjectCb) {
    var job = (cb: ObjectCb) => { this.setJob(key, value, cb); }

    this.queue.add(cb, job);
  }

  del(key: any, cb: ObjectCb) {
    var job = (cb: ObjectCb) => { this.delJob(key, cb); }

    this.queue.add(cb, job);
  }

  setJob(key: any, value: any, cb: ObjectCb) { }

  delJob(key: any, cb: ObjectCb) { }

  find(query: any) {
    return new LocalCursor(this.dbStorage, this.queue, this.tree, query);
  }
}

class LocalCursor extends EventEmitter {
  dbStorage: DbStorage;
  queue: JobQueue;
  tree: DbIndexTree;
  query: any;
  closed: boolean;
  paused: boolean;
  err: Error;
  nextJobCb: AnyCb;

  constructor(dbStorage: DbStorage, queue: JobQueue, tree: DbIndexTree,
      query: any) {
    super();
    this.dbStorage = dbStorage; 
    this.queue = queue;
    this.tree = tree;
    this.query = query;
    this.closed = false;
    this.paused = false;
    this.err = null;
    this.nextJobCb = null;
  }

  each(cb: KVCb) {
    var job = (cb) => {
      this.nextJobCb = cb;
      this.find(visitCb);
    };
    var visitCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      if (err) {
        this.err = err;
        this.close();
      }
    };
  
  }

  close() {
    this.closed = true;
    this.emit('close', this.err);
  }

  private find(cb: VisitNodeCb) {
    if (this.query) {
      if (this.query.$eq) return this.findEq(cb);
      if (this.query.$like) return this.findLike(cb);
    }
    this.findRange(cb);
  }

  private findEq(cb: VisitNodeCb) { }

  private findLike(cb: VisitNodeCb) { }

  private findRange(cb: VisitNodeCb) { }
}
