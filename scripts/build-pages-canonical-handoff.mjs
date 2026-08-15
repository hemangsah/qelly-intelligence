import {mkdir,writeFile} from 'node:fs/promises';

const outputDir=new URL('../dist/pages-canonical/',import.meta.url);
const canonicalTerminal='https://qelly-intelligence.pages.dev/';

const document=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta http-equiv="refresh" content="0;url=${canonicalTerminal}">
  <link rel="canonical" href="${canonicalTerminal}">
  <title>Qelly Intelligence — Canonical Terminal</title>
  <style>
    :root{color-scheme:dark;background:#090a0c;color:#f5f5f2;font-family:Arial,sans-serif}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#090a0c,#111318)}
    main{width:min(620px,100%);border:1px solid #2a2d33;border-radius:10px;background:#0e1013;padding:30px;box-shadow:0 22px 70px rgba(0,0,0,.36)}
    small{display:block;margin-bottom:10px;color:#9ca3af;letter-spacing:.12em;text-transform:uppercase}h1{margin:0 0 12px;font-size:28px;line-height:1.1}p{margin:0 0 20px;color:#c7cbd1;line-height:1.55}
    a{display:inline-flex;align-items:center;min-height:42px;padding:0 16px;border:1px solid #4b515b;border-radius:7px;color:#fff;text-decoration:none;background:#171a1f}a:focus-visible{outline:2px solid #fff;outline-offset:3px}
  </style>
</head>
<body>
  <main>
    <small>Canonical production runtime</small>
    <h1>Qelly Intelligence</h1>
    <p>GitHub Pages is a repository handoff, not a second terminal runtime. Opening the canonical Cloudflare deployment now.</p>
    <a href="${canonicalTerminal}">Open Qelly Intelligence terminal</a>
  </main>
  <script>
    (()=>{
      const canonical=${JSON.stringify(canonicalTerminal)};
      const suffix=window.location.search+window.location.hash;
      window.location.replace(canonical+suffix);
    })();
  </script>
</body>
</html>\n`;

await mkdir(outputDir,{recursive:true});
await Promise.all([
  writeFile(new URL('index.html',outputDir),document,'utf8'),
  writeFile(new URL('404.html',outputDir),document,'utf8')
]);
console.log(`GitHub Pages canonical handoff prepared for ${canonicalTerminal}`);
