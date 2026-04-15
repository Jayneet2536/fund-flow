const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('CONSOLE>', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR>', err.message));
  page.on('requestfailed', req => console.log('REQUESTFAILED>', req.url(), req.failure()?.errorText));

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  console.log('URL', page.url());
  const html = await page.content();
  console.log('BODY START', html.slice(0, 500));

  await browser.close();
})();
