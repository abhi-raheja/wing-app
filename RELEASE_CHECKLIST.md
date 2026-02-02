# Wing Release Checklist (Chrome)

## Pre‑Release
1. **Version bump** in `manifest.json` and `package.json` (if needed).
2. **Run tests**
   - `npm test`
   - `npm run test:integration`
3. **Manual QA**
   - Sections 8, 9, 12, 14 from `TESTING_CHECKLIST.md`
   - Confirm offline winging behavior
4. **Privacy & Compliance**
   - `PRIVACY_POLICY.md` reviewed
   - Permission justifications ready
5. **Assets**
   - Screenshots captured
   - Promo tile + marquee (optional)

## Packaging
1. Create a clean zip excluding dev files:
   - Exclude: `node_modules/`, `tests/`, `mocks/`, `scripts/`, `*.md` (except privacy policy if needed)
2. Verify zip contents load via `chrome://extensions` → “Load unpacked”

## Chrome Web Store Submission
1. Fill out listing fields using `STORE_LISTING.md`
2. Upload zip
3. Upload screenshots and assets
4. Provide privacy policy URL (link to hosted `PRIVACY_POLICY.md`)
5. Submit for review

## Post‑Release
1. Monitor reviews/feedback
2. Triage bugs and prioritize fixes
