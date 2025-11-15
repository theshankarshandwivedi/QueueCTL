const Job = require("./job");
const storage = require("../storage/fileStorage");

class Queue {
  enqueue(jobData) {
    const job = Job.fromJSON(jobData);
    storage.addJob(job.toJSON());
    return job;
  }

  getNextJob(workerId) {
    const jobs = storage.loadJobs();

    // Get pending jobs or failed jobs that are ready for retry
    const availableJobs = jobs.filter((job) => {
      const now = new Date();
      // scheduled: check run_at if present
      if (job.run_at) {
        const runAt = new Date(job.run_at);
        if (now < runAt) return false;
      }

      if (job.state === "pending" && !job.locked_by) {
        return true;
      }
      if (job.state === "failed" && !job.locked_by && job.next_retry_at) {
        const now = new Date();
        const retryTime = new Date(job.next_retry_at);
        return now >= retryTime;
      }

      return false;
    });

    // Sort by priority (desc) then created_at (asc)
    availableJobs.sort((a, b) => {
      const pa = a.priority || 0;
      const pb = b.priority || 0;
      if (pa !== pb) return pb - pa; // higher priority first
      return new Date(a.created_at) - new Date(b.created_at);
    });

    if (availableJobs.length === 0) {
      return null;
    }

    const nextJob = availableJobs[0];

    // Try to acquire lock
    const locked = storage.acquireLock(nextJob.id, workerId);

    if (locked) {
      return storage.getJob(nextJob.id);
    }

    return null;
  }

  updateJob(jobId, updates) {
    return storage.updateJob(jobId, updates);
  }

  getJob(jobId) {
    return storage.getJob(jobId);
  }

  getJobsByState(state) {
    return storage.getJobsByState(state);
  }

  getAllJobs() {
    return storage.loadJobs();
  }

  getStats() {
    const jobs = this.getAllJobs();

    const stats = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead: 0,
    };

    jobs.forEach((job) => {
      if (stats[job.state] !== undefined) {
        stats[job.state]++;
      }
    });

    return stats;
  }

  retryDeadJob(jobId) {
    const jobData = storage.getJob(jobId);

    if (!jobData) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (jobData.state !== "dead") {
      throw new Error(`Job ${jobId} is not in dead state`);
    }

    const job = new Job(jobData);
    job.reset();

    storage.updateJob(jobId, job.toJSON());
    return job;
  }

  releaseLock(jobId) {
    return storage.releaseLock(jobId);
  }
}

module.exports = new Queue();
