# Contributing

This is a commercetools-labs project, provided as-is and unsupported (see [SUPPORT.md](SUPPORT.md)). Contributions are
welcome and reviewed on a best-effort basis; a small, self-contained change is the easiest kind to land.

Only contribute code you have the right to license under MIT, and never commit credentials or personal data.

1. Fork the repository and create a branch.
2. Install each folder and run the whole check (needs Node 22 or later):

   ```bash
   for d in core shared service ledger seed budget-view; do (cd $d && npm ci); done
   npm test
   ```

   `npm test` runs every suite, the requirement trace, the package check and the Connect build check. It must pass.
3. Work spec first: a behaviour change starts with a requirement in `openspec/specs/<capability>/spec.md`, and the code
   and the test cite its ID (`[BCC-CART-12]`). `node tools/trace.mjs --write` refreshes `docs/traceability.md`.
4. Open a pull request describing what changed and why.

By contributing you agree your contribution is licensed under the [MIT License](LICENSE).
