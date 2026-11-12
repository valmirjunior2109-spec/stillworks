# VHS tape for the README GIF. See assets/RECORDING.md. Needs `npm run demo:broken` running.
Output assets/demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1100
Set Height 620
Set Padding 24
Set Framerate 24
Set TypingSpeed 45ms
Set Theme { "name": "publishub", "black": "#0d0b12", "red": "#ff6b6b", "green": "#57d98c", "yellow": "#f2d7a0", "blue": "#9147ff", "magenta": "#c18aff", "cyan": "#c18aff", "white": "#f2d7a0", "brightBlack": "#8f84a8", "brightRed": "#ff6b6b", "brightGreen": "#57d98c", "brightYellow": "#f2d7a0", "brightBlue": "#a875ff", "brightMagenta": "#c18aff", "brightCyan": "#c18aff", "brightWhite": "#ffffff", "background": "#0d0b12", "foreground": "#f2d7a0", "selection": "#2a2238", "cursor": "#9147ff" }

Hide
Type "npm link --silent >/dev/null 2>&1; export REPO=$PWD; cd $(mktemp -d) && npm link stillworks --silent >/dev/null 2>&1 && npx stillworks init --skip-install >/dev/null && sed -i.bak 's/timeout: 10_000/timeout: 3_000/' journeys.config.ts && clear" Enter
Sleep 4s
Show

Type "npx stillworks run --url http://127.0.0.1:4173" Sleep 500ms Enter
Sleep 9s
Type "sed -n '7,30p' verify-report/REPORT.md" Sleep 400ms Enter
Sleep 6s
