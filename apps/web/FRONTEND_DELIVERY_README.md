# Qelly Intelligence Frontend Source

This archive contains the real modular frontend used by the Qelly Node.js application. The interface is API-connected and depends on the full-stack server for secure cookies, authentication, persistence, jobs, streams and governed mutations.

Run from the full repository:

```bash
cp .env.example .env
npm ci --ignore-scripts
npm run check
npm run serve
```

Open `http://127.0.0.1:4480`.

The separate offline review HTML is a visual evidence browser and is not a substitute for the backend.
