// =====================================================================
// test/test-harness.ts
// Test runner and environment setup for Tahap 7
// =====================================================================

// In-memory localStorage implementation
export class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }

  dump(): Record<string, string> {
    const obj: Record<string, string> = {};
    this.store.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }
}

export const mockStorage = new MockLocalStorage();

// Setup global window & localStorage
export function setupTestEnvironment() {
  (global as any).window = {
    location: {
      protocol: 'https:',
      host: 'localhost:3000',
      href: 'http://localhost:3000',
      reload: () => {},
    },
    localStorage: mockStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => {},
  };
  (global as any).localStorage = mockStorage;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface TestSuiteResult {
  name: string;
  tests: TestResult[];
  passed: boolean;
}

export class SimpleTestRunner {
  private suites: { name: string; fn: () => Promise<void> | void }[] = [];
  private currentSuiteTests: TestResult[] = [];
  private allResults: TestSuiteResult[] = [];

  test(name: string, fn: () => Promise<void> | void) {
    this.suites.push({ name, fn });
  }

  async run(): Promise<{ allPassed: boolean; suites: TestSuiteResult[]; total: number; passed: number; failed: number }> {
    setupTestEnvironment();
    this.allResults = [];
    let total = 0;
    let passed = 0;
    let failed = 0;

    console.log('\n=====================================================================');
    console.log('  SPMB SMP AL-HADIID — TAHAP 7 TEST SUITE (SSOT & NO UNINTENDED MUTATIONS)');
    console.log('=====================================================================\n');

    for (const suite of this.suites) {
      total++;
      const start = Date.now();
      try {
        await suite.fn();
        const duration = Date.now() - start;
        passed++;
        console.log(`  \x1b[32m✔ PASS\x1b[0m [${duration}ms] ${suite.name}`);
        this.allResults.push({
          name: suite.name,
          tests: [{ name: suite.name, passed: true, durationMs: duration }],
          passed: true,
        });
      } catch (err: any) {
        const duration = Date.now() - start;
        failed++;
        console.error(`  \x1b[31m✖ FAIL\x1b[0m [${duration}ms] ${suite.name}`);
        console.error(`    \x1b[31mError:\x1b[0m ${err?.message || err}`);
        this.allResults.push({
          name: suite.name,
          tests: [{ name: suite.name, passed: false, error: err?.message || String(err), durationMs: duration }],
          passed: false,
        });
      }
    }

    console.log('\n---------------------------------------------------------------------');
    console.log(`Ringkasan Pengujian: Total: ${total} | Lulus: \x1b[32m${passed}\x1b[0m | Gagal: \x1b[31m${failed}\x1b[0m`);
    console.log('---------------------------------------------------------------------\n');

    return {
      allPassed: failed === 0,
      suites: this.allResults,
      total,
      passed,
      failed,
    };
  }
}
