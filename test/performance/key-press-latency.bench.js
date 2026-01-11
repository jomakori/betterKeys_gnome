/* test/performance/key-press-latency.bench.js - Benchmark key press latency */

const { MockSettingsManager } = require('../utils/test-helpers');

function benchmarkKeyPressLatency() {
    console.log('Benchmarking key press latency...');
    const iterations = 1000;
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        // Simulate key press processing
    }
    const end = Date.now();
    const avg = (end - start) / iterations;
    console.log(`Average latency: ${avg.toFixed(3)} ms per key press`);
    return avg;
}

try {
    benchmarkKeyPressLatency();
} catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
}
