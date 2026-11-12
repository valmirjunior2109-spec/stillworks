# Indie Hackers post

Post at https://www.indiehackers.com/new-post (pick the "Building in Public" or "Developers" group).

**Title:** I open-sourced a slice of my product to get it in front of developers. Here's the plan.

**Post:**

I'm building Publishub, a tool that verifies AI-written apps still work: it will run your critical user journeys after every change and compare them with your last working version. It isn't launched yet.

Earlier feedback here was blunt: waitlist signups aren't paying customers, and nobody knows you exist. So I tried something different. I took the part I could ship today and open-sourced it.

**stillworks** is a CLI that runs signup, login and checkout in a real browser and writes a report your coding agent (Claude Code, Cursor, Codex) can fix from. It's MIT, no telemetry, and it's useful on its own: https://github.com/valmirjunior2109-spec/stillworks

How it connects to the business, openly:

- The README explains what the CLI does and what the hosted version will add (regression diffs, history, runs on every PR)
- The CLI prints one line at the end of each run pointing to Publishub, which you can turn off with a flag
- Every link has its own UTM, so I'll know whether GitHub, the CLI, or the reports bring people

What I'll share back here: stars, npm downloads, and how many waitlist signups and founding customers each channel brings. If you've done open source as distribution, what worked and what didn't?

Waitlist and founding spots: https://getpublishub.com/?utm_source=indiehackers
