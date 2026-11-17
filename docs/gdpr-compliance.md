# ReqMate GDPR Compliance

## Overview

ReqMate is **GDPR compliant by design**. As a local-first application that collects zero data by default, ReqMate inherently satisfies the core GDPR principles.

## Data Processing

### Data Controller

ReqMate contributors are not data controllers for your API data. All collections, environments, requests, and responses are stored locally on your machine. We have no access to this data.

### Data Processed

| Data | Processed By ReqMate? | Stored Where |
|------|----------------------|--------------|
| Collections/Requests | Locally only | Your filesystem (YAML) |
| Environments/Secrets | Locally only | Your filesystem (.env) |
| Request History | Locally only | SQLite at ~/.reqmate/data.db |
| Settings | Locally only | JSON at ~/.reqmate/settings.json |
| Crash Reports (opt-in) | Locally stored; optionally transmitted | ~/.reqmate/crash-reports/ |
### Lawful Basis

- **Crash reports**: Consent (opt-in, default off)
- **All other data**: Not applicable (no data leaves the machine)

## GDPR Rights

### Right to Access (Article 15)

All your data is stored locally in human-readable formats. You can inspect it at any time:
- Collections: YAML files in your chosen directories
- History: SQLite database (use any SQLite client)
- Settings: JSON file
- Crash reports: JSON files in ~/.reqmate/crash-reports/

### Right to Erasure (Article 17)

Delete `~/.reqmate/` and your collection directories. All data is permanently removed. No server-side data exists to delete (unless you opted into crash reports).

### Right to Data Portability (Article 20)

All data is stored in standard, open formats:
- YAML for collections and environments
- SQLite for history
- JSON for settings
- Standard `.env` for secrets

No proprietary formats. No vendor lock-in.

### Right to Rectification (Article 16)

Edit any file directly — they're standard text formats.

### Right to Restrict Processing (Article 18)

ReqMate does not process your data remotely. To restrict local processing, simply close the application.

### Right to Object (Article 21)

Disable crash reports in Settings. No other data processing to object to.

## Data Protection Officer

Not required — ReqMate does not systematically process personal data at scale.

## Data Protection Impact Assessment

Not required — ReqMate's local-first architecture means no personal data crosses organizational boundaries.

## Sub-Processors

None. ReqMate uses no cloud services, no analytics providers, and no third-party SDKs that process user data.

## International Transfers

No user data is transferred internationally. License validation server is hosted in the EU.

## Breach Notification

In the unlikely event of a security breach, we will notify affected users within 72 hours via our GitHub repository.

## Contact

Data protection inquiries: privacy@reqmate.dev
