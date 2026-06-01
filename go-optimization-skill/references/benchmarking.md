# Benchmarking And Profiling

Use this reference for benchmark design, pprof analysis, load testing, noisy data, and validating performance changes.

## Microbenchmarks

Start simple:

```bash
go test -bench=. -benchmem -count=10 ./... > old.txt
go test -bench=. -benchmem -count=10 ./... > new.txt
benchstat old.txt new.txt
```

For focused work:

```bash
go test -run=^$ -bench=BenchmarkName -benchmem -count=20 ./pkg
```

Design rules:

- Benchmark the operation that matters, not setup noise.
- Use realistic input sizes.
- Include allocation metrics with `-benchmem`.
- Use enough repetitions for stable results.
- Avoid comparing results gathered under different system load.
- Treat sub-percent gains cautiously unless the benchmark is extremely stable.

## Profiles

CPU profile:

```bash
go test -run=^$ -bench=BenchmarkName -cpuprofile cpu.out ./pkg
go tool pprof -http=:0 cpu.out
```

Heap profile:

```bash
go test -run=^$ -bench=BenchmarkName -memprofile mem.out ./pkg
go tool pprof -http=:0 mem.out
```

Service pprof:

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
go tool pprof http://localhost:6060/debug/pprof/heap
```

Interpret profiles by bottleneck class:

- CPU top functions: reduce work, algorithmic cost, serialization, hashing, copies.
- Heap alloc space: reduce allocation rate.
- Heap in use: reduce retention.
- Goroutine profile: find blocked or leaked goroutines.
- Mutex/block profiles: validate contention before changing synchronization.

## Load Testing

Use `vegeta` for fixed-rate latency:

```bash
vegeta attack -rate=100 -duration=30s -targets=targets.txt | tee results.bin | vegeta report
vegeta report -type='hist[0,10ms,50ms,100ms,200ms,500ms,1s]' < results.bin
```

Use `wrk` for saturation:

```bash
wrk -t4 -c100 -d30s http://localhost:8080/fast
```

Use `k6` for workflows:

```bash
k6 run script.js
```

Always report:

- Target URL or operation.
- Rate, duration, concurrency, payload size, and endpoint mix.
- Go version, CPU, OS, container limits, and relevant environment variables.
- p50, p95, p99, max, error rate, throughput, memory, and goroutine count.

## Variance

Use coefficient of variation:

```text
CV = (stddev / mean) * 100
```

Interpretation:

- CV < 5%: stable.
- 5-10%: acceptable.
- 10-15%: review carefully.
- 15-30%: re-run or improve environment.
- > 30%: unreliable.

Runtime and standard-library CPU benchmarks should usually aim below 5%. Networking benchmarks often tolerate 10-15% because I/O is noisier.

Common causes of variance:

- CPU frequency scaling.
- Thermal throttling.
- Background processes.
- VM or container contention.
- Network variability.
- Parallel benchmark interference.

## Validation Output

When finishing a performance task, include:

- What was measured.
- Commands used.
- Before/after numbers.
- Whether the result exceeds noise.
- Correctness checks run.
- Trade-offs and remaining uncertainty.
