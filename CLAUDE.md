# omnichannel-ai-workspace — notes for Claude

## Related repositories
- Lynn Seal's realtor site (lynnsealnaples.com) lives in its own repo: github.com/adam3302127/lynnsealnaples. Do not recreate it here; this repo keeps GitHub Pages free for other projects.

## Working in the cloud session
- Outbound network follows the environment's policy. If a host is blocked (403 on CONNECT), tell Adam the host and let him open it in the environment's Network access settings rather than working around it.
- GitHub API paths for repository settings (Pages, workflow dispatch) are blocked through the session proxy. Settings changes are Adam's; trigger workflows with a real commit.
- Playwright Chromium here needs `--headless=new` with `ignoreDefaultArgs: ['--headless=old','--headless']`, and has no H.264 decoder.
- Lighthouse runs with `CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and `--chrome-flags="--headless=new --no-sandbox"`.

## Working with Adam
- Anything that costs money (domains, hosting plans, data feeds) stops for an explicit yes; show the price and a single link.
- Keep personal/family assets out of Fresh Bros accounts (domains, registrars, hosting).
- Before touching `main` on a shared repo, ask; he answers fast ("merge it").
