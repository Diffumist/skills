# Go Version Performance Tracking

Use this reference when comparing Go versions or making version-sensitive performance claims.

## Rules

- Verify the user's actual Go version with `go version`.
- Avoid assuming current Go release behavior from memory.
- For current or future Go release details, consult official Go release notes or local benchmark data.
- Compare versions with the same hardware, OS, environment variables, benchmark inputs, and system load controls.
- Treat synthetic results as directional unless they match the user's workload.

## Collection Pattern

For version comparisons:

```bash
go test -bench=. -benchmem -count=20 ./... > go-old.txt
go test -bench=. -benchmem -count=20 ./... > go-new.txt
benchstat go-old.txt go-new.txt
```

For high-quality collections:

- Run versions sequentially to avoid contention.
- Pin CPU or isolate cores when possible.
- Disable or control CPU frequency scaling when possible.
- Avoid thermal throttling and background load.
- Increase count or benchtime for noisy benchmarks.
- Re-run only high-variance benchmarks when practical.

## Variance Policy

Use CV to classify quality:

- Reliable: CV < 5%.
- Noisy: 5-15%.
- Unstable: > 15%.

Small differences inside noise are inconclusive. Prefer saying "no reliable change observed" over overfitting benchmark output.

## What To Report

For version comparison results, include:

- Go versions.
- GOOS/GOARCH.
- CPU and instance or machine type.
- Benchmark command.
- Count and benchtime.
- `benchstat` output summary.
- Any excluded or noisy benchmarks.
- Whether the result is likely relevant to the user's production workload.
