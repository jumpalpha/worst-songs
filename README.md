# Worst Song Ever

Home of every Worst Song Ever installment: https://worstsong.com/

Each song lives at `/<number>/` (e.g. `/36/`). Visit and play counts are stored in Supabase (project `worst-songs`).

To add a song, see the docstring at the top of `build.py`.

Hidden friend songs live at `/friend-songs/` (noindex, not linked from the main page). See the `build.py` docstring.

## Custom songs
- Request form: `/request/` (posts to the "Song Requests" Google Sheet via Apps Script; payments paused).
- Public showcase: `/custom/` (reads `data/custom-songs.json`).
- Paid orders are checked at about 8 AM and 8 PM Mountain by a scheduled task using the `custom-song-orders` skill.
