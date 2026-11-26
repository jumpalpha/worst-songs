<!-- orion-brain pointer: keep at top -->
# Orion's shared memory (read first)
Orion's memory for all Claude surfaces lives on the private `brain` branch of jumpalpha/Alans-Stuff.
At session start:
- If `~/orion-brain` exists (Orion's PC): `git -C ~/orion-brain pull -q`, then read `~/orion-brain/CLAUDE.md`.
- Otherwise (cloud): attach jumpalpha/Alans-Stuff (add_repo, read access), run
  `git clone --depth 1 -b brain https://github.com/jumpalpha/alans-stuff ~/orion-brain`, then read `~/orion-brain/CLAUDE.md`.
- Follow its rules (incl. `inbox/from-code.md` for new facts Orion states).
Tasks live in GitHub Issues on jumpalpha/Alans-Stuff (labels `to:code`, `to:local`, `to:chrome`, `to:chat`).
Never copy brain contents into this repo.
<!-- /orion-brain pointer -->

