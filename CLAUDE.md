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

# Claude Handoff

At the start of every session, read the "Claude Handoff" Google Doc (Google Drive connector, or open it in Chrome):
https://docs.google.com/document/d/1S3rZuuVtQcylev2BwHXT6Djg6_LN2Zf68E6wYCicjQg/edit

- Do any OPEN tasks addressed to "code" or "anyone" that belong to this repo.
- When done, mark the entry DONE and write a short result under it.
- To hand work to Claude chat or Claude in Chrome, add a new entry at the top of the Entries section: date | From: code | To: chat/chrome | Status: OPEN | Task.
