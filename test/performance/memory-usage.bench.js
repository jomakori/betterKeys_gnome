/* test/performance/memory-usage.bench.js - Benchmark memory usage */

const { MockSettingsManager } = require('../utils/test-helpers');

function benchmarkMemoryUsage() {
    console.log('Benchmarking memory usage...');
    const initialMemory = process.memoryUsage().heapUsed;
    const objects = [];
    for (let i = 0; i < 10000; i++) {
        objects.push({ id: i, data: 'x'.repeat(100) });
    }
    const afterAllocation = process.memoryUsage().heapUsed;
    const allocated = afterAllocation - initialMemory;
    console.log(`Memory allocated for 10k objects: ${(allocated / 1024).toFixed(2)} KB`);
    // Simulate garbage collection
    objects.length = 0;
    const afterGC = process.memoryUsage().heapUsed;
    const retained = afterGC - initialMemory;
    console.log(`Memory retained after GC: ${(retained / 1024).toFixed(2)} KB`);
    return allocated;
}

try {
    benchmarkMemoryUsage();
} catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
}
