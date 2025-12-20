import { runQABenchmark } from './qa_routing_bench';

async function main() {
  console.log('🚀 Starting QA Routing Benchmark (100 O-D pairs)...');
  await runQABenchmark();
  console.log('✅ QA Benchmark Complete.');
}

main().catch(err => {
  console.error('❌ QA Benchmark Failed:', err);
  process.exit(1);
});
