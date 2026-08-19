## Cumulocity Web Development Wiki

This project has a local `cumulocity-web-wiki/` folder (symlinked to a shared
knowledge wiki) covering Cumulocity Web SDK / Angular development and the
Cumulocity brand & design system.

Before implementing Cumulocity widgets, plugins, components, or branding/theming
work, check its [index.md](cumulocity-web-wiki/index.md) for a relevant concept
file (architecture, components, branding, patterns) — it may save you a
re-derivation of something already documented.

**If you find something in the wiki that's wrong, outdated, unclear, or missing**
while working here, submit feedback instead of silently ignoring it or
patching your local understanding only:

1. Copy `cumulocity-web-wiki/feedback/template.md` to
   `cumulocity-web-wiki/feedback/inbox/<YYYYMMDD>-<short-slug>.md`.
2. Fill in the frontmatter (`target`, `submitted_by: "<this-project's-name>"`,
   `type`, `severity`) and describe the observation with concrete evidence.
3. Do **not** edit files under `architecture/`, `components/`, `branding/`, or
   `patterns/` directly — the wiki maintainer reviews and incorporates feedback
   from the inbox so changes stay traceable.

Full process details: `cumulocity-web-wiki/feedback/README.md`.