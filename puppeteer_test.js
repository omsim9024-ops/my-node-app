const puppeteer = require('puppeteer');
(async() => {
  try{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/admin-dashboard.html',{waitUntil:'networkidle2'});
    await page.waitForTimeout(2000);
    const stats = await page.evaluate(()=>{
      return {
        total: document.getElementById('totalStudents')?.textContent,
        pending: document.getElementById('pendingEnrollments')?.textContent,
        approved: document.getElementById('approvedEnrollments')?.textContent,
        rejected: document.getElementById('rejectedEnrollments')?.textContent
      };
    });
    console.log('stats',stats);
    await browser.close();
  }catch(e){console.error('puppeteer error',e);}  
})();
