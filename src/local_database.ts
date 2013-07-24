/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_revision.ts"/>
/// <reference path="./local_index.ts"/>

class LocalDatabase implements Database {
  dbStorage: DbStorage;
  masterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  sequences: any;

  constructor(dbStorage: DbStorage) {
    var sequencesJob = (cb: AnyCb) => {
      this.dbStorage.get(DbObjectType.Other, 'sequences', cb);
    };
    var sequencesCb = (err: Error, sequences: any) => {
      this.sequences = sequences || [1];
    };
    var masterRefJob = (cb: AnyCb) => {
      this.dbStorage.get(DbObjectType.Other, 'masterRef', cb);
    };
    var masterRefCb = (err: Error, masterRef: string) => {
      this.masterRef = masterRef;
    };

    this.dbStorage = dbStorage;
    this.queue = new JobQueue();
    this.uidGenerator = new UidGenerator();
    this.sequences = null;
    this.masterRef = null;

    this.queue.add(sequencesCb, sequencesJob);
    this.queue.add(masterRefCb, masterRefJob);
  }

  begin(cb: TransactionCb) {
    var job = (cb) => {
      var suffix = this.uidGenerator.generate().hex.slice(0, 7);
      cb(null, new LocalRevision(this, this.dbStorage, this.masterRef,
            suffix));
    };

    if (!this.masterRef) this.queue.add(cb, job);
    else job(cb);
  }

  /*
   *  Merge(commit) algorithm high level description:
   * 
   *  1 - If the revision's original masterRef equals the current masterRef,
   *      then fast-forward(the revision masterRef becomes the current
   *      masterRef) and return.
   *  2 - For each modified index in the revision cache:
   *      2.1 - If the index is new or the original rootRef equals the current
   *            rootRef of the same index, or history tracking is disabled
   *            for the index, then fast-foward it and continue to the next
   *            index.
   *      2.2 - Store the index for later.
   *  3 - If no indexes were stored in the step 2 then the merge is complete
   *      and we can return.
   *  4 - For each history entry created in the revision:
   *      4.1 - If the entry's index is one of the indexes stored in step 2:
   *            4.1.1 - If the entry is a delete or update and the value
   *                    equals the current value associated with the entry's
   *                    key/index, reproduce the change in the current
   *                    version and continue to the next entry.
   *            4.1.2 - The merge failed due to a conflict(the key/index being
   *                    updated was modified since this revision was checked
   *                    out). Return an error containing the current value
   *                    so the conflict can be handled in another layer.
   */
  merge(rev: LocalRevision, doneCb: ObjectCb) {
    var mergeJob = (nextJob: AnyCb) => {
      /*
       * Sets the merge job completion callback and select modified indexes
       */
      doneCb = nextJob;
      if (rev.originalMasterRef === this.masterRef) return commitTrees();
      forwarded = {};
      replay = {};
      modified = [];
      currentMaster = new AvlTree(this.dbStorage, this.masterRef);
      for (var k in rev.treeCache) {
        if (rev.treeCache[k].tree.modified()) {
          modified.push(rev.treeCache[k]);
        }
      }
      nextIndex();
    };
    var nextIndex = () => {
      /*
       * Called for each modified index to retrieve the current index rootRef
       */
      if (!modified.length) {
        return currentMaster.get(new BitArray(['refs', HISTORY]),
            currentHistoryCb);
      }
      currentIndex = modified.shift();
      currentIndexKey = new BitArray(['refs', currentIndex.name]);
      currentMaster.get(currentIndexKey, currentIndexCb);
    };
    var currentIndexCb = (err: Error, ref: string) => {
      /*
       * If the current index wasn't modified since the revision
       * was checked out, mark the index for fast-forward, else
       * mark the index for conflict check/replay
       */
      var orig;
      if (err) return cb(err);
      orig = currentIndex.tree.getOriginalRootRef();
      if (!ref || orig === ref) {
        forwarded[currentIndex.name] = currentIndex;
        return yield(nextIndex);
      }
      replay[currentIndex.id] = { tree: new AvlTree(this.dbStorage, ref),
        name: currentIndex.name, id: currentIndex.id };
      yield(nextIndex);
    };
    var currentHistoryCb = (err: Error, ref: string) => {
      /*
       * Start iterating the revision history to check for possible conflicts
       */
      if (err) return cb(err);
      currentHistory = new AvlTree(this.dbStorage, ref);
      rev.history.inOrder(new BitArray(rev.id), historyWalkCb);
    };
    var historyWalkCb = (err: Error, next: NextNodeCb, node: IndexNode) => {
      /*
       * Called for each history entry created in the new revision,
       * setting relevant context variables for the iteration.
       */
      if (err) return cb(err);
      if (!next) {
        if (commitTrees) commitTrees();
        return;
      }
      nextHistoryEntry = next;
      revHistoryEntryNode = node;
      revHistoryEntry = node.getValue();
      revHistoryEntryKey = new BitArray(revHistoryEntry[2]);
      replayTree = replay[revHistoryEntry[1]].tree;
      historyEntryType = revHistoryEntry[0];
      if (!replayTree) return nextHistoryEntry();
      if (historyEntryType !== HistoryEntryType.Insert) {
        return replayTree.get(revHistoryEntryKey, checkIndexCb);
      }
      replayOperation();
    };
    var checkIndexCb = (err: Error, ref: string) => {
      /*
       * Throws the conflict error if the history entry indicates
       * that the value was modified since the revision checkout.
       */
      if (ref && ref !== revHistoryEntry[3].ref) {
        return cb(new Error('key conflict'));
      }
      replayOperation();
    };
    var replayOperation = () => {
      /*
       * Replays the operation in the current index
       */
      if (historyEntryType === HistoryEntryType.Insert ||
          historyEntryType === HistoryEntryType.Update) {
        replayTree.set(revHistoryEntryKey, replayOperationCb);
      } else {
        replayTree.del(revHistoryEntryKey, replayOperationCb);
      }
    };
    var replayOperationCb = (err: Error) => {
      /*
       * Replays the history entry in the current history
       */
      if (err) return cb(err);
      currentHistory.set(new BitArray(revHistoryEntryNode.getKey()),
          revHistoryEntry, replayHistoryCb);
    };
    var replayHistoryCb = (err: Error, old: any) => {
      if (err) return cb(err);
      if (old) return cb(new Error('history entry exists'));
      nextHistoryEntry();
    };
    var commitTrees = () => {
      rv = {};
      commit = [];
      for (var k in forwarded) commit.push(forwarded[k]);
      for (var k in replay) commit.push(replay[k]);
      commit.push({tree: currentHistory, name: HISTORY, id: null});
    };
    var commitNextTree = (err: Error) => {
      if (err) return cb(err);
      if (!commit.length) {
        return this.dbStorage.set(DbObjectType.Other, 'sequences',
            this.sequences, commitSequencesCb);
      }
      currentCommit = commit.shift();
      currentCommit.tree.commit(true, commitTreeCb);
    };
    var commitTreeCb = (err: Error) => {
      rv[currentCommit.name] = currentCommit;
      currentMaster.set(new BitArray(['refs', currentCommit.name]),
          currentCommit.tree.getRootRef(), commitNextTree);
    };
    var commitSequencesCb = (err: Error) => {
      if (err) return cb(err);
      currentMaster.commit(true, commitMasterCb);
    };
    var commitMasterCb = (err: Error) => {
      if (err) return cb(err);
        return this.dbStorage.set(DbObjectType.Other, 'masterRef',
            currentMaster.getRootRef(), cb);
    };
    var cb = (err: Error) => {
      if (err) {
        commitTrees = null;
        // free the history iteration job if in-progress
        if (nextHistoryEntry) nextHistoryEntry(true);
        return doneCb(err, null);
      }
      doneCb(null, rv);
    }
    var forwarded, replay, commit, currentHistory, currentCommit;
    var modified, currentIndex, currentMaster, revHistoryEntryNode;
    var currentIndexKey, historyEntryType, rv;
    var revHistoryEntryKey, revHistoryEntry, nextHistoryEntry, replayTree;

    this.queue.add(doneCb, mergeJob);
  }

  next(id: number) {
    return this.sequences[id] ?
      ++this.sequences[id] :
      (this.sequences[id] = 1);
  }
}

