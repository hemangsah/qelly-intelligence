# Durable reconstructed Theme Intelligence source checkpoint

This file accompanies `reconstructed-theme-intelligence-source.tar.gz.b64`.

Decode and verify:

```sh
base64 -d reconstructed-theme-intelligence-source.tar.gz.b64 > qelly-theme-final-fix-source.tar.gz
printf '8e6e68643a487075bd18cf211ac0b7c9253d8a5e88852234b43075db85712ae5  qelly-theme-final-fix-source.tar.gz\n' | sha256sum -c -
mkdir qelly-theme-final-fix && tar -xzf qelly-theme-final-fix-source.tar.gz -C qelly-theme-final-fix
```

The archive contains the complete corrective source snapshot produced after the published checkpoint `6b930614d09d9752f503bd4c4e1308923e435421`. It is preserved before long browser/workflow operations. It does not alter `main`, deploy Pages, merge PR #11 or mark it ready.
