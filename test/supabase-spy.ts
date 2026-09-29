// =====================================================================
// test/supabase-spy.ts
// Supabase Spy & Mock Harness for SSOT Verification (Tahap 7)
// Merekam seluruh operasi Supabase (select, insert, update, upsert, delete, rpc, upload)
// =====================================================================

import { isPullSyncReadOnlyGuardActive } from '../src/utils/supabaseClient';

export type SupabaseOperationType =
  | 'select'
  | 'insert'
  | 'update'
  | 'upsert'
  | 'delete'
  | 'rpc'
  | 'upload';

export interface SupabaseRecordedCall {
  id: string;
  type: SupabaseOperationType;
  tableOrTarget: string;
  args?: any[];
  timestamp: number;
  stack?: string;
}

export class SupabaseSpyHarness {
  private calls: SupabaseRecordedCall[] = [];
  public strictNoMutations: boolean = false;
  private tableDataMap: Map<string, any[]> = new Map();
  private originalMethods: Map<string, any> = new Map();
  private originalFrom?: any;
  private originalRpc?: any;
  private originalStorage?: any;
  private activeTargetClient: any = null;

  constructor() {
    this.reset();
  }

  reset() {
    this.calls = [];
    this.strictNoMutations = false;
    this.tableDataMap.clear();
  }

  setTableData(table: string, data: any[]) {
    this.tableDataMap.set(table, data);
  }

  getTableData(table: string): any[] | undefined {
    return this.tableDataMap.get(table);
  }

  record(type: SupabaseOperationType, tableOrTarget: string, args?: any[]) {
    const call: SupabaseRecordedCall = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      tableOrTarget,
      args,
      timestamp: Date.now(),
    };
    this.calls.push(call);

    if (this.strictNoMutations && this.isMutation(type)) {
      const err = new Error(
        `[SPY VIOLATION] Operasi mutasi terdeteksi saat mode Read-Only! Operasi: ${type.toUpperCase()} pada target '${tableOrTarget}'. Args: ${JSON.stringify(args || [])}`
      );
      throw err;
    }

    return call;
  }

  isMutation(type: SupabaseOperationType): boolean {
    return ['insert', 'update', 'upsert', 'delete', 'rpc', 'upload'].includes(type);
  }

  getAllCalls(): SupabaseRecordedCall[] {
    return [...this.calls];
  }

  getMutations(): SupabaseRecordedCall[] {
    return this.calls.filter((c) => this.isMutation(c.type));
  }

  getCallsByType(type: SupabaseOperationType): SupabaseRecordedCall[] {
    return this.calls.filter((c) => c.type === type);
  }

  getCallsByTarget(target: string): SupabaseRecordedCall[] {
    return this.calls.filter((c) => c.tableOrTarget === target);
  }

  assertNoMutations(label: string = 'Operasi') {
    const mutations = this.getMutations();
    if (mutations.length > 0) {
      const details = mutations
        .map((m) => `  - [${m.type.toUpperCase()}] target: '${m.tableOrTarget}' payload: ${JSON.stringify(m.args || [])}`)
        .join('\n');
      throw new Error(
        `FAIL: ${label} memanggil ${mutations.length} operasi mutasi yang tidak diizinkan:\n${details}`
      );
    }
  }

  attach(client: any) {
    if (!client) return;
    this.detach(); // Detach previous if any
    this.activeTargetClient = client;

    this.originalFrom = client.from;
    this.originalRpc = client.rpc;
    this.originalStorage = client.storage;

    const self = this;

    // Spy on client.from()
    client.from = function (table: string) {
      if (isPullSyncReadOnlyGuardActive()) {
        const guardBuilder: any = {
          select: function (...args: any[]) {
            self.record('select', table, args);
            return guardBuilder;
          },
          insert: function (..._args: any[]) {
            throw new Error(`[SSOT READ-ONLY GUARD] Percobaan INSERT pada tabel '${table}' diblokir selama mode pull/refresh data!`);
          },
          update: function (..._args: any[]) {
            throw new Error(`[SSOT READ-ONLY GUARD] Percobaan UPDATE pada tabel '${table}' diblokir selama mode pull/refresh data!`);
          },
          upsert: function (..._args: any[]) {
            throw new Error(`[SSOT READ-ONLY GUARD] Percobaan UPSERT pada tabel '${table}' diblokir selama mode pull/refresh data!`);
          },
          delete: function (..._args: any[]) {
            throw new Error(`[SSOT READ-ONLY GUARD] Percobaan DELETE pada tabel '${table}' diblokir selama mode pull/refresh data!`);
          },
          order: function () { return guardBuilder; },
          eq: function () { return guardBuilder; },
          in: function () { return guardBuilder; },
          or: function () { return guardBuilder; },
          ilike: function () { return guardBuilder; },
          range: function () { return guardBuilder; },
          limit: function () { return guardBuilder; },
          single: function () { return guardBuilder; },
          maybeSingle: function () { return guardBuilder; },
          then: function (resolve: any, reject: any) {
            const mockedData = self.tableDataMap.has(table) ? self.tableDataMap.get(table) : [];
            return Promise.resolve({ data: mockedData, count: Array.isArray(mockedData) ? mockedData.length : 0, error: null }).then(resolve, reject);
          },
        };
        return guardBuilder;
      }

      let isSingle = false;
      let lastMutated: any = null;

      const builder: any = {
        select: function (...args: any[]) {
          self.record('select', table, args);
          return builder;
        },
        insert: function (...args: any[]) {
          self.record('insert', table, args);
          lastMutated = Array.isArray(args[0]) ? args[0][0] : args[0];
          return builder;
        },
        update: function (...args: any[]) {
          self.record('update', table, args);
          lastMutated = args[0];
          return builder;
        },
        upsert: function (...args: any[]) {
          self.record('upsert', table, args);
          lastMutated = Array.isArray(args[0]) ? args[0][0] : args[0];
          return builder;
        },
        delete: function (...args: any[]) {
          self.record('delete', table, args);
          return builder;
        },
        order: function () {
          return builder;
        },
        eq: function () {
          return builder;
        },
        in: function () {
          return builder;
        },
        or: function () {
          return builder;
        },
        ilike: function () {
          return builder;
        },
        range: function () {
          return builder;
        },
        limit: function () {
          return builder;
        },
        single: function () {
          isSingle = true;
          return builder;
        },
        maybeSingle: function () {
          isSingle = true;
          return builder;
        },
        then: function (resolve: any, reject: any) {
          const mockedData = self.tableDataMap.has(table)
            ? self.tableDataMap.get(table)
            : [];
          let dataToReturn: any = mockedData;
          if (isSingle) {
            if (lastMutated) {
              dataToReturn = lastMutated;
            } else if (Array.isArray(mockedData) && mockedData.length > 0) {
              dataToReturn = mockedData[0];
            } else {
              dataToReturn = null;
            }
          }
          const response = {
            data: dataToReturn,
            count: Array.isArray(mockedData) ? mockedData.length : 0,
            error: null,
          };
          return Promise.resolve(response).then(resolve, reject);
        },
      };

      return builder;
    };

    // Spy on client.rpc()
    client.rpc = function (fn: string, ...args: any[]) {
      if (isPullSyncReadOnlyGuardActive()) {
        throw new Error(`[SSOT READ-ONLY GUARD] Percobaan RPC mutasi '${fn}' diblokir selama mode pull/refresh data!`);
      }
      self.record('rpc', fn, args);
      return Promise.resolve({ data: null, error: null });
    };

    // Spy on client.storage.from().upload()
    if (client.storage) {
      const origStorageFrom = client.storage.from ? client.storage.from.bind(client.storage) : null;
      client.storage.from = function (bucket: string) {
        const bucketApi = origStorageFrom ? origStorageFrom(bucket) : {};
        return {
          ...bucketApi,
          upload: function (...args: any[]) {
            self.record('upload', `bucket:${bucket}`, args);
            return Promise.resolve({ data: { path: 'mock-path' }, error: null });
          },
          getPublicUrl: function (path: string) {
            return { data: { publicUrl: `https://mock.storage.url/${bucket}/${path}` } };
          },
        };
      };
    }
  }

  detach() {
    if (this.activeTargetClient) {
      if (this.originalFrom) this.activeTargetClient.from = this.originalFrom;
      if (this.originalRpc) this.activeTargetClient.rpc = this.originalRpc;
      if (this.originalStorage) this.activeTargetClient.storage = this.originalStorage;
      this.activeTargetClient = null;
    }
  }
}

export const spyHarness = new SupabaseSpyHarness();
