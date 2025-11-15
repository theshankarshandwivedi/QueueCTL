const fs = require("fs");
const path = require("path");

const JOBS_FILE = path.join(__dirname, "../../data/jobs.json");
const WORKERS_FILE = path.join(__dirname, "../../data/workers.json");
const DATA_DIR = path.join(__dirname, "../../data");

class FileStorage {
  constructor() {
    this.ensureDataDirectory();
    // Clean up any stale locks left by previous runs
    try {
      this.cleanupLocks();
    } catch (e) {
      // ignore cleanup errors
      console.warn("Warning: failed to cleanup stale locks:", e.message);
    }
  }

  ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Initialize files if they don't exist
    if (!fs.existsSync(JOBS_FILE)) {
      this.saveJobs([]);
    }
    if (!fs.existsSync(WORKERS_FILE)) {
      this.saveWorkers([]);
    }
  }

  // Job operations
  loadJobs() {
    try {
      const data = fs.readFileSync(JOBS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.warn("Error loading jobs, returning empty array:", error.message);
      return [];
    }
  }

  saveJobs(jobs) {
    try {
      fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
    } catch (error) {
      throw new Error(`Failed to save jobs: ${error.message}`);
    }
  }

  addJob(job) {
    const jobs = this.loadJobs();
    jobs.push(job);
    this.saveJobs(jobs);
  }

  updateJob(jobId, updates) {
    const jobs = this.loadJobs();
    const index = jobs.findIndex((j) => j.id === jobId);

    if (index === -1) {
      throw new Error(`Job ${jobId} not found`);
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveJobs(jobs);
    return jobs[index];
  }

  getJob(jobId) {
    const jobs = this.loadJobs();
    return jobs.find((j) => j.id === jobId);
  }

  getJobsByState(state) {
    const jobs = this.loadJobs();
    if (state) {
      return jobs.filter((j) => j.state === state);
    }
    return jobs;
  }

  deleteJob(jobId) {
    const jobs = this.loadJobs();
    const filtered = jobs.filter((j) => j.id !== jobId);
    this.saveJobs(filtered);
  }

  // Worker operations
  loadWorkers() {
    try {
      const data = fs.readFileSync(WORKERS_FILE, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.warn(
        "Error loading workers, returning empty array:",
        error.message
      );
      return [];
    }
  }

  saveWorkers(workers) {
    try {
      fs.writeFileSync(WORKERS_FILE, JSON.stringify(workers, null, 2));
    } catch (error) {
      throw new Error(`Failed to save workers: ${error.message}`);
    }
  }

  addWorker(worker) {
    const workers = this.loadWorkers();
    workers.push(worker);
    this.saveWorkers(workers);
  }

  removeWorker(workerId) {
    const workers = this.loadWorkers();
    const filtered = workers.filter((w) => w.id !== workerId);
    this.saveWorkers(filtered);
  }

  clearWorkers() {
    this.saveWorkers([]);
  }

  // Atomic lock operations
  acquireLock(jobId, workerId) {
    const jobs = this.loadJobs();
    const index = jobs.findIndex((j) => j.id === jobId);

    if (index === -1) {
      return false;
    }

    const job = jobs[index];

    // Check if job is already locked or not in pending/failed state
    if (job.locked_by || (job.state !== "pending" && job.state !== "failed")) {
      return false;
    }

    jobs[index] = {
      ...job,
      locked_by: workerId,
      locked_at: new Date().toISOString(),
      state: "processing",
      updated_at: new Date().toISOString(),
    };

    this.saveJobs(jobs);
    return true;
  }

  releaseLock(jobId) {
    const jobs = this.loadJobs();
    const index = jobs.findIndex((j) => j.id === jobId);

    if (index === -1) {
      return false;
    }

    delete jobs[index].locked_by;
    delete jobs[index].locked_at;
    // If job was processing, revert to pending so it can be picked up again
    if (jobs[index].state === "processing") {
      jobs[index].state = "pending";
    }
    jobs[index].updated_at = new Date().toISOString();

    this.saveJobs(jobs);
    return true;
  }

  // Remove locks held by workers that are no longer running
  cleanupLocks() {
    const jobs = this.loadJobs();
    const workers = this.loadWorkers();

    const aliveWorkerIds = workers
      .filter((w) => {
        try {
          process.kill(w.pid, 0);
          return true;
        } catch (e) {
          return false;
        }
      })
      .map((w) => w.id);

    let changed = false;

    const newJobs = jobs.map((job) => {
      if (job.locked_by && !aliveWorkerIds.includes(job.locked_by)) {
        // clear stale lock and revert processing state to pending
        delete job.locked_by;
        delete job.locked_at;
        if (job.state === "processing") {
          job.state = "pending";
        }
        job.updated_at = new Date().toISOString();
        changed = true;
      }
      return job;
    });

    if (changed) {
      this.saveJobs(newJobs);
    }
  }
}

module.exports = new FileStorage();
