# GitHub repository settings

**About / description:** Your AI writes the code. This checks it still works. Run signup, login and checkout in a real browser and get a bug report your coding agent can fix.

**Website:** https://getpublishub.com/?utm_source=gh_about

**Topics** (Settings → About → Topics):

```
playwright
e2e-testing
claude-code
cursor
ai-coding
vibe-coding
regression-testing
developer-tools
```

**Social preview:** Settings → General → Social preview → upload `assets/social-preview.png` (1280×640).

Or set the description, website and topics from the terminal (after the repo exists):

```sh
gh repo edit valmirjunior2109-spec/stillworks \
  --description "Your AI writes the code. This checks it still works. Run signup, login and checkout in a real browser and get a bug report your coding agent can fix." \
  --homepage "https://getpublishub.com/?utm_source=gh_about" \
  --add-topic playwright --add-topic e2e-testing --add-topic claude-code --add-topic cursor \
  --add-topic ai-coding --add-topic vibe-coding --add-topic regression-testing --add-topic developer-tools
```
