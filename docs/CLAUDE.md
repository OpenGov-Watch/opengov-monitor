# Documentation

- General rule: Be terse
  - Our docs are directed at an expert audience. Don't explain basic concepts. Don't explain things that can be looked up in the code. Rather, show how it works and how it connects.
  - Do not describe "recent changes", just describe the current state.
  - Avoid text duplication between docs files, README, and CLAUDE.md. They play together. Keep each file terse and only provide an overview over this level of detail. Further details should be in files in subfolders or linked documentation. If a file has more than 100 lines, consider splitting it up.
    - This means: Whatever you want to write, it likely doesn't belong into the root README...
- Roles:
  - each file type has a specific role. Make sure that you respect the roles:
  - `docs/01_requirements/` functional, non-functional requirements, and use cases
  - `docs/02_specification/` specifies API, data model, migration
  - `docs/03_design/` architecture, adrs, sequences
    - explains architecture and design decisions
    - Don't show code, link to code.
  - `docs/howtos/` explain how to use features
  - `CLAUDE.md` and `README.md` files
    - CLAUDE.md must give agent just enough context to navigate the folder
    - README.md explains
      - what the folder does and how it is structured
      - where to find documentation
      - relevant shell commands
    - README is directed at everyone, CLAUDE.md is directed at agents
- If you discover any broken links, find the right file and fix them.

See [README.md](README.md) for overall documentation structure.
