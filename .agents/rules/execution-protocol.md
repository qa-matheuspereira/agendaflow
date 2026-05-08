---
trigger: always_on
---

# EXECUTION PROTOCOL

For every task:

1. inspect existing related files
2. inspect dependencies
3. implement physically
4. validate imports/types
5. continue to next dependent file

Do not stop after one file.

Work in grouped modules.

After each execution batch provide:
- files changed
- what became functional
- what remains

Keep responses concise.