# Langfuse Observability Plugin

This plugin ships bundled with Nyxo but is **opt-in** — it only loads when
you explicitly enable it.

## Enable

Pick one:

```bash
# Interactive: walks you through credentials + SDK install + enable
nyxo tools  # → Langfuse Observability

# Manual
pip install langfuse
nyxo plugins enable observability/langfuse
```

## Required credentials

Set these in `~/.nyxo/.env` (or via `nyxo tools`):

```bash
NYXO_LANGFUSE_PUBLIC_KEY=pk-lf-...
NYXO_LANGFUSE_SECRET_KEY=sk-lf-...
NYXO_LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or your self-hosted URL
```

Without the SDK or credentials the hooks no-op silently — the plugin fails
open.

## Verify

```bash
nyxo plugins list                 # observability/langfuse should show "enabled"
nyxo chat -q "hello"              # then check Langfuse for a "Nyxo turn" trace
```

## Optional tuning

```bash
NYXO_LANGFUSE_ENV=production       # environment tag
NYXO_LANGFUSE_RELEASE=v1.0.0       # release tag
NYXO_LANGFUSE_SAMPLE_RATE=0.5      # sample 50% of traces
NYXO_LANGFUSE_MAX_CHARS=12000      # max chars per field (default: 12000)
NYXO_LANGFUSE_DEBUG=true           # verbose plugin logging
```

## Disable

```bash
nyxo plugins disable observability/langfuse
```
