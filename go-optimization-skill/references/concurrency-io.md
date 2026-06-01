# Concurrency And I/O

Use this reference when profiles show goroutine growth, lock contention, queue buildup, cancellation leaks, small I/O, serialization cost, or syscall overhead.

## Goroutines And Cancellation

- Pass `context.Context` as the first argument across request boundaries.
- Propagate cancellation to downstream calls and goroutines.
- Add deadlines for network and external dependency calls.
- Watch for goroutines blocked on channels, reads, writes, locks, or unbounded retries.
- Do not store contexts in structs or use them as generic application state.

Useful checks:

```bash
curl http://localhost:6060/debug/pprof/goroutine?debug=2
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
```

## Worker Pools

Use worker pools when:

- Work is high-volume or unbounded.
- Downstream resources need a hard cap.
- Queue depth is observable and bounded.
- Throughput matters more than per-item immediate scheduling.

Avoid worker pools when:

- Work is small, bounded, and latency-sensitive.
- Queueing will hide overload.
- Per-task cancellation would become harder.

Bound the queue, expose queue depth, and define rejection behavior.

## Atomics, Mutexes, Immutable State

- Use atomics for simple counters, flags, and pointer/value swaps.
- Use mutexes for multi-step invariants.
- Use immutable data plus atomic swap for read-heavy config, routing tables, and snapshots.
- Prefer clarity over clever lock-free code unless contention is proven.

Atomic code should have a small, explicit invariant. If the invariant takes a paragraph to explain, a mutex may be safer.

## Buffering And Batching

Use buffering when small reads or writes cause excess syscalls.

Use batching when:

- Throughput is more important than per-item latency.
- Operations have fixed overhead such as network round trips, locks, or serialization setup.
- Batch size and max wait time are bounded.

Avoid batching when:

- Tail latency or fairness is the main goal.
- Failure handling becomes ambiguous.
- Queues can grow without backpressure.

Always define flush conditions: size, time, shutdown, and error.

## I/O Data Movement

- Prefer `bufio.Reader` and `bufio.Writer` for frequent small I/O.
- Flush deliberately.
- Bound buffer sizes.
- Avoid copying through intermediate `[]byte` when streaming is sufficient.
- Reuse scratch buffers only when ownership is local and reset is guaranteed.
