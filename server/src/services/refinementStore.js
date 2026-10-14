import { randomUUID } from "crypto";

const JOB_TTL_MS = 15 * 60 * 1000;

const jobs = new Map();

function pruneJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;

  for (const [jobId, job] of jobs.entries()) {
    if (job.updatedAt <= cutoff) {
      jobs.delete(jobId);
    }
  }
}

function toSerializableJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error
  };
}

export function createRefinementJob({ initialResult, livePromise }) {
  pruneJobs();

  const id = randomUUID();
  const now = Date.now();
  const job = {
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    result: initialResult,
    error: ""
  };

  jobs.set(id, job);

  livePromise
    .then((result) => {
      const currentJob = jobs.get(id);

      if (!currentJob) {
        return;
      }

      currentJob.status = "ready";
      currentJob.result = result;
      currentJob.updatedAt = Date.now();
    })
    .catch((error) => {
      const currentJob = jobs.get(id);

      if (!currentJob) {
        return;
      }

      currentJob.status = "failed";
      currentJob.error = error?.message || "Refinement failed.";
      currentJob.updatedAt = Date.now();
    });

  return toSerializableJob(job);
}

export function getRefinementJob(id) {
  pruneJobs();

  const job = jobs.get(id);

  return job ? toSerializableJob(job) : null;
}
