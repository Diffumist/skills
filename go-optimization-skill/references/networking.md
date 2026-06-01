# Networking

Use this reference for Go services, clients, HTTP/TCP/TLS/DNS latency, high connection counts, long-lived connections, backpressure, socket tuning, and protocol choice.

## Load Test First

Choose the tool based on the question:

- `vegeta`: fixed request rate, latency percentiles, CI-friendly regression checks.
- `wrk`: saturation, upper-bound throughput, high concurrency.
- `k6`: scripted user flows, ramping stages, thresholds, CI scenarios.

Record the exact rate, duration, connection count, endpoint mix, payloads, and environment.

## Connection Lifecycle

Break latency into phases:

- DNS resolution.
- Dial.
- TLS handshake.
- Protocol negotiation.
- Request write.
- Response first byte.
- Response body read.
- Teardown and reuse.

For opaque client latency, instrument each phase with `httptrace`, custom dialers, or structured events. Prefer metrics and sampled structured events over high-volume per-connection logs.

## `net/http`

- Reuse `http.Client` and `http.Transport` intentionally.
- Do not share one client configuration across unrelated hosts with different pool needs.
- Always close response bodies.
- Tune `MaxIdleConns`, `MaxIdleConnsPerHost`, `MaxConnsPerHost`, `IdleConnTimeout`, and request timeouts based on traffic shape.
- Use server `ReadTimeout`, `ReadHeaderTimeout`, `WriteTimeout`, and `IdleTimeout` deliberately.
- Use `ConnContext` and `ConnState` when connection-level observability matters.

## Long-Lived Connections

For WebSockets, streams, and raw TCP:

- Enforce read and write deadlines.
- Make goroutine shutdown explicit.
- Bound per-connection buffers and channels.
- Avoid retaining large slice backing arrays.
- Apply backpressure instead of unbounded queues.
- Track goroutine count, heap growth, connection count, queue depth, and write latency under sustained load.

Common leaks:

- Blocking reads after peer disappearance.
- Writers blocked behind slow clients.
- Per-message goroutines without cancellation.
- Pooled buffers held for the lifetime of a connection.

## Backpressure And Load Shedding

Use bounded queues and admission control before overload reaches dependencies.

- Passive shedding: reject when a bounded channel or queue is full.
- Active shedding: reject based on latency, queue depth, error rate, or resource pressure.
- Circuit breakers protect slow or failing downstream services.
- Graceful degradation should be explicit: reject, degrade features, serve stale data, or reduce work.

Avoid designs that silently queue unlimited work. They convert overload into tail latency and memory growth.

## DNS And TLS

For DNS:

- Distinguish resolver latency from dial latency.
- Know whether cgo or the Go resolver is used.
- Consider caching or custom dialers only when DNS is proven hot or flaky.

For TLS:

- Prefer modern TLS versions.
- Enable session resumption where appropriate.
- Configure ALPN intentionally.
- Avoid expensive certificate verification work in hot paths.
- Measure handshake rate, resume rate, and CPU cost.

## Socket And Runtime Knobs

Tune only with load-test evidence:

- `TCP_NODELAY`: useful for latency-sensitive small messages; can increase packet overhead.
- `SO_REUSEPORT`: useful for multi-process accept scaling; platform-specific.
- `SO_RCVBUF` and `SO_SNDBUF`: too small limits throughput, too large adds memory and latency.
- Keepalives: useful for detecting dead peers; tune interval to workload.
- Backlog and file descriptor limits matter for high connection counts.
- `GOMAXPROCS`, CPU affinity, and thread pinning are advanced controls; validate carefully.

## Protocol Choice

- `net/http` and HTTP/2: general public APIs, connection reuse, multiplexing, low operational complexity.
- gRPC: internal APIs needing strong typing, streaming, tooling, and schema discipline.
- Raw TCP: lowest overhead and maximum control, but you own framing, flow control, retries, observability, compatibility, and failure handling.
- QUIC: mobile or unreliable networks, stream multiplexing, connection migration, or fast startup are central requirements.
