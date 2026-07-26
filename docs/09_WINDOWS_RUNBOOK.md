# Windows Runbook

## Requirements

Install Node.js 22 or later.

## Start

Double-click `RUN_QELLY_WINDOWS.bat`, or run:

```powershell
npm start
```

Open `http://127.0.0.1:4480`.

## Validate

Double-click `CHECK_QELLY_WINDOWS.bat`, or run:

```powershell
npm test
npm run validate
npm run smoke
```

Browser and accessibility scripts require Python, Playwright and Chromium and are optional on a basic Windows workstation.

## Runtime data

Local persisted state is written under the runtime directory. It is development data only. Do not store provider credentials, production user information, private keys or recovery phrases in this package.
