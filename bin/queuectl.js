#!/usr/bin/env node

const { program } = require("commander");
const enqueueCommand = require("../src/commands/enqueue");
const workerCommand = require("../src/commands/worker");
const statusCommand = require("../src/commands/status");
const listCommand = require("../src/commands/list");
const dlqCommand = require("../src/commands/dlq");
const configCommand = require("../src/commands/config");
const metricsCommand = require('../src/commands/metrics');
const chalk = require("chalk");

program
  .name("queuectl")
  .description("CLI-based background job queue system")
  .version("1.0.0");

// Enqueue command
program
  .command("enqueue [job]")
  .description("Add a new job to the queue")
  .option("-f, --file <path>", "Read job JSON from a file")
  .option("--max-retries <number>", "Override per-job max retries")
  .option(
    "--backoff-base <number>",
    "Override per-job backoff base (exponential)"
  )
    .option("--job-timeout <ms>", "Override per-job job timeout in milliseconds")
  .option("--run-at <iso>", "Schedule job to run at ISO timestamp (e.g. 2025-11-15T15:00:00Z)")
  .option("--delay <seconds>", "Delay job execution by seconds from now")
  .option("--priority <number>", "Job priority (higher runs first)")
  .option("--save-output", "Save job stdout/stderr to a file under data/outputs")
  .option("--output-dir <path>", "Directory to save job outputs (defaults to data/outputs)")
    .option("--rotate-size <bytes>", "Rotate output file when larger than bytes (default 1_000_000)")
    .option("--rotate-count <n>", "Number of rotated files to keep (default 1)")

  .action((job, options) => {
    try {
      // Call enqueueCommand with the raw job and the options object
      if (!job && !options.file) {
        throw new Error(
          "No job provided. Use positional JSON or --file <path>"
        );
      }

      enqueueCommand(job, options);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Worker commands (as subcommands)
const worker = program.command("worker").description("Manage worker processes");

worker
  .command("start")
  .description("Start worker processes")
  .option("-c, --count <number>", "Number of workers to start", "1")
  .action((options) => {
    try {
      workerCommand.start(parseInt(options.count));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

worker
  .command("stop")
  .description("Stop all running workers gracefully")
  .action(() => {
    try {
      workerCommand.stop();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Show summary of all job states and active workers")
  .action(() => {
    try {
      statusCommand();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List jobs by state")
  .option(
    "-s, --state <state>",
    "Filter by state (pending, processing, completed, failed, dead)"
  )
  .action((options) => {
    try {
      listCommand(options.state);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// DLQ commands (as subcommands)
const dlq = program.command("dlq").description("Dead Letter Queue operations");

dlq
  .command("list")
  .description("List all jobs in the Dead Letter Queue")
  .action(() => {
    try {
      dlqCommand.list();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

dlq
  .command("retry <jobId>")
  .description("Retry a job from the Dead Letter Queue")
  .action((jobId) => {
    try {
      dlqCommand.retry(jobId);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Job commands
const job = program.command('job').description('Job operations');

job.command('show <jobId>')
  .description('Show job details and outputs')
  .action((jobId) => {
    try {
      const jobCmd = require('../src/commands/job');
      jobCmd.show(jobId);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// job tail
job.command('tail <jobId>')
  .description('Tail job output file (use --follow to follow)')
  .option('-f, --follow', 'Follow the file (like tail -f)')
  .action((jobId, options) => {
    try {
      const tailCmd = require('../src/commands/job-tail');
      tailCmd.tail(jobId, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Config commands (as subcommands)
const cfg = program.command("config").description("Manage configuration");

cfg
  .command("set <key> <value>")
  .description("Set a configuration value (max-retries, backoff-base)")
  .action((key, value) => {
    try {
      configCommand.set(key, value);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

cfg
  .command("get [key]")
  .description("Get configuration value(s)")
  .action((key) => {
    try {
      configCommand.get(key);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Metrics command (print or serve)
program
  .command('metrics')
  .description('Print basic queue metrics or serve a tiny dashboard')
  .option('-s, --serve [port]', 'Start HTTP server to serve metrics (default 8080)')
  .action((options) => {
    try {
      if (options.serve) {
        const port = parseInt(options.serve === true ? process.env.PORT || 8080 : options.serve);
        metricsCommand.serve(port);
      } else {
        metricsCommand.printMetrics();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });
