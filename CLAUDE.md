# Notes for agents

@README.md

- Other sessions work in this repo, the site ([Mark-Bugden.github.io](https://github.com/Mark-Bugden/Mark-Bugden.github.io)), demo-kit and the other project repos at the same time. Run the site's `scripts/status.sh` before you change or describe a project, and again before you report back, and don't rely on what you saw earlier. An open PR, or a branch with commits that aren't in main, usually means someone is working there. Pull before you edit, and don't run `npm ci` or `npm install` while another session's dev server is running in the same clone.
- Mark writes the English copy himself. Use his wording as given, and don't write new prose about him or his work.
- Each change is one PR that bumps `version` in `package.json`. Merging it tags the release. Each project moves to it in its own PR, by bumping the kit's tag in its `demo/package.json`. Never push tags by hand.
- Don't open a pull request until CI's checks pass locally: every failed CI run emails Mark. Here they are `npm run lint` and `npm test`. CI also builds `template/` against this commit and validates it (see `.github/workflows/ci.yml`).
