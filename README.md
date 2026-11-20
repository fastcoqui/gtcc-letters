# GTCC Delinquency Letters

Browser-only letters and email drafts for Military Intelligence Readiness Command Government Travel Charge Card delinquencies.

The workbook is read on your computer. Nothing in the report is uploaded, and the page never sends mail. It downloads a Word memorandum and a draft `.eml` (with the memorandum attached) for each delinquent cardholder. You review and send those drafts yourself.

## Use

1. Open the site and, if you want to try it first, click **Load sample data**. The sample names and emails are fake.
2. Drop the monthly `.xlsx`. The tool finds columns by header name on `IBA and CBA Delinquency Report` and `Traveler and DTA Contacts`. If contacts are in a second file, drop that file too. The contacts header is the row that contains **Email Address**.
3. Check the list. Type a rank or email when the match is wrong. Rows flagged for review are highlighted.
4. Open **Settings** and fill the signature block, POC, APC, office symbol, and suspense days. Blank fields show up as highlighted placeholders in the letter.
5. Click **Generate letters and email drafts**. The zip is grouped by BDE. A row's **Draft** button downloads just that `.eml`. **Mailto** opens a message without the attachment.
6. After you send a draft, tick **Emailed**. Export the tracker (`.xlsx` or `.csv`) if you want a copy outside the browser.

The SSN column is never read. Only the last four digits of the account number are kept, and account numbers are read as text so a 16-digit value is not rounded. DTS rank and GOVCC numbers are not treated as the system of record: the report's aging buckets drive the letter, and rank stays editable.

## Dashboard

The second tab shows cardholders, delinquent dollars, open balance, suspended accounts, closed accounts that still have a balance, match rate, open balance by BDE, delinquent dollars by aging bucket, and a BDE ranking from worst to best.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds the site and deploys `dist` on every push to `main`. Pull requests run the tests and the build only.

Before the first deploy, set the repository Pages source to **GitHub Actions**:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

The published URL is `https://fastcoqui.github.io/gtcc-letters/`.

## Tests

```bash
npm ci
npm test
npm run build
```

## Logic notes

The category, name match, DTA prefix walk, suspense date, and draft text follow `modGTCC.bas`.

- A cardholder is delinquent when any of the 30/60/90/120/150/180+ buckets is over half a cent. The category is the oldest of those buckets. 120, 150, and 180+ are all category `120+`. The subject uses that category (so `120+` prints as 120-day). The "days delinquent" line still shows the oldest bucket, and adds "(120+ category)" when that bucket is 150 or 180+.
- Email match is last name + first name, then middle initial, then brigade org, then unit org. Ambiguous and unmatched rows stay editable.
- DTAs are Permission Level 5 at the cardholder's org, or at the longest parent org code present in the contacts file (`DA240ARC99DMRC259` is the parent of `DA240ARC99DMRC259301` when both appear).
- Suspense is the letter date plus the configured business days, skipping weekends and the holiday list.
- A new report as-of date appends tracker rows and marks the previous rows Superseded. Prior letter count is how many earlier cycles already have a letter date.

Two pieces of the old workbook were not in the uploaded files:

- The Lists-sheet unit-name to DTS-org crosswalk. Paste it under Settings (`Unit name = suffix`). The sample button uses a fake crosswalk and does not save it.
- The Lists-sheet paygrade-to-rank table. The page uses a standard Army paygrade map and flags ambiguous grades (E4, E8, E9). If DTS already stores a rank abbreviation, that abbreviation is used.

The attached memorandum is the MIRC headquarters detachment layout. It had no separate signature block and no merge tokens; the signature block is a setting, and empty settings render as highlighted placeholders. The original Word file's document properties contained personal names and were not copied into this repo.
