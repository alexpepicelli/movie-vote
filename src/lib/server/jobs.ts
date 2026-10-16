export type JobName = 'radarr-poller' | 'night-scheduler' | 'backups';

export type JobStatus = {
	lastRun: Date | null;
	lastSuccess: Date | null;
	lastError: { at: Date; message: string } | null;
};

// On globalThis so pollers started before a dev-server reload still report to the same place.
const globals = globalThis as { __votarrJobs?: Map<JobName, JobStatus> };
const jobs = (globals.__votarrJobs ??= new Map());

/** Records one run of a background job, for the admin health page. */
export function recordRun(name: JobName, error?: unknown, now = new Date()) {
	const prev = jobs.get(name) ?? { lastRun: null, lastSuccess: null, lastError: null };
	jobs.set(name, {
		lastRun: now,
		lastSuccess: error === undefined ? now : prev.lastSuccess,
		lastError:
			error === undefined
				? prev.lastError
				: { at: now, message: error instanceof Error ? error.message : String(error) }
	});
}

export const jobStatus = (name: JobName): JobStatus =>
	jobs.get(name) ?? { lastRun: null, lastSuccess: null, lastError: null };
