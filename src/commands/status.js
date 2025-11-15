const queue = require("../core/queue");
const storage = require("../storage/fileStorage");
const chalk = require("chalk");
const Table = require("cli-table3");

function statusCommand() {
  const stats = queue.getStats();
  const workers = storage.loadWorkers();

  console.log(chalk.bold.blue("\nQueueCTL Status\n"));

  // Job Statistics
  const jobTable = new Table({
    head: [chalk.cyan("Metric"), chalk.cyan("Count")],
    colWidths: [20, 10],
  });

  jobTable.push(
    ["Total Jobs", stats.total],
    ["Pending", chalk.yellow(stats.pending)],
    ["Processing", chalk.blue(stats.processing)],
    ["Completed", chalk.green(stats.completed)],
    ["Failed", chalk.yellow(stats.failed)],
    ["Dead (DLQ)", chalk.red(stats.dead)]
  );

  console.log(jobTable.toString());

  // Worker Statistics
  console.log(chalk.bold.blue("\nActive Workers\n"));

  if (workers.length === 0) {
    console.log(chalk.gray("No workers currently running"));
  } else {
    const workerTable = new Table({
      head: [
        chalk.cyan("Worker ID"),
        chalk.cyan("Started At"),
        chalk.cyan("PID"),
      ],
      colWidths: [40, 25, 10],
    });

    workers.forEach((worker) => {
      const startedAt = new Date(worker.started_at).toLocaleString();
      workerTable.push([
        worker.id.substring(0, 8) + "...",
        startedAt,
        worker.pid,
      ]);
    });

    console.log(workerTable.toString());
  }

  console.log(); // Empty line at the end
}

module.exports = statusCommand;
