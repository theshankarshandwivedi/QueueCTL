const queue = require("../core/queue");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

function tailFile(filePath, maxChars = 2000) {
  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    const start = Math.max(0, size - maxChars);
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(Math.min(maxChars, size));
    fs.readSync(fd, buffer, 0, buffer.length, start);
    fs.closeSync(fd);
    return buffer.toString();
  } catch (e) {
    return null;
  }
}

function show(jobId) {
  const job = queue.getJob(jobId);
  if (!job) {
    console.error(chalk.red("Job not found:"), jobId);
    process.exit(1);
  }

  console.log(chalk.bold.blue("\nJob Details\n"));
  console.log(chalk.gray("ID:"), chalk.cyan(job.id));
  console.log(chalk.gray("Command:"), job.command);
  console.log(chalk.gray("State:"), job.state);
  console.log(chalk.gray("Attempts:"), `${job.attempts}/${job.max_retries}`);
  if (job.run_at) console.log(chalk.gray("Run At:"), job.run_at);
  if (job.priority) console.log(chalk.gray("Priority:"), job.priority);

  console.log(chalk.gray("Created At:"), job.created_at);
  console.log(chalk.gray("Updated At:"), job.updated_at);

  console.log(chalk.bold.blue("\nOutput\n"));
  if (job.output_file) {
    console.log(chalk.gray("Output file:"), job.output_file);
    const tail = tailFile(job.output_file, 4000);
    if (tail) {
      console.log("--- FILE TAIL ---");
      console.log(tail);
      console.log("--- END ---");
      return;
    }
  }

  const out = job.output || {};
  console.log(chalk.gray("Stdout:"));
  console.log(out.stdout || chalk.dim("[no stdout]"));
  console.log(chalk.gray("\nStderr:"));
  console.log(out.stderr || chalk.dim("[no stderr]"));
}

module.exports = {
  show,
};
