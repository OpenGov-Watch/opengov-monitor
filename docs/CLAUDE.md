# Documentation

- General rule: Be terse
  - Our docs are directed at an expert audience. Don't explain basic concepts. Don't explain things that can be looked up in the code. Rather, show how it works and how it connects.
  - Do not describe "recent changes", just describe the current state.
  - Avoid text duplication between docs files, README, and CLAUDE.md. They play together. Keep each file terse and only provide an overview over this level of detail. Further details should be in files in subfolders or linked documentation. If a file has more than 100 lines, consider splitting it up.
- `docs/spec/` is only for specification of requirements. It does not specify or document implementation details
- `docs/reference`
  - may document implementation; but remember that the main intention is to have a quick overview of key parts of the codebase. 
  - Don't show code, link to code.
- `docs/howtos/` explain how to use features
- `CLAUDE.md` and `README.md` files
  - CLAUDE.md must give agent just enough context to navigate the folder
  - README.md explains
    - what the folder does and how it is structured
    - where to find documentation
    - relevant shell commands
- If you discover any broken links, find the right file and fix them.