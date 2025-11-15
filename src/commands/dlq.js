const queue = require("../core/queue");
const chalk = require("chalk");
const Table = require("cli-table3");

function list() {
  const deadJobs = queue.getJobsByState("dead");

  if (deadJobs.length === 0) {
    console.log(chalk.yellow("\n⚠"), "Dead Letter Queue is empty");
    return;
  }

  console.log(
    chalk.bold.red(`\n💀 Dead Letter Queue: ${deadJobs.length} jobs\n`)
  );

  const table = new Table({
    head: [
      chalk.cyan("ID"),
      chalk.cyan("Command"),
      chalk.cyan("Attempts"),
      chalk.cyan("Last Error"),
      chalk.cyan("Updated At"),
    ],
    colWidths: [12, 25, 10, 30, 20],
  });

  deadJobs.forEach((job) => {
    const updatedAt = new Date(job.updated_at).toLocaleString();
    const shortId = job.id.substring(0, 8) + "...";
    const shortCommand =
      job.command.length > 22
        ? job.command.substring(0, 22) + "..."
        : job.command;
    const shortError = job.error
      ? job.error.length > 27
        ? job.error.substring(0, 27) + "..."
        : job.error
      : "Unknown error";

    table.push([
      shortId,
      shortCommand,
      job.attempts,
      chalk.red(shortError),
      updatedAt,
    ]);
  });

  console.log(table.toString());
  console.log(
    chalk.gray("\nUse"),
    chalk.cyan("queuectl dlq retry <jobId>"),
    chalk.gray("to retry a job")
  );
  console.log(); // Empty line at the end
}

function retry(jobId) {
  try {
    const job = queue.retryDeadJob(jobId);

    console.log(chalk.green("✓"), "Job moved from DLQ back to pending queue");
    console.log(chalk.gray("Job ID:"), chalk.cyan(job.id));
    console.log(chalk.gray("Command:"), job.command);
    console.log(chalk.gray("State:"), chalk.yellow(job.state));
    console.log(chalk.gray("Attempts reset to:"), job.attempts);
  } catch (error) {
    throw new Error(`Failed to retry job: ${error.message}`);
  }
}

module.exports = {
  list,
  retry,
};
