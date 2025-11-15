/**
 * Integration Tests for QueueCTL
 * Run with: node tests/integration.test.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execPromise = util.promisify(exec);

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${error.message}`);
      testsFailed++;
    }
  };
}

// Clean up test data
function cleanup() {
  const dataDir = path.join(__dirname, "../data");
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    files.forEach((file) => {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(dataDir, file));
      }
    });
  }
}

// Test Suite
async function runTests() {
  console.log("\n🧪 QueueCTL Integration Tests\n");

  // Clean up before tests
  cleanup();

  // Test 1: Job Model
  await test("Job model creates valid job", async () => {
    const Job = require("../src/core/job");
    const job = new Job({ command: "echo test" });
    assert.ok(job.id, "Job should have an ID");
    assert.strictEqual(job.state, "pending", "Initial state should be pending");
    assert.strictEqual(job.attempts, 0, "Initial attempts should be 0");
  })();

  // Test 2: Job validation
  await test("Job validation rejects invalid jobs", async () => {
    const Job = require("../src/core/job");
    try {
      Job.fromJSON("{}");
      throw new Error("Should have thrown validation error");
    } catch (error) {
      assert.ok(error.message.includes("command"), "Should require command");
    }
  })();

  // Test 3: Queue operations
  await test("Queue enqueues and retrieves jobs", async () => {
    const queue = require("../src/core/queue");
    const job = queue.enqueue({ command: "echo test", id: "queue-test-1" });
    assert.strictEqual(job.id, "queue-test-1");

    const retrieved = queue.getJob("queue-test-1");
    assert.ok(retrieved, "Should retrieve enqueued job");
    assert.strictEqual(retrieved.command, "echo test");
  })();

  // Test 4: Job states
  await test("Job transitions through states correctly", async () => {
    const Job = require("../src/core/job");
    const job = new Job({ command: "test", max_retries: 2 });

    assert.strictEqual(job.state, "pending");

    job.markFailed("Error 1");
    assert.strictEqual(job.state, "failed");
    assert.strictEqual(job.attempts, 1);
    assert.ok(job.next_retry_at, "Should schedule retry");

    job.markFailed("Error 2");
    assert.strictEqual(job.state, "failed");
    assert.strictEqual(job.attempts, 2);

    job.markFailed("Error 3");
    assert.strictEqual(job.state, "dead");
    assert.strictEqual(job.attempts, 3);
    assert.strictEqual(job.next_retry_at, null);
  })();

  // Test 5: Exponential backoff calculation
  await test("Exponential backoff calculates correctly", async () => {
    const Job = require("../src/core/job");
    const config = require("../src/config/config");
    config.set("backoff-base", 2);

    const job = new Job({ command: "test" });

    job.attempts = 0;
    assert.strictEqual(job.calculateBackoff(), 1000); // 2^0 = 1 second

    job.attempts = 1;
    assert.strictEqual(job.calculateBackoff(), 2000); // 2^1 = 2 seconds

    job.attempts = 2;
    assert.strictEqual(job.calculateBackoff(), 4000); // 2^2 = 4 seconds

    job.attempts = 3;
    assert.strictEqual(job.calculateBackoff(), 8000); // 2^3 = 8 seconds
  })();

  // Test 6: Storage persistence
  await test("Storage persists data correctly", async () => {
    const storage = require("../src/storage/fileStorage");
    const testJob = {
      id: "persist-test",
      command: "echo persist",
      state: "pending",
      attempts: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storage.addJob(testJob);
    const jobs = storage.loadJobs();

    assert.ok(
      jobs.find((j) => j.id === "persist-test"),
      "Job should be persisted"
    );
  })();

  // Test 7: Lock mechanism
  await test("Lock mechanism prevents duplicate processing", async () => {
    const storage = require("../src/storage/fileStorage");
    const queue = require("../src/core/queue");

    queue.enqueue({ command: "echo lock-test", id: "lock-test" });

    const locked1 = storage.acquireLock("lock-test", "worker-1");
    assert.ok(locked1, "First worker should acquire lock");

    const locked2 = storage.acquireLock("lock-test", "worker-2");
    assert.ok(!locked2, "Second worker should not acquire lock");

    storage.releaseLock("lock-test");
    const locked3 = storage.acquireLock("lock-test", "worker-2");
    assert.ok(locked3, "Lock should be released and acquirable");
  })();

  // Test 8: Queue statistics
  await test("Queue calculates statistics correctly", async () => {
    cleanup();
    const queue = require("../src/core/queue");

    queue.enqueue({ command: "echo 1", id: "stat-1" });
    queue.enqueue({ command: "echo 2", id: "stat-2" });
    queue.updateJob("stat-1", { state: "completed" });

    const stats = queue.getStats();
    assert.strictEqual(stats.total, 2);
    assert.strictEqual(stats.completed, 1);
    assert.strictEqual(stats.pending, 1);
  })();

  // Test 9: DLQ retry functionality
  await test("DLQ retry resets job correctly", async () => {
    const queue = require("../src/core/queue");

    queue.enqueue({ command: "echo dlq", id: "dlq-test" });
    queue.updateJob("dlq-test", {
      state: "dead",
      attempts: 3,
      error: "Max retries exceeded",
    });

    const retriedJob = queue.retryDeadJob("dlq-test");
    assert.strictEqual(retriedJob.state, "pending");
    assert.strictEqual(retriedJob.attempts, 0);
    assert.strictEqual(retriedJob.error, null);
  })();

  // Test 10: Configuration management
  await test("Configuration persists and loads correctly", async () => {
    const config = require("../src/config/config");

    config.set("max-retries", 5);
    config.set("backoff-base", 3);

    assert.strictEqual(config.getMaxRetries(), 5);
    assert.strictEqual(config.getBackoffBase(), 3);
  })();

  // Print results
  console.log("\n" + "=".repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed === 0) {
    console.log("✓ All tests passed!\n");
    process.exit(0);
  } else {
    console.log("✗ Some tests failed\n");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Test suite error:", error);
  process.exit(1);
});
