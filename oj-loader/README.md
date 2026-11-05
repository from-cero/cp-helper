# OJ Loader (Chrome)

**Version 1.2.34** - aligned with **OJ Runner 1.2.34**.

Chrome extension that reads sample tests from AtCoder, Codeforces and LeetCode problem pages and
sends them to OJ Runner in VS Code. It also submits solutions to Codeforces and AtCoder for OJ
Runner.

## Behavior

1. The toolbar action POSTs JSON to OJ Runner's local server, `http://127.0.0.1:<port>/import`,
   where the port is `ojRunner.localImportPort` (17337 by default). Samples never go through the
   clipboard, and Chrome shows no `vscode://` prompt. LeetCode imports may include `starterCode`,
   which OJ Runner copies to the VS Code clipboard; the page's own clipboard is not reliable from a
   toolbar click.
2. If the POST fails and the fallback option is on, it opens
   `vscode://from-cero.oj-runner/focusSamples` so OJ Runner comes to the front. The samples are not
   in that URL; paste them by hand if needed.

### Codeforces contest list

On a contest page (`/contest/<id>` or `/gym/<id>`, which has no statements), the toolbar action
reads the problem table instead of samples. It sends OJ Runner the argument line for `contest.sh`
in the problem repo: the contest id and the problem labels in page order, split subproblems
included (`2266 A,B,C1,C2,D,E`). OJ Runner puts it on the VS Code clipboard and imports nothing.
Use `/contest/<id>/problems` for the samples.

### AtCoder contest list

On a contest top page (`/contests/<id>`) or its task list (`/contests/<id>/tasks`), the toolbar
action sends the `contest.sh` line the same way: the contest id and the task labels in table
order, `Ex` included (`abc475 A,B,C,D,E,F,G`). The top page has no task links, so the labels come
from a same-origin `fetch` of `/contests/<id>/tasks` inside the tab, with your AtCoder session.
Labels are sent as the table prints them, so a round whose last task is still labeled `H` sends
`H`, which `contest.sh` rejects. Rename it to `Ex`.

### LeetCode contest list

On a contest page (`/contest/weekly-contest-520/`, `/contest/biweekly-contest-178/`), the toolbar
action sends the `contest.sh` line. LeetCode has no problem letters, so the labels are positional
(`lcwk520 A,B,C,D` for four problems). The contest name is the one `contest.sh` expects:
`weekly-contest-<n>` becomes `lcwk<n>` and `biweekly-contest-<n>` becomes `lcbw<n>`. The problem
table is rendered client side, so when the tab has not drawn it yet the labels come from the
contest's `/contest/api/info/<slug>/` JSON. Any other contest slug has no `contest.sh` name and is
reported as a failure.

### LeetCode problem page

On a problem page, the toolbar action:

- Reads Example 1, 2, ... from every `span.example-io` node under the description, not only those
  inside `div.example-block`, since later examples are often siblings below it. `Input:` and
  `Output:` are found from `strong` labels or the row text.
  - Classic inputs are `name = value` chunks, split with commas in mind. Each value becomes one
    stdin line, in the order of the C++ method's parameters from the editor starter when it can be
    read. For example, `nums`, `p`, `queries` become three lines when that is the C++ parameter
    order.
  - Design and interactive inputs (a JSON method list and its arguments, no `=`) are sent as one
    stdin line per non-empty line of the Input span.
- Reads the starter code from the editor: Monaco `.view-line` (usual on practice pages) or
  CodeMirror 6 `.cm-line` (many contest tabs). It is sent unchanged as `starterCode`, and OJ Runner
  copies it to the VS Code clipboard. Copying inside the page is best effort and is often blocked
  without a user gesture.
- Falls back to the custom testcase fields in the bottom console (`console-testcase-input`) when
  the page has no examples. The expected output may then be empty; fill it in OJ Runner.
- Labels the problem `leetcode/<number>`, with the number from the title row, the meta titles or
  the page JSON (including `__NEXT_DATA__`). URL slugs are never used, so a page with no numeric id
  imports its samples without a problem label.

### Problem tab titles

A content script on Codeforces and AtCoder problem pages sets the tab title to
`<letter> - <contest>` (`/contest/2266/problem/D` becomes `D - 2266`,
`/contests/abc451/tasks/abc451_a` becomes `A - abc451`), so a row of open problems reads as the
problem list. Contest lists, standings and other pages keep their title. The title is set again
when the page changes it or navigates in place. LeetCode is not covered, since its URL has the slug but not the problem number.
Turn this off with Short tab titles on Codeforces and AtCoder problem pages on the options page
(default on). The change applies on the next page load.

### Codeforces problem tags

With Hide Codeforces problem tags except the rating on (options page, default off), a content
script hides every Codeforces problem tag except the difficulty (`*2600`), so the topic tags do
not give the solution away. The box around each hidden tag goes with it. The script runs at
`document_start`, hides all tags with a style before the page paints, then shows the ones whose
text is `*<number>`. The change applies on the next page load.

## Submit bridge

OJ Runner cannot call a service worker, since MV3 has no inbound socket. The worker instead keeps
a WebSocket open to OJ Runner on `127.0.0.1` and waits for jobs. A job carries the problem, the
language to pick and the source. OJ Loader parks a background tab on the judge's submit page,
replays that page's form from inside the tab, then polls your submissions page until the verdict
settles and sends it back.

Everything that needs the judge session runs in the tab. A `fetch` from the extension counts as
cross-site for SameSite cookies, so it would submit as a logged-out user. Running in the page also
uses the judge's own `csrf_token` (and on Codeforces `ftaa` and `bfaa`) exactly as issued. There
is no login and no captcha, and no judge password ever reaches this extension.

Codeforces protects its submit form with an anti-bot widget. Its token is filled in a second or
two after the page loads, so the driver waits for it before replaying the form; a replay without
it comes back as _"Please complete the anti-bot verification"_. When the widget needs the user,
the tab is brought to the front and the submit is reported as waiting for that instead of failing
silently. A token is good for one submission and the widget keeps showing the spent one, so a tab
that has already posted is reloaded before the next submit.

Judge tabs are pooled and reused across jobs. With Close the judge tab once the verdict is in on
(options page, default off), a tab closes when its job ends on a settled verdict. A job that ends
on an error, a polling timeout, a login redirect or an anti-bot widget waiting for the user leaves
its tab open. The last job that used a tab decides.

To pair, run OJ Runner: Copy Submit Bridge URL in VS Code and paste the result into the options
page. The URL carries a token. WebSocket connections are not subject to CORS, so that token is the
only thing keeping other pages and local programs off the socket. Treat it as a password.

Chrome suspends an idle service worker after about 30 seconds. Traffic on the socket resets that
timer (OJ Runner sends a `ping` every 20 seconds), and an `alarms` keepalive wakes the worker once
a minute to reconnect after a suspend.

## Source layout

TypeScript lives in `src/` and static files in `public/`. `npm run build` type-checks with `tsc`,
bundles with esbuild and writes the loadable extension to `dist/`.

| File                                     | Role                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/background.ts`                      | Service worker: injects `inpage/extract.js`, calls `__ojLoaderExtractSamplesInPage`, POSTs.           |
| `src/types.ts`                           | Shapes shared by the worker and the in-page bundles, and the `__ojLoader*` globals they use.          |
| `src/lib/inject-manifest.ts`             | Paths of the in-page bundles the worker injects.                                                      |
| `src/inpage/dispatch.ts`                 | Entry of `inpage/extract.js`: hostname to `extractAtcoder` / `extractCodeforces` / `extractLeetcode`. |
| `src/inpage/shared-dom.ts`               | `prePlainText` and limit parsing for AtCoder and Codeforces.                                          |
| `src/inpage/extract-atcoder.ts`          | AtCoder scraper and contest task labels.                                                              |
| `src/inpage/extract-codeforces.ts`       | Codeforces scraper and contest problem labels.                                                        |
| `src/inpage/extract-leetcode.ts`         | LeetCode scraper, clipboard and contest labels.                                                       |
| `src/inpage/submit-dispatch.ts`          | Entry of `inpage/submit.js`: judge to `submitAtcoder` / `submitCodeforces` and their verdict readers. |
| `src/inpage/submit-shared.ts`            | Language picking and same-origin page reads for the submit drivers.                                   |
| `src/inpage/submit-atcoder.ts`           | AtCoder submit and verdict.                                                                           |
| `src/inpage/submit-codeforces.ts`        | Codeforces submit and verdict.                                                                        |
| `src/lib/bridge.ts`                      | WebSocket client for OJ Runner's submit bridge, with reconnect and keepalive.                         |
| `src/lib/submit-runner.ts`               | Runs one job: parks a judge tab, calls the in-page driver, polls for the verdict.                     |
| `src/lib/build-import-payload.ts`        | Turns a scrape result into the JSON string for OJ Runner.                                             |
| `src/lib/pair-samples.ts`                | Pairs input and output `<pre>` blocks into samples.                                                   |
| `src/lib/contest-url.ts`                 | Problem labels and the supported-host check.                                                          |
| `src/lib/oj-runner-client.ts`            | `fetch` POST to localhost and the optional `vscode://` tab.                                           |
| `src/lib/settings.ts`                    | `chrome.storage.sync` defaults for import, submit and page settings.                                  |
| `src/lib/constants.ts`                   | Default URIs and the badge glyph.                                                                     |
| `src/lib/badge.ts`                       | Toolbar badge flash for success and error.                                                            |
| `src/tab-title.ts`                       | Content script: short tab titles on Codeforces and AtCoder problem pages.                             |
| `src/cf-tags.ts`                         | Content script: hides Codeforces problem tags except the rating.                                      |
| `src/options.ts` / `public/options.html` | Options page, separate from the service worker.                                                       |
| `public/manifest.json`                   | Extension manifest, copied to `dist/` as is.                                                          |
| `public/icons/icon-256.png`              | Master icon; the other `icons/icon-*.png` files are downscaled from it.                               |

To drop a judge, delete its scraper or submit driver and its branch in `dispatch.ts` or
`submit-dispatch.ts`.

The icons show white outlined documents with a check badge inside a dashed sync ring, on a
transparent background. The 16 px icon is the check badge alone, cropped from the master, since
the full drawing is unreadable at that size.

The service worker is bundled as an ES module (`"type": "module"` in the manifest). The scrapers
and submit drivers are bundled into two classic IIFE scripts, `inpage/extract.js` and
`inpage/submit.js`, which Chrome injects with `scripting.executeScript({ files })`. Each registers
its entry points on `globalThis` for the worker's serialized `func` calls.

## Build

```sh
npm install
npm run build      # tsc --noEmit, then esbuild -> dist/
npm run watch      # rebuild dist/ on change (no type-check)
npm run typecheck
```

## Load in Chrome

1. Run `npm run build`.
2. Open Chrome -> Extensions and turn on Developer mode.
3. Click Load unpacked and select the `oj-loader/dist` folder (the one with `manifest.json`).
   After a rebuild, click the reload button on the extension card.

## Options

Right-click the extension and choose Options, or open the options page from Extensions. It sets:

- The local import URL, which must end with `/import` and match OJ Runner's port.
- Whether to POST to localhost and whether to fall back to the focus URL.
- The submit bridge URL from OJ Runner: Copy Submit Bridge URL, and whether submitting through
  this browser is allowed at all.
- Short tab titles on problem pages, and hiding Codeforces tags other than the rating.

## Payload shape

The POST body is JSON that OJ Runner understands: a plain array of cases, or a wrapper
`{ problem, samples }` or `{ problems: [...] }` for multi-problem imports. The optional wrapper
field `source` is set to `oj-loader` for debugging.

A body with `clipboardText` and no cases is not an import: OJ Runner writes that string to the VS
Code clipboard and stops. The Codeforces, AtCoder and LeetCode contest pages use it for the
`contest.sh` arguments.

Codeforces and AtCoder imports also carry the problem page `url`, which OJ Runner turns into a
submit target. It is also the only thing that tells a `gym` contest from a regular one. Older
imports fall back to parsing the `problem` label.

Codeforces and AtCoder statements also give a time limit. When it is found it is sent as
`timeLimitMs` next to `samples` (per entry for multi-problem imports), and OJ Runner judges TLE
against it. The memory limit is sent the same way as `memoryLimitMb` and shown next to the time
limit. LeetCode publishes neither, so both fields are absent there.

OJ Runner's instant Run all after an import applies only when the payload resolves to one problem.

## Version

The version is in `public/manifest.json`. Bump it whenever you change this extension.

Run `npm run bump` here or in `oj-runner/` (or `make bump-oj-loader` from the repo root). It
raises the patch version in `oj-runner/package.json`, `oj-loader/package.json`,
`oj-loader/public/manifest.json` and the version line above, all to the same number. Pass `minor`,
`major` or an explicit `x.y.z` to override (`npm run bump -- minor`).
