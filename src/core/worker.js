const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const queue = require("./queue");
const Job = require("./job");
const config = require("../config/config");
const storage = require("../storage/fileStorage");
const logger = require("../utils/logger");
const fs = require('fs');
const path = require('path');

class Worker {
  constructor(id = null) {
    this.id = id || uuidv4();
    this.isRunning = false;
    this.currentJob = null;
    this.processedJobs = 0;
    this.pollInterval = 2000; // Poll every 2 seconds
    this.pollTimer = null;
  }

  start() {
    if (this.isRunning) {
      logger.warn(`Worker ${this.id} is already running`);
      return;
    }

    this.isRunning = true;
    logger.info(`Worker ${this.id} started`);
    this.poll();
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info(
      `Worker ${this.id} stopped. Processed ${this.processedJobs} jobs.`
    );
  }

  poll() {
    if (!this.isRunning) {
      return;
    }

    // If this worker has been removed from the workers list (stop requested), stop gracefully
    try {
      const workers = storage.loadWorkers();
      const present = workers.find((w) => w.id === this.id);
      if (!present) {
        logger.warn(
          `Worker ${this.id} not found in workers registry. Stopping.`
        );
        this.stop();
        return;
      }
    } catch (e) {
      // If storage read fails, continue (will retry later)
      logger.debug &&
        logger.debug(
          `Worker ${this.id} could not read workers registry: ${e.message}`
        );
    }

    // Process next job
    this.processNextJob()
      .then(() => {
        // Schedule next poll
        if (this.isRunning) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        }
      })
      .catch((error) => {
        logger.error(`Worker ${this.id} error:`, error.message);
        // Continue polling even on error
        if (this.isRunning) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
        }
      });
  }

  async processNextJob() {
    try {
      // Get next available job
      const jobData = queue.getNextJob(this.id);

      if (!jobData) {
        // No jobs available
        return;
      }

      this.currentJob = new Job(jobData);
      logger.info(
        `Worker ${this.id} processing job ${this.currentJob.id}: ${this.currentJob.command}`
      );

      // Execute the job
      const result = await this.executeJob(this.currentJob);

      // Save outputs to job
      this.currentJob.output = {
        stdout: result.stdout || null,
        stderr: result.stderr || null,
      };

      // If configured to save output to file, append and rotate if necessary
      try {
        if (this.currentJob.save_output) {
          let outFile = this.currentJob.output_file;
          if (!outFile) {
            const outputsDir = path.join(__dirname, '../../data/outputs');
            if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
            outFile = path.join(outputsDir, `${this.currentJob.id}.log`);
          }

          const header = `\n=== ${new Date().toISOString()} | ${result.success ? 'SUCCESS' : 'FAIL'} ===\n`;
          let body = '';
          if (result.stdout) body += `STDOUT:\n${result.stdout}\n`;
          if (result.stderr) body += `STDERR:\n${result.stderr}\n`;
          fs.appendFileSync(outFile, header + body);

          // rotation: if rotate_size is set and file > size, rotate by keeping N generations
          const rotateSize = this.currentJob.rotate_size || null;
          const rotateCount = this.currentJob.rotate_count || 1;
          if (rotateSize) {
            const stats = fs.statSync(outFile);
            if (stats.size > rotateSize) {
              try {
                // Remove oldest rotated file if it exists
                const oldest = `${outFile}.${rotateCount}`;
                if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

                // Shift existing rotated files up: .(n-1) -> .n
                for (let i = rotateCount - 1; i >= 1; i--) {
                  const src = `${outFile}.${i}`;
                  const dst = `${outFile}.${i + 1}`;
                  if (fs.existsSync(src)) {
                    fs.renameSync(src, dst);
                  }
                }

                // Rename current log to .1
                const first = `${outFile}.1`;
                fs.renameSync(outFile, first);
                // create new empty log with rotation header
                fs.writeFileSync(outFile, `Rotated at ${new Date().toISOString()}\n`);
              } catch (e) {
                logger.warn(`Failed to rotate log for job ${this.currentJob.id}: ${e.message}`);
              }
            }
          }
        }
      } catch (e) {
        logger.warn(`Error saving output for job ${this.currentJob.id}: ${e.message}`);
      }

      if (result.success) {
        // Mark job as completed (store output)
        this.currentJob.markCompleted(this.currentJob.output);
        queue.updateJob(this.currentJob.id, this.currentJob.toJSON());
        logger.success(`Worker ${this.id} completed job ${this.currentJob.id}`);
      } else {
        // Mark job as failed
        this.currentJob.markFailed(result.error);
        queue.updateJob(this.currentJob.id, this.currentJob.toJSON());

        if (this.currentJob.state === "dead") {
          logger.error(
            `Worker ${this.id} - Job ${this.currentJob.id} moved to DLQ after ${this.currentJob.attempts} attempts`
          );
        } else {
          logger.warn(
            `Worker ${this.id} - Job ${this.currentJob.id} failed (attempt ${this.currentJob.attempts}/${this.currentJob.max_retries}). Will retry at ${this.currentJob.next_retry_at}`
          );
        }
      }

      // Release lock
      queue.releaseLock(this.currentJob.id);
      this.processedJobs++;
      this.currentJob = null;
    } catch (error) {
      logger.error(`Worker ${this.id} error processing job:`, error.message);

      if (this.currentJob) {
        queue.releaseLock(this.currentJob.id);
        this.currentJob = null;
      }
    }
  }

  executeJob(job) {
    return new Promise((resolve) => {
      // Determine timeout (ms): per-job or global
      const timeout = job.job_timeout !== undefined ? job.job_timeout : config.getJobTimeout();

      // Detect platform and use appropriate shell
      const isWindows = process.platform === "win32";
      const shell = isWindows ? "cmd.exe" : "/bin/sh";

      const child = exec(
        job.command,
        {
          timeout,
          shell: isWindows ? true : shell,
          windowsHide: true, // Hide console window on Windows
        },
        (error, stdout, stderr) => {
          const out = stdout ? stdout.toString().trim() : null;
          const errOut = stderr ? stderr.toString().trim() : null;

          if (error) {
            // Timeout detection: exec kills child and sets error.killed or signal
            const isTimeout = error.killed || (error.signal && error.signal !== null);

            if (isTimeout) {
              resolve({ success: false, stdout: out, stderr: errOut, error: "Job timed out" });
              return;
            }

            // Command not found
            if (error.code === "ENOENT") {
              resolve({ success: false, stdout: out, stderr: errOut, error: "Command not found" });
            } else {
              resolve({ success: false, stdout: out, stderr: errOut, error: errOut || error.message });
            }
          } else {
            resolve({ success: true, stdout: out, stderr: errOut, error: null });
          }
        }
      );
    });
  }

  getCurrentJob() {
    return this.currentJob;
  }

  getStats() {
    return {
      id: this.id,
      isRunning: this.isRunning,
      processedJobs: this.processedJobs,
      currentJob: this.currentJob ? this.currentJob.id : null,
    };
  }
}

module.exports = Worker;
