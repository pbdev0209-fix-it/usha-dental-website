# The weekly blog agent

This repository writes its own blog. Every Wednesday morning a GitHub Action
drafts the next article from a 52-week topic calendar and opens a pull request.
Nothing appears on the live site until a human merges that pull request.

That review gate is deliberate. This is health content published under a
licensed dentist's name, and unreviewed medical writing is both a real
liability and, per Google's guidance on mass-produced content, an SEO risk.
The agent is a drafting assistant, not a publisher.

---

## Two things only you can do

The pipeline is built and tested. Two steps are left to you, because they
involve account settings and billing. Only the second one actually stops the
agent from writing.

### 1. Let Actions open pull requests

Optional. It saves you one click a week.

Without it the agent still does the whole job: writes the article, runs the
checks, rebuilds the indexes, commits, and pushes the branch. It just cannot
open the pull request on your behalf, so the run ends green with a warning and
a one-click link in the run summary (Actions -> pick the run -> "draft
summary"). Nothing is lost either way, and nothing goes live either way.

With it, the pull request appears on its own and you get an email about it.

  Settings -> Actions -> General -> Workflow permissions
  -> tick "Allow GitHub Actions to create and approve pull requests" -> Save

### 2. Add an Anthropic API key

Until this exists the agent runs in scaffold mode: it produces a correctly
structured page with placeholder prose, so you still get a reviewable PR and
know the pipeline is alive, but nobody has written the article.

Create a key at console.anthropic.com (you will need to add a payment method
there), then add it to this repository:

  Settings -> Secrets and variables -> Actions -> New repository secret
  Name:  ANTHROPIC_API_KEY
  Value: your key

Add the secret yourself. Do not paste an API key into a chat, an issue, a
commit, or any file in this repository. Secrets are write-only once saved,
which is exactly what you want.

Optionally add a repository *variable* (not a secret) called `BLOG_MODEL` to
pin a specific model. If you skip it the script uses a sensible default, and
if that model id is ever retired it asks the API which models exist and falls
back to the newest Sonnet rather than failing the week.

### What it costs

One article is a single API call of roughly 8,000 output tokens. At current
Sonnet pricing that is a few cents. Fifty-two articles a year lands in the
region of a couple of dollars. GitHub Actions minutes are free on public
repositories.

---

## The weekly routine

1. Wednesday around 8am Central, the workflow runs.
2. It picks the next topic from `content/queue.json` whose date has arrived.
3. It asks Claude to write the article, using `content/voice-guide.md` as the
   style contract.
4. It validates the draft (see below) and renders it through the shared
   article template.
5. It rebuilds `blog.html`, the three homepage cards, and `sitemap.xml`.
6. It opens a pull request titled `Draft: <article title>`.
7. **Dr. Usha reads the article.** If she is happy, merge. GitHub Pages
   redeploys within a minute or two and the article is live.
8. If she is not happy, comment on the PR, edit the file directly in the
   browser, or close it.

If a draft sits unmerged, the agent re-drafts the same topic the following
week rather than moving on. The schedule never runs ahead of review.

---

## What the automated checks catch

Every draft is scanned before it becomes a PR. Findings are listed in the PR
body, split into blockers and warnings.

Blockers:

- anything that looks like a medication dosage, e.g. a number followed by `mg`
- any dollar figure
- the wrong number of takeaways or too few FAQ entries
- a missing `h2`, or a stray `h1` that would fight the template
- an internal link pointing at an article that does not exist

Warnings:

- absolute promises: guaranteed, painless, completely safe
- filler phrases that read as machine-written, listed in the voice guide
- word count outside 1200-1800
- a missing "when to seek help" callout
- a meta description over 160 characters

The two blockers about dosages and prices are there because those are the
specific things a competitor site does that we deliberately do not. Dosing
advice attributed to a named clinician is a liability, and published prices go
stale and can contradict what the practice actually charges.

---

## Common jobs

### Run it right now instead of waiting for Wednesday

Actions -> Weekly blog draft -> Run workflow. Two options:

- **Who writes the prose**: `claude` for a real draft, `scaffold` to test the
  plumbing without spending anything.
- **Ignore the scheduled date**: takes the next queued topic even if its date
  has not arrived. Use this to get ahead.

### Add or change topics

Edit `content/queue.json`. Each entry looks like this:

    {
      "week": 14,
      "status": "queued",
      "publishOn": "2026-11-25",
      "dateLabel": "November 25, 2026",
      "slug": "sensitive-after-filling",
      "title": "Your New Filling Still Hurts. Is That Normal?",
      "category": "Symptoms",
      "keyword": "sensitive after filling",
      "img": "photo-1606811971618-4486d14f3f99",
      "alt": "A dental examination in progress",
      "angle": "Normal timeline vs the signs it needs adjusting."
    }

Reorder freely, add as many as you like, delete ones you do not want. Rules:

- `slug` must be unique and must not already exist in `/blog`.
- `category` should be one of: Symptoms, Prevention, Gum Health, Cosmetic,
  Treatments, Kids, Emergencies. Anything else still publishes but gets no
  filter chip on the blog page, and the run logs a warning.
- `angle` is the most useful field. It is the one-line brief that steers the
  writing. Be opinionated here.
- `img` is an Unsplash photo id. Check it loads before committing.

### Change how the articles are written

Edit `content/voice-guide.md`. That file is passed to the model as its system
prompt, so changing it changes every future article. It is the highest-leverage
file in the repository. The banned-phrase list there is also enforced by the
validator.

### Change the schedule

The `cron` line in `.github/workflows/weekly-blog.yml`. It is in UTC, so it
drifts by an hour when Kansas changes to and from daylight saving. GitHub also
runs scheduled jobs late when under load; this is normal and not worth chasing.

### Change how articles look

`scripts/lib/template.js` is the single source of truth for article layout,
and `assets/blog.css` for styling. Change the template and every future
article follows. Existing articles are already-rendered HTML and will not
change retroactively.

---

## The files

    content/queue.json          the 52-week topic calendar
    content/voice-guide.md      the style contract, editable, drives everything
    scripts/generate-post.js    picks a topic, calls the API, validates, writes
    scripts/update-indexes.js   rebuilds blog.html, homepage cards, sitemap
    scripts/lib/template.js     the article layout
    .github/workflows/weekly-blog.yml   the schedule and the PR step

`blog.html` and `index.html` contain marker comments:

    <!-- POSTS:START -->  ...  <!-- POSTS:END -->
    <!-- HOME_POSTS:START -->  ...  <!-- HOME_POSTS:END -->

Everything between those markers is generated. Do not hand-edit inside them,
and do not delete the markers, or the rebuild will fail loudly. Editing
anywhere else in those files is fine.

---

## Troubleshooting

**The run summary says the pull request could not be opened automatically**
Not a failure. The setting in step 1 above is not enabled. The draft is safe on
its branch; click the link in the run summary to open the pull request yourself.

**`ANTHROPIC_API_KEY is not set`**
Step 2 above. Note that secrets are not available to workflows triggered from
a fork, only from this repository.

**`The API rejected the key`**
The key was revoked, mistyped, or the account has no credit.

**`Markers POSTS not found`**
Someone deleted the marker comments from `blog.html`. Put them back around the
card grid inside `<div class="post-grid" id="postGrid">`.

**`blog/<slug>.html already exists`**
Two queue entries share a slug, or a topic was published manually. Change the
slug in the queue.

**The run says nothing was due**
Not an error. No queued topic has reached its `publishOn` date. Use the
"ignore the scheduled date" option to pull one forward.

**A run failed halfway**
Nothing was published. The generator only ever writes to a branch, and the
live site only changes on merge to `main`. Re-run the workflow.

---

## What this deliberately does not do

- It does not publish. A person merges, every time.
- It does not invent business facts. Phone numbers, hours, prices and staff
  details are never generated.
- It does not give dosages or prices.
- It does not copy from other dental practices. The articles are original,
  which matters both legally and because duplicated text loses to the older,
  more established page every time.
- It does not touch anything outside this repository.
