# Memory And GC

Use this reference when profiles show allocation pressure, heap growth, GC overhead, or unstable tail latency.

## First Checks

- Run `go test -bench=. -benchmem -count=10 ./...`.
- Capture heap profiles under realistic load, not only tiny microbenchmarks.
- Inspect escape analysis with `go build -gcflags="-m" ./...`.
- Compare before/after with `benchstat`.
- Confirm the hot allocation is in a path that matters.

## Allocation Reduction

- Preallocate slices and maps when size is known or bounded.
- Reuse backing storage when ownership is local and clear.
- Stream through `io.Reader`/`io.Writer` instead of materializing large `[]byte` values.
- Avoid repeated `[]byte` to `string` conversions in hot paths.
- Avoid accidental interface boxing for large values or tight loops.
- Do not contort clear APIs to remove rare or cold-path allocations.

## Escape Analysis

Look for:

- Returning pointers to locals.
- Capturing variables in closures.
- Interface conversions.
- Assigning local addresses into globals or longer-lived structs.
- Large composite literals.

Useful command:

```bash
go build -gcflags="-m" ./...
```

Only optimize escapes when they are hot, frequent, and visible in benchmark or profile data.

## `sync.Pool`

Use `sync.Pool` when:

- Objects are short-lived, reusable, and resettable.
- Allocation or GC churn is measurable.
- Lifecycle is local and does not require precise ownership.
- Typical targets are buffers, scratch memory, encoders, or temporary request state.

Avoid `sync.Pool` when:

- Objects are long-lived or shared across goroutines.
- Reuse rate is low.
- The pool retains large buffers unnecessarily.
- Predictable lifecycle matters more than allocation speed.
- The optimization makes simple code hard to reason about.

Always reset pooled objects before reuse. Be careful with slices that keep large backing arrays alive.

## Struct Layout And False Sharing

Consider field ordering when:

- Many instances exist.
- The struct appears in a hot path.
- Padding materially changes memory footprint.
- Concurrent fields are updated by different goroutines and false sharing appears in profiles.

Do not reorder public structs casually if it changes API expectations or serialization behavior.

## GC Tuning

Tune `GOGC` or `GOMEMLIMIT` only after profiling shows GC as the bottleneck.

- In containers, set `GOMEMLIMIT` below the hard memory limit to reduce OOM risk.
- Lower `GOGC` can reduce heap growth at the cost of more GC CPU.
- Higher `GOGC` can reduce GC frequency at the cost of memory.
- `GOGC=off` is only reasonable with an explicit memory limit and careful validation.

## Zero-Copy

Use zero-copy techniques when copying dominates and ownership rules are simple.

Avoid zero-copy when:

- Shared backing arrays can be mutated unexpectedly.
- Lifetimes become unclear.
- Security-sensitive data may be retained longer than intended.
- The saved copy is not visible in measurements.
