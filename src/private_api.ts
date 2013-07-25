/// <reference path="./api.ts"/>

var yield: (fn: (...args: any[]) => any) => any;

enum DbObjectType {
  Other = 0,
  IndexNode = 1,
  IndexData = 2
}

interface EmptyCb { (): void; }

interface AnyCb { (...args: any[]); }

interface PredicateCb { (obj: any): boolean; }

interface RefCb { (err: Error, ref: string); }

interface NextNodeCb { (stop?: boolean) }

interface VisitNodeCb {
  (err: Error, next: NextNodeCb, node: IndexNode)
}

interface VisitKvCb {
  (err: Error, next: NextNodeCb, key: any, value: any);
}

interface MergeCb {
  (err: Error, refMap: any, history: IndexTree, master: IndexTree);
}

interface IndexNode {
  getKey(): IndexKey;
  getValue(): any;
}

interface IndexKey {
  compareTo(other: IndexKey): number;
  normalize(): any;
  clone(): IndexKey;
}

interface IndexTree {
  get(key: any, cb: ObjectCb);
  set(key: any, value: any, cb: ObjectCb);
  del(key: any, cb: ObjectCb);
  inOrder(minKey: IndexKey, cb: VisitNodeCb);
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb);
  commit(releaseCache: boolean, cb: DoneCb);
  getRootRef(): string;
  getOriginalRootRef(): string;
  setOriginalRootRef(ref: string);
  modified(): boolean;
}

interface DbStorage {
  get(type: DbObjectType, ref: string, cb: ObjectCb);
  set(type: DbObjectType, ref: string, obj: any, cb: ObjectCb);
  save(type: DbObjectType, obj: any, cb: RefCb);
}