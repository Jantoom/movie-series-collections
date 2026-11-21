# Setting up Cloudflare and GitHub Actions

About 10 minutes. GitHub Actions builds the addon every week and deploys it to a Cloudflare Worker on a subdomain of your own domain. Cloudflare's free Workers plan is plenty: the built files are served as static assets, which don't count towards its 100,000 requests a day, and the Worker itself only runs for a show's streams.

You need a domain on Cloudflare (its DNS managed by Cloudflare) and the repo on GitHub, with the code on `main`. The repo can be private.

## 1. Pick the addon's address

In `wrangler.jsonc`, replace `collections.example.com` with a subdomain of your domain, such as `collections.yourdomain.com`. The subdomain must not already have a DNS record: Cloudflare creates the record and its certificate on the first deploy.

## 2. Make a Cloudflare API token

1. In the Cloudflare dashboard, open **My Profile → API Tokens** and click **Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Under **Account Resources**, pick your account. Under **Zone Resources**, pick **Specific zone** and your domain.
4. Click **Continue to summary**, then **Create Token**, and copy the token. Cloudflare only shows it once.

Also copy your **Account ID**: it's on the right of your domain's **Overview** page, or under **Workers & Pages**.

## 3. Add them to GitHub

In the repo on GitHub, go to **Settings → Secrets and variables → Actions** and add two **repository secrets**:

- `CLOUDFLARE_API_TOKEN`: the token.
- `CLOUDFLARE_ACCOUNT_ID`: the account ID.

## 4. Run the first deploy

Push the change to `wrangler.jsonc`; that starts the workflow. Or go to **Actions → Build and deploy collections → Run workflow**. It takes a couple of minutes, and its one job, **deploy**, should get a green tick. The certificate for a new subdomain can take a few more minutes to be issued.

## 5. Install in Stremio

1. Open `https://<your subdomain>/`.
2. Click **Install in Stremio**, or paste the `manifest.json` link from that page into Stremio's addon search box. If you had the GitHub Pages version installed, uninstall it first.
3. Install it after your stream addons, so its **Collection** links come after their streams.
4. In Stremio, go to **Discover → Collections**, and work through the checklist in [README.md](README.md#what-to-check-on-each-device).

## Afterwards

- The workflow runs by itself every Monday at 4:17am Brisbane time to pick up new seasons and artwork from Cinemeta. It also runs whenever you push a change to the config or code.
- **If a run fails** (red cross), click it, then click the failed step to see why. The usual causes are Cinemeta being briefly unreachable, or an IMDb id in `collections.config.mjs` that is wrong or not on Cinemeta yet (the error names it). Your installed addon keeps working because a failed build never replaces the last good one. Re-run it later with **Re-run jobs**.
- GitHub pauses scheduled workflows on a repo with no activity for 60 days and emails you first. Re-enable it from the Actions tab, or push any small change.
- To see how much the Worker runs, open **Workers & Pages → movie-series-collections → Metrics** in the Cloudflare dashboard.
