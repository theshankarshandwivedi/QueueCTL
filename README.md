# queuectl

Simple CLI job queue with workers, retries, exponential backoff and DLQ.

Features

- Enqueue jobs via CLI (`queuectl enqueue`) or from a file
- Start multiple worker processes (`queuectl worker start --count N`)
- Graceful worker shutdown (`queuectl worker stop`)
- Persistent storage in `data/*.json`
- Retry with exponential backoff, DLQ when retries exhausted
- Configuration via `queuectl config set <key> <value>`

Usage

- Enqueue job (inline JSON):

```powershell
node .\bin\queuectl.js enqueue "{\"id\":\"job1\",\"command\":\"sleep 2\"}"
```

- Enqueue from file:

```powershell
node .\bin\queuectl.js enqueue --file .\job.json
# or
node .\bin\queuectl.js enqueue @job.json
```

- Start workers:

```powershell
node .\bin\queuectl.js worker start --count 3
```

- Stop workers (from another terminal):

```powershell
node .\bin\queuectl.js worker stop
```

- Show status:

```powershell
node .\bin\queuectl.js status
```

- List jobs:

```powershell
node .\bin\queuectl.js list --state pending
```

- DLQ operations:

```powershell
node .\bin\queuectl.js dlq list
node .\bin\queuectl.js dlq retry <jobId>
```

- Config:

```powershell
node .\bin\queuectl.js config set max-retries 5
node .\bin\queuectl.js config get
```

Testing

Run the integration tests:

```powershell
npm test
```

Notes & Recommendations

- For complex job payloads prefer `--file` to avoid shell quoting problems.
- If worker processes crash while running a job, the system will clean stale locks on startup.
- The logger is lightweight and controlled via `QUEUECTL_DEBUG=1` for debug output.

License: MIT
