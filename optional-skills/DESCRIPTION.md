# Optional Skills

Official skills maintained by Flash Org that are **not activated by default**.

These skills ship with the flash-agent repository but are not copied to
`~/.flash/skills/` during setup. They are discoverable via the Skills Hub:

```bash
flash skills browse               # browse all skills, official shown first
flash skills browse --source official  # browse only official optional skills
flash skills search <query>       # finds optional skills labeled "official"
flash skills install <identifier> # copies to ~/.flash/skills/ and activates
```

## Why optional?

Some skills are useful but not broadly needed by every user:

- **Niche integrations** — specific paid services, specialized tools
- **Experimental features** — promising but not yet proven
- **Heavyweight dependencies** — require significant setup (API keys, installs)

By keeping them optional, we keep the default skill set lean while still
providing curated, tested, official skills for users who want them.
