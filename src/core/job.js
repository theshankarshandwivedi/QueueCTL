const { v4: uuidv4 } = require("uuid");
const config = require("../config/config");

class Job {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.command = data.command;
    this.state = data.state || "pending";
    this.attempts = data.attempts || 0;
    this.max_retries =
      data.max_retries !== undefined
        ? data.max_retries
        : config.getMaxRetries();
    this.backoff_base =
      data.backoff_base !== undefined
        ? data.backoff_base
        : config.getBackoffBase();
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
    this.next_retry_at = data.next_retry_at || null;
    this.error = data.error || null;
    this.output = data.output || { stdout: null, stderr: null };
    this.job_timeout =
      data.job_timeout !== undefined
        ? data.job_timeout
        : config.getJobTimeout();
    this.run_at = data.run_at || null;
    this.priority = data.priority !== undefined ? data.priority : 0;
    this.save_output = data.save_output || false;
    this.output_file = data.output_file || null;
    this.rotate_size = data.rotate_size || null;
    this.rotate_count = data.rotate_count !== undefined ? data.rotate_count : 1;
  }

  static validate(jobData) {
    if (!jobData.command) {
      throw new Error("Job must have a command");
    }

    if (typeof jobData.command !== "string") {
      throw new Error("Command must be a string");
    }

    return true;
  }

  static fromJSON(json) {
    try {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      Job.validate(data);
      return new Job(data);
    } catch (error) {
      throw new Error(`Invalid job data: ${error.message}`);
    }
  }

  toJSON() {
    return {
      id: this.id,
      command: this.command,
      state: this.state,
      attempts: this.attempts,
      max_retries: this.max_retries,
      backoff_base: this.backoff_base,
      job_timeout: this.job_timeout,
      created_at: this.created_at,
      updated_at: this.updated_at,
      next_retry_at: this.next_retry_at,
      error: this.error,
      output: this.output,
    };
  }

  canRetry() {
    // Allow retries up to and including max_retries attempts
    return this.attempts <= this.max_retries;
  }

  calculateBackoff() {
    const backoffBase =
      this.backoff_base !== undefined
        ? this.backoff_base
        : config.getBackoffBase();
    return Math.pow(backoffBase, this.attempts) * 1000; // Convert to milliseconds
  }

  scheduleRetry() {
    if (!this.canRetry()) {
      return null;
    }

    const delay = this.calculateBackoff();
    const nextRetry = new Date(Date.now() + delay);
    return nextRetry.toISOString();
  }

  markFailed(error) {
    this.attempts += 1;
    this.error = error;
    this.updated_at = new Date().toISOString();

    if (this.canRetry()) {
      this.state = "failed";
      this.next_retry_at = this.scheduleRetry();
    } else {
      this.state = "dead";
      this.next_retry_at = null;
    }
  }

  markCompleted(output) {
    this.state = "completed";
    this.output = output;
    this.error = null;
    this.updated_at = new Date().toISOString();
  }

  reset() {
    this.attempts = 0;
    this.state = "pending";
    this.error = null;
    this.next_retry_at = null;
    this.updated_at = new Date().toISOString();
  }
}

module.exports = Job;
