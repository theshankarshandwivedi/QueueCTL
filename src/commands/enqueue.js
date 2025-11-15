const fs = require("fs");
const path = require("path");
const queue = require("../core/queue");
const chalk = require("chalk");

function tryNormalizeAndParse(input) {
  // First attempt: direct JSON.parse
  try {
    return JSON.parse(input);
  } catch (e) {
    // Continue to normalization
  }

  let s = (input || "").trim();

  // Quick heuristic: if quotes were stripped by the shell, keys will look like: {id:job1,command:run}
  // Step 1: quote object keys: {id: -> {"id":
  s = s.replace(/([{,]\s*)([A-Za-z0-9_@.-]+)\s*:/g, '$1"$2":');

  // Step 2: quote unquoted string values (but leave numbers, booleans, null alone)
  s = s.replace(/:\s*([^,}\[]+)(?=(,|}))/g, (match, val) => {
    const raw = val.trim();
    if (!raw) return ':""';
    // If already quoted or an object/array, leave
    if (/^["']/.test(raw) || /^[\[{]/.test(raw)) return ":" + raw;
    // booleans/null
    if (/^(true|false|null)$/.test(raw)) return ":" + raw;
    // numeric
    if (!isNaN(Number(raw))) return ":" + raw;
    // otherwise quote and escape existing double quotes
    const escaped = raw.replace(/"/g, '\\"');
    return ':"' + escaped + '"';
  });

  // Try parsing again
  return JSON.parse(s);
}

function enqueueCommand(jobString, options = {}) {
  try {
    // If a file option was passed, read that file
    if (options.file) {
      const p = path.isAbsolute(options.file)
        ? options.file
        : path.join(process.cwd(), options.file);

      if (!fs.existsSync(p)) {
        throw new Error(`File not found: ${options.file}`);
      }

      jobString = fs.readFileSync(p, "utf8");
    }

    // Defensive: ensure we have a string
    jobString = (jobString || "").toString();

    // Support @file syntax (e.g. enqueue @job.json)
    if (jobString.startsWith("@")) {
      const filePath = jobString.slice(1);
      const p = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      if (!fs.existsSync(p)) {
        throw new Error(`File not found: ${filePath}`);
      }
      jobString = fs.readFileSync(p, "utf8");
    }

    let jobData;
    try {
      jobData = tryNormalizeAndParse(jobString);
    } catch (error) {
      // Provide a clearer message and hint about PowerShell quoting
      throw new Error(
        `Failed to parse job data. Ensure you quote JSON correctly for your shell or use --file. Original error: ${error.message}`
      );
    }

    // Override per-job settings from CLI options if provided
    if (options.maxRetries !== undefined) {
      const val = parseInt(options.maxRetries);
      if (isNaN(val) || val < 0) {
        throw new Error("--max-retries must be a non-negative integer");
      }
      jobData.max_retries = val;
    }

    if (options.backoffBase !== undefined) {
      const val = Number(options.backoffBase);
      if (isNaN(val) || val <= 0) {
        throw new Error("--backoff-base must be a positive number");
      }
      jobData.backoff_base = val;
    }

    if (options.jobTimeout !== undefined) {
      const val = parseInt(options.jobTimeout);
      if (isNaN(val) || val <= 0) {
        throw new Error("--job-timeout must be a positive integer representing milliseconds");
      }
      jobData.job_timeout = val;
    }

    // Enqueue the job
    const job = queue.enqueue(jobData);

    // Apply scheduling/priority/output options
    if (options.runAt || options.delay) {
      // compute run_at
      const runAt = options.runAt
        ? new Date(options.runAt).toISOString()
        : new Date(Date.now() + parseInt(options.delay) * 1000).toISOString();
      jobData.run_at = runAt;
      // persist update
      queue.updateJob(job.id, { run_at: runAt });
    }

    if (options.priority !== undefined) {
      const p = parseInt(options.priority);
      if (isNaN(p)) throw new Error("--priority must be an integer");
      queue.updateJob(job.id, { priority: p });
    }

    if (options.saveOutput) {
      const outputDir = options.outputDir || path.join(__dirname, "../../data/outputs");
      const outDirResolved = path.isAbsolute(outputDir) ? outputDir : path.join(process.cwd(), outputDir);
      // ensure directory exists
      try {
        if (!fs.existsSync(outDirResolved)) fs.mkdirSync(outDirResolved, { recursive: true });
      } catch (e) {}

      const outputFile = path.join(outDirResolved, `${job.id}.log`);
      queue.updateJob(job.id, { save_output: true, output_file: outputFile, rotate_size: options.rotateSize ? parseInt(options.rotateSize) : 1000000, rotate_count: options.rotateCount ? parseInt(options.rotateCount) : 1 });
    }

    console.log(chalk.green("✓"), "Job enqueued successfully!");
    console.log(chalk.gray("Job ID:"), chalk.cyan(job.id));
    console.log(chalk.gray("Command:"), job.command);
    console.log(chalk.gray("State:"), job.state);
    console.log(chalk.gray("Max Retries:"), job.max_retries);
  } catch (error) {
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }
}

module.exports = enqueueCommand;
