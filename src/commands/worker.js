const Worker = require("../core/worker");
const storage = require("../storage/fileStorage");
const chalk = require("chalk");

// Keep track of workers in memory
const activeWorkers = [];

function start(count) {
  if (count < 1) {
    throw new Error("Worker count must be at least 1");
  }

  // Check if workers are already running. Remove stale worker records whose PID is not active.
  let existingWorkers = storage.loadWorkers();

  // Filter only alive PIDs
  const aliveWorkers = existingWorkers.filter((w) => {
    try {
      // process.kill with signal 0 does not terminate the process; it throws if the PID does not exist
      process.kill(w.pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  });

  if (aliveWorkers.length > 0) {
    console.log(
      chalk.yellow("⚠"),
      `${aliveWorkers.length} worker(s) already running`
    );
    console.log(chalk.gray('Use "queuectl worker stop" to stop them first'));
    return;
  }

  // No alive workers detected -> clear stale records so we can start fresh
  if (existingWorkers.length > 0) {
    storage.clearWorkers();
  }

  console.log(chalk.blue("ℹ"), `Starting ${count} worker(s)...`);

  // Create and start workers
  for (let i = 0; i < count; i++) {
    const worker = new Worker();
    activeWorkers.push(worker);

    // Save worker info
    storage.addWorker({
      id: worker.id,
      started_at: new Date().toISOString(),
      pid: process.pid,
    });

    worker.start();
    console.log(
      chalk.green("✓"),
      `Worker ${i + 1}/${count} started (ID: ${worker.id})`
    );
  }

  console.log(chalk.green("\n✓"), "All workers started successfully!");
  console.log(chalk.gray("\nPress Ctrl+C to stop workers gracefully"));

  // Handle graceful shutdown
  const shutdown = () => {
    console.log(chalk.yellow("\n\n⚠ Shutting down workers gracefully..."));

    activeWorkers.forEach((worker, index) => {
      if (worker.currentJob) {
        console.log(chalk.gray(`Worker ${index + 1} finishing current job...`));
      }
      worker.stop();
      storage.removeWorker(worker.id);
    });

    console.log(chalk.green("✓"), "All workers stopped");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive
  setInterval(() => {
    // Display worker stats periodically
    const stats = activeWorkers.map((w) => w.getStats());
    const totalProcessed = stats.reduce((sum, s) => sum + s.processedJobs, 0);

    if (totalProcessed > 0) {
      process.stdout.write(
        `\r${chalk.gray("Jobs processed:")} ${chalk.cyan(
          totalProcessed
        )} | ${chalk.gray("Active workers:")} ${chalk.cyan(
          activeWorkers.length
        )}`
      );
    }
  }, 5000);
}

function stop() {
  const workers = storage.loadWorkers();

  if (workers.length === 0) {
    console.log(chalk.yellow("⚠"), "No workers are currently running");
    return;
  }

  console.log(chalk.blue("ℹ"), `Stopping ${workers.length} worker(s)...`);

  // Clear all worker records
  storage.clearWorkers();

  console.log(chalk.green("✓"), "Worker stop signal sent");
  console.log(
    chalk.gray("Note: Workers will finish their current jobs before stopping")
  );
}

module.exports = {
  start,
  stop,
};
