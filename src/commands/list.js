const queue = require("../core/queue");
const chalk = require("chalk");
const Table = require("cli-table3");

function listCommand(state) {
  const validStates = ["pending", "processing", "completed", "failed", "dead"];

  if (state && !validStates.includes(state)) {
    throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
  }

  const jobs = state ? queue.getJobsByState(state) : queue.getAllJobs();

  if (jobs.length === 0) {
    console.log(
      chalk.yellow("\n⚠"),
      state ? `No jobs in "${state}" state` : "No jobs found"
    );
    return;
  }

  console.log(
    chalk.bold.blue(`\n📋 Jobs${state ? ` (${state})` : ""}: ${jobs.length}\n`)
  );

  const table = new Table({
    head: [
      chalk.cyan("ID"),
      chalk.cyan("Command"),
      chalk.cyan("State"),
      chalk.cyan("Attempts"),
      chalk.cyan("Created At"),
    ],
    colWidths: [12, 30, 12, 10, 20],
  });

  jobs.forEach((job) => {
    const stateColor =
      {
        pending: chalk.yellow,
        processing: chalk.blue,
        completed: chalk.green,
        failed: chalk.yellow,
        dead: chalk.red,
      }[job.state] || chalk.white;

    const createdAt = new Date(job.created_at).toLocaleString();
    const shortId = job.id.substring(0, 8) + "...";
    const shortCommand =
      job.command.length > 27
        ? job.command.substring(0, 27) + "..."
        : job.command;

    table.push([
      shortId,
      shortCommand,
      stateColor(job.state),
      `${job.attempts}/${job.max_retries}`,
      createdAt,
    ]);
  });

  console.log(table.toString());

  // Show summary
  if (!state) {
    const stats = queue.getStats();
    console.log(
      chalk.gray("\nSummary:"),
      chalk.yellow(`${stats.pending} pending`),
      chalk.blue(`${stats.processing} processing`),
      chalk.green(`${stats.completed} completed`),
      chalk.red(`${stats.dead} dead`)
    );
  }

  console.log(); // Empty line at the end
}

module.exports = listCommand;
