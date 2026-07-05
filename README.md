# Lam Nguyen — GitHub Pages Profile Website

This repository contains the GitHub Pages-ready profile website for **Tran Thanh Lam Nguyen**.

Configured target GitHub account:

```text
https://github.com/lamnguyentt92
```

Configured public website URL:

```text
https://lamnguyentt92.github.io/
```

The site is static HTML/CSS/JavaScript. Python is **not** executed by GitHub Pages at visitor runtime. Python scripts run automatically through **GitHub Actions**, update cached JSON files, and then redeploy the static site.

---

## 1. Source code structure

```text
.
├── index.html                         # Main website page
├── 404.html                           # GitHub Pages 404 page
├── .nojekyll                          # Disable Jekyll processing for plain static files
├── robots.txt                         # Search engine crawler configuration
├── sitemap.xml                        # Sitemap for https://lamnguyentt92.github.io/
├── CNAME.example                      # Template for a custom domain
├── requirements.txt                   # Python dependencies for ranking update scripts
├── assets/
│   ├── css/style.css                  # Site styling
│   ├── js/main.js                     # Dynamic rendering of profile/publications/rankings
│   └── docs/
│       ├── Lam_Nguyen_CV_Academic.pdf
│       └── Lam_Nguyen_CV_Industry.pdf
├── data/
│   ├── site-data.json                 # Profile, CV, skills, projects, and publications
│   └── rankings.json                  # Cached conference/journal rankings displayed on site
├── scripts/
│   ├── update_ranks.py                # CORE/ICORE + SCImago ranking updater
│   └── update_scholar_serpapi.py      # Optional Google Scholar metadata updater via SerpAPI
└── .github/workflows/
    ├── deploy-site.yml                # Deploy static site to GitHub Pages
    ├── update-rankings.yml            # Scheduled ranking update + deploy
    └── update-scholar.yml             # Optional Scholar update + deploy
```

---

## 2. Local preview on Windows

Open PowerShell in the project folder, where `index.html` is located.

```powershell
cd C:\Users\ASUS\Downloads\lamnguyentt92.github.io
py -3.11 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Do **not** open `index.html` directly with `file://`, because the website loads JSON files from `data/site-data.json` and `data/rankings.json`.

---

## 3. Edit website content

Most website content is in:

```text
data/site-data.json
```

Important blocks:

```text
profile       name, title, emails, affiliation, links, interests, biography
research      research-theme cards
projects      WearPri, EBPS, RootFlow, MetaLeak, ALIBIS, PrivacyAssist
experience    academic and industrial timeline
education     degree timeline
skills        technical skills
publications  publication records
```

The GitHub profile link is already configured as:

```json
{"label": "GitHub", "url": "https://github.com/lamnguyentt92"}
```

For each publication, this field connects the publication to the ranking cache:

```json
"venue_key": "wisec"
```

The matching ranking is stored in:

```text
data/rankings.json
```

---

## 4. How automatic ranking updates work

The website displays cached rankings from:

```text
data/rankings.json
```

The Python updater is:

```text
scripts/update_ranks.py
```

The GitHub Action is:

```text
.github/workflows/update-rankings.yml
```

Flow:

```text
GitHub Actions schedule/manual run
        ↓
python scripts/update_ranks.py
        ↓
update data/rankings.json
        ↓
commit updated JSON to main
        ↓
deploy GitHub Pages again
        ↓
website shows updated ranks
```

Conference ranks are fetched best-effort from CORE/ICORE. CORE uses `A*`, `A`, `B`, and `C`; the website displays `D / Unranked` only when no rank is found.

Journal quartiles are fetched best-effort from SCImago pages. SCImago does not provide a stable public API, so keep manually verified fallback values in `data/rankings.json`.

---

## 5. Test ranking update locally

```powershell
cd C:\Users\ASUS\Downloads\lamnguyentt92.github.io
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python scripts/update_ranks.py --data data/site-data.json --out data/rankings.json
```

If PowerShell blocks venv activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\activate
```

Then preview again:

```powershell
py -3.11 -m http.server 8000
```

---

## 6. Create the GitHub.io repository

Create a new repository under your account:

```text
https://github.com/lamnguyentt92
```

Repository name must be exactly:

```text
lamnguyentt92.github.io
```

Use:

```text
Public
```

Do not add a README/license/gitignore from GitHub if you will push this source from your computer.

---

## 7. Upload the website source to GitHub

From the folder that directly contains `index.html`:

```powershell
cd C:\Users\ASUS\Downloads\lamnguyentt92.github.io
git init
git add .
git commit -m "Initial personal website"
git branch -M main
git remote add origin https://github.com/lamnguyentt92/lamnguyentt92.github.io.git
git push -u origin main
```

If Git asks you to log in, use GitHub browser login or a Personal Access Token.

Correct repository structure on GitHub:

```text
lamnguyentt92.github.io/
├── index.html
├── 404.html
├── assets/
├── data/
├── scripts/
└── .github/
    └── workflows/
```

Incorrect structure:

```text
lamnguyentt92.github.io/
└── lamnguyentt92.github.io/
    └── index.html
```

---

## 8. Enable GitHub Pages deployment through GitHub Actions

In the repository:

```text
Settings → Pages
```

Under **Build and deployment**:

```text
Source: GitHub Actions
```

This source is recommended for this project because the ranking updater commits JSON files and then redeploys the site inside the same workflow.

After the first push, the workflow below should run automatically:

```text
Actions → Deploy website to GitHub Pages
```

When it succeeds, open:

```text
https://lamnguyentt92.github.io/
```

---

## 9. Enable GitHub Actions write permission

The ranking workflow needs permission to commit updates to `data/rankings.json`.

Go to:

```text
Settings → Actions → General → Workflow permissions
```

Select:

```text
Read and write permissions
```

Then save.

The workflow files already contain the required YAML permissions:

```yaml
permissions:
  contents: write
  pages: write
  id-token: write
```

---

## 10. Run the ranking update manually

Go to:

```text
Actions → Update rankings and deploy website → Run workflow
```

Select:

```text
Branch: main
```

Click:

```text
Run workflow
```

Expected result:

```text
1. Python runs scripts/update_ranks.py
2. data/rankings.json is updated or left unchanged
3. If changed, the workflow commits the update
4. The site is redeployed to GitHub Pages
```

The workflow also runs automatically every Monday at 06:00 UTC:

```yaml
schedule:
  - cron: "0 6 * * 1"
```

---

## 11. Optional Google Scholar update through SerpAPI

Direct Google Scholar scraping is often blocked. This project therefore includes an optional SerpAPI-based updater:

```text
scripts/update_scholar_serpapi.py
.github/workflows/update-scholar.yml
```

To enable it:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Create:

```text
Name: SERPAPI_API_KEY
Value: your_serpapi_key_here
```

Then run:

```text
Actions → Optional update Google Scholar metadata and deploy website → Run workflow
```

If `SERPAPI_API_KEY` is not configured, the workflow safely skips Scholar update.

---

## 12. Common errors

### Website shows 404

Check:

```text
Settings → Pages → Source: GitHub Actions
```

Also confirm `index.html` is at repository root.

### Actions tab does not show workflows

Make sure these files exist on the `main` branch:

```text
.github/workflows/deploy-site.yml
.github/workflows/update-rankings.yml
.github/workflows/update-scholar.yml
```

### Ranking Action fails at git push

Enable:

```text
Settings → Actions → General → Workflow permissions → Read and write permissions
```

### Website updates locally but not online

Run:

```text
Actions → Deploy website to GitHub Pages → Run workflow
```

### Ranking values look outdated

The ranking update is best-effort. CORE/SCImago may change page format or block requests. In that case, edit fallback values manually in:

```text
data/rankings.json
```

Then commit and push:

```powershell
git add data/rankings.json
git commit -m "Manually update ranking cache"
git push
```

---

## 13. Update workflow summary

| Workflow | Purpose | Trigger |
|---|---|---|
| `deploy-site.yml` | Deploy website to `https://lamnguyentt92.github.io/` | Every push to `main`, or manual run |
| `update-rankings.yml` | Update conference/journal ranks and redeploy | Every Monday 06:00 UTC, or manual run |
| `update-scholar.yml` | Optional Scholar metadata update and redeploy | Monthly, or manual run |
