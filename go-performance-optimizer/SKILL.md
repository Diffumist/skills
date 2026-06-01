---
name: go-performance-optimizer
description: Use when diagnosing or optimizing Go application performance, including latency, throughput, memory allocation, GC pressure, goroutine/concurrency behavior, I/O efficiency, HTTP/TCP/TLS networking, load testing, pprof analysis, benchmark design, or Go version performance comparisons.
---

# Go Performance Optimizer

## Core Rule

Measure first. Do not apply performance patterns by habit. Establish a baseline, identify the bottleneck class, make one scoped change, then validate with the same workload.

Synthetic benchmarks are directional only. Production decisions require profiling or load testing against the user's real workload, traffic shape, hardware, and Go version.

## Workflow

1. Define the performance target:
   - Latency: mean, p95, p99, max.
   - Throughput: req/s, ops/s, bytes/s.
   - Memory: allocs/op, B/op, heap live size, GC CPU, pause time.
   - Concurrency: goroutine count, lock contention, queue depth.
   - Networking: DNS, dial, TLS handshake, request latency, connection reuse.

2. Capture a baseline:
   - Microbenchmarks: `go test -bench=. -benchmem -count=10 ./...`
   - Compare changes: `benchstat old.txt new.txt`
   - CPU profile: `go test -cpuprofile cpu.out` or `net/http/pprof`
   - Heap profile: `go test -memprofile mem.out` or `/debug/pprof/heap`
   - Escape analysis: `go build -gcflags="-m"`
   - Load tests for services: use `vegeta`, `wrk`, or `k6`.

3. Classify the bottleneck:
   - High allocations or GC time: use memory/GC patterns.
   - Hot CPU loops: reduce work, copies, boxing, synchronization.
   - Lock contention: inspect mutexes, atomics, sharding, immutable state.
   - Unbounded goroutines: cap concurrency and propagate cancellation.
   - Small frequent I/O: buffer or batch.
   - Network latency: inspect DNS, dial, TLS, pooling, deadlines, protocol choice.

4. Apply the smallest relevant optimization.

5. Re-run the same benchmark or load test. Keep the change only if it improves the target metric without hurting correctness, maintainability, or another critical metric.

## Memory And GC

Use these when profiles show allocation pressure, GC overhead, heap growth, or unstable tail latency.

- Preallocate slices and maps when size is known or predictable.
- Prefer stack allocation for small, short-lived hot-path values when it does not harm API clarity.
- Use `go build -gcflags="-m"` to find heap escapes.
- Avoid accidental interface boxing in hot paths, especially for large values.
- Use `sync.Pool` only for short-lived, reusable, resettable objects such as buffers or scratch state.
- Reset pooled objects before reuse and avoid pooling long-lived/shared objects.
- Consider struct field ordering when many instances exist or false sharing appears in concurrent code.
- Use zero-copy techniques only with clear ownership rules; shared backing arrays can create subtle mutation bugs.
- Tune `GOGC` or `GOMEMLIMIT` only after profiling confirms GC is the bottleneck.
- In containers, consider `GOMEMLIMIT` below the hard memory limit to avoid OOM kills.

## Concurrency

Use these when profiles show goroutine growth, lock contention, queue buildup, or wasted work after cancellation.

- Use worker pools when work is high-volume or unbounded and resources need caps.
- Avoid worker pools for small bounded workloads or latency-critical tasks where queueing is worse than spawning.
- Use atomics for simple counters, flags, and coordination signals.
- Use mutexes for multi-step critical sections or invariants.
- Use immutable data plus atomic pointer/value swaps for read-heavy shared config, routing tables, or snapshots.
- Pass `context.Context` explicitly as the first argument across request boundaries.
- Use context cancellation and deadlines to prevent leaked goroutines and wasted downstream work.
- Do not store contexts in structs or use them as general application state.

## I/O And Data Movement

Use these when syscalls, small writes, copying, or serialization dominate.

- Use `bufio.Reader`/`bufio.Writer` for frequent small I/O.
- Flush deliberately and bound buffer sizes.
- Batch small operations when throughput matters more than immediate per-item latency.
- Avoid batching when latency or fairness is the primary constraint.
- Stream via `io.Reader`/`io.Writer` instead of materializing large intermediate byte slices.
- Avoid repeated `[]byte` to `string` conversions in hot paths unless required.

## Networking

Use these when optimizing Go services, clients, or connection-heavy systems.

- Start with realistic load: `vegeta` for fixed-rate latency, `wrk` for saturation, `k6` for scripted user flows.
- For general APIs, prefer `net/http` with tuned `http.Transport`.
- For custom framed protocols, use `net.Conn` with explicit buffer and deadline management.
- For fire-and-forget telemetry or latency-sensitive updates, consider UDP only if loss/reordering is acceptable.
- Reuse HTTP clients and transports appropriately, but avoid one shared client configuration across unrelated hosts with different pool needs.
- Tune `MaxIdleConns`, `MaxIdleConnsPerHost`, `MaxConnsPerHost`, `IdleConnTimeout`, and request timeouts based on traffic.
- Always close response bodies.
- Use read/write deadlines for long-lived connections.
- Track connection lifecycle phases: DNS, dial, TLS handshake, request write, response read, close.
- Prefer metrics and structured events over high-volume per-connection debug logs.
- For TLS, enable session resumption, use modern TLS versions, configure ALPN intentionally, and avoid expensive certificate verification work in hot paths.
- Change socket options such as `TCP_NODELAY`, buffer sizes, keepalives, or `SO_REUSEPORT` only with load-test evidence.

## Protocol Choice

- Use gRPC for internal APIs where strong typing, streaming, and tooling matter.
- Use HTTP/2 via `net/http` for public APIs or general web services needing multiplexing and connection reuse.
- Use raw TCP only when lower overhead is worth owning framing, flow control, retries, observability, and compatibility.
- Use QUIC when mobile, unreliable networks, multiplexed streams, or connection migration are central requirements.

## Validation Standards

A performance change is not done until it has:

- A before/after benchmark or profile.
- The exact command or load-test shape used.
- Enough runs to reduce noise.
- A correctness check or test run.
- A note on trade-offs, especially memory vs CPU, latency vs throughput, and simplicity vs control.

For noisy benchmarks, use repeated runs and coefficient of variation:

- Reliable: CV < 5%
- Noisy: 5-15%
- Unstable: > 15%

Treat small gains inside noise as inconclusive.
