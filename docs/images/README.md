# Portfolio images

| File | Description |
|------|-------------|
| `eval-results.png` | Terminal screenshot — `npm run ai:eval` (15/15) |
| `eval-results.txt` | Full run log (includes copilot debug lines) |
| `eval-results-clean.txt` | Portfolio-friendly text summary |
| `chat-demo.png` | Analytics chat UI demo (follow-up question) |
| `chat-demo.html` | Source for chat screenshot — re-export after UI changes |

## Refresh eval screenshot

```bash
npm run db:up
npm run ai:eval
# update eval-terminal.html if case ids change, then:
npx playwright screenshot file:///.../eval-terminal.html docs/images/eval-results.png
```

For a **live** chat screenshot: log into uddoktahut.com → Analytics → capture manually, save as `chat-demo-live.png`.
