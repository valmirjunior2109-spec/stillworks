# Recording the README GIF

The current `assets/demo.gif` was rendered from the real output of `stillworks run` against `npm run demo:broken` and the real `REPORT.md` it wrote. The 10-second wait on the broken step is shortened. To replace it with a live screen recording: The easiest way to make it is [VHS](https://github.com/charmbracelet/vhs) (macOS, Linux, Windows), which records a script, so you get the same GIF every time.

1. Install VHS: `brew install vhs` (macOS), `winget install charmbracelet.vhs` (Windows) or see its README for Linux.
2. From the repo root, build and start the broken demo app:

   ```sh
   npm install && npm run build && node dist/cli.js install
   npm run demo:broken
   ```

3. In another terminal, from the repo root:

   ```sh
   vhs assets/demo.tape
   ```

   The tape `npm link`s the local build so the GIF shows the real `npx stillworks` command, runs it in a temporary folder and writes `assets/demo.gif`.

4. Check it's under ~5 MB (GitHub shows GIFs up to 10 MB). If it's bigger, lower `Set Width` or `Set Framerate` in the tape.

No VHS? Use any screen recorder at about 1100×620, then convert with [gifski](https://gif.ski). Show `npx stillworks run`, the red ✗ on signup, and the first lines of `REPORT.md`.
