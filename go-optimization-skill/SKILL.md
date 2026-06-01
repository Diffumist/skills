---
name: go-optimization-skill
description: Use when diagnosing, reviewing, benchmarking, or optimizing Go application performance, especially allocation pressure, GC behavior, hot paths, concurrency, I/O, HTTP/TCP/TLS networking, pprof analysis, benchmark design, or Go version performance comparisons.
---

# Go Optimization Skill

## Core Rule

Measure first. Do not apply optimization patterns by habit.

Establish a baseline, identify the bottleneck class, make one scoped change, then validate with the same workload. Keep a change only when it improves the target metric without damaging correctness, maintainability, or another critical metric.

Synthetic benchmarks are directional. Production decisions need profiling or load tests that resemble the real workload, traffic shape, hardware, deployment limits, and Go version.

## Workflow

1. Define the target:
   - Latency: mean, p95, p99, max.
   - Throughput: req/s, ops/s, bytes/s.
   - Memory: allocs/op, B/op, heap live size, GC CPU, pause time.
   - Concurrency: goroutine count, lock contention, queue depth.
   - Networking: DNS, dial, TLS handshake, request write, response read, connection reuse.

2. Capture a baseline:
   - Microbenchmark: `go test -bench=. -benchmem -count=10 ./...`
   - Compare results: `benchstat old.txt new.txt`
   - CPU profile: `go test -cpuprofile cpu.out` or `net/http/pprof`
   - Heap profile: `go test -memprofile mem.out` or `/debug/pprof/heap`
   - Escape analysis: `go build -gcflags="-m" ./...`
   - Service load test: choose `vegeta`, `wrk`, or `k6` based on the scenario.

3. Classify the bottleneck:
   - High allocations, heap growth, or GC time: read [memory-gc.md](references/memory-gc.md).
   - Goroutine growth, lock contention, queues, cancellation leaks: read [concurrency-io.md](references/concurrency-io.md).
   - Small frequent I/O, copying, buffering, batching, serialization: read [concurrency-io.md](references/concurrency-io.md).
   - HTTP/TCP/TLS/DNS latency, long-lived connections, backpressure, protocol choice: read [networking.md](references/networking.md).
   - Benchmark design, pprof, load-test choice, variance: read [benchmarking.md](references/benchmarking.md).
   - Go release comparisons or version-sensitive performance claims: read [version-tracking.md](references/version-tracking.md).

4. Apply the smallest relevant optimization.

5. Re-run the same benchmark or load test. Report the command, workload shape, before/after numbers, and trade-offs.

## Review Checklist

When reviewing Go performance changes, look for these first:

- A benchmark or profile proving the target bottleneck exists.
- A stable before/after comparison with enough repetitions.
- Correctness tests still run.
- No hidden API complexity for a small or noisy gain.
- No new shared ownership hazards from pooling, zero-copy, slices, or goroutines.
- Context cancellation and deadlines preserved through request boundaries.
- Response bodies closed and connection reuse behavior understood.
- Memory-vs-CPU, latency-vs-throughput, and simplicity-vs-control trade-offs stated.

## Common Commands

```bash
go test -bench=. -benchmem -count=10 ./... > old.txt
go test -bench=. -benchmem -count=10 ./... > new.txt
benchstat old.txt new.txt
go test -run=^$ -bench=BenchmarkName -benchmem -cpuprofile cpu.out -memprofile mem.out ./pkg
go tool pprof -http=:0 cpu.out
go build -gcflags="-m" ./...
```

For services:

```bash
vegeta attack -rate=100 -duration=30s -targets=targets.txt | tee results.bin | vegeta report
wrk -t4 -c100 -d30s http://localhost:8080/fast
k6 run script.js
```

## Standards

- Treat small gains inside benchmark noise as inconclusive.
- Prefer boring code that stays fast under real traffic.
- Do not tune `GOGC`, `GOMEMLIMIT`, socket options, `GOMAXPROCS`, or protocol choices without measurement.
- For version-specific advice, verify the user's Go version and avoid assuming current release behavior.
