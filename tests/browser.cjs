const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://bob.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><main><div data-message-author-role="user">Build a pixel-art strategy game for PC and mobile. Single-player, offline, no budget.</div><div data-message-author-role="assistant">I will build a prototype. Optional: we could add login and payments.</div></main></body></html>'}));
 await page.goto('http://bob.test/c/game');
 await page.evaluate(()=>{
  const data={};window.__storage=data;window.__network=[];
  window.chrome={runtime:{id:'bob-test'},storage:{local:{get:async k=>k===null?{...data}:typeof k==='string'?{[k]:data[k]}:Object.fromEntries(k.map(x=>[x,data[x]])),set:async value=>Object.assign(data,value),remove:async keys=>(Array.isArray(keys)?keys:[keys]).forEach(k=>delete data[k])}}};
 });
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.json')));
 for(const file of manifest.content_scripts[1].js){
  if(file==='bob.js')await page.evaluate(()=>{window.BobBridge={alive:()=>true,loadPrefs:async()=>({}),savePref:async()=>{},clearPrefs:async()=>{},stream:async function* (args){window.__network.push(args);yield 'not JSON';}};});
  await page.addScriptTag({path:path.join(__dirname,'..',file)});
 }
 const host=page.locator('#bob-host');
 await host.locator('#bubble').click();
 assert.equal(await host.locator('#msgs').innerText().then(t=>t.includes('gameplay')),false);
 await host.locator('#monitorBar [data-act=enable]').click();
 await page.waitForTimeout(700);
 
 assert.equal(errors.length,0);
 assert((await host.locator('#msgs').innerText()).includes('game'));
 assert.equal(await page.evaluate(()=>window.__network.length),0);
 const count=await host.locator('#msgs .row').count();
 await page.evaluate(()=>{const n=document.createElement('p');n.textContent='Unrelated visual update';document.querySelector('main').appendChild(n);});
 await page.waitForTimeout(2300);assert.equal(await host.locator('#msgs .row').count(),count);
 await host.locator('[data-act=tab][data-tab=check]').click();
 const details=await host.locator('#body').innerText();assert(!details.includes('Verify payment outcomes'));assert(details.includes('What needs attention'));
 await host.locator('#body details.card').filter({hasText:'Finish the main user journey'}).locator('summary').first().click();
 const card=host.locator('#body details.card').filter({hasText:'Finish the main user journey'});
 await card.locator('[data-status=reported-complete]').click();
 assert((await host.locator('#body').innerText()).includes('Completed or reported complete'));
 await host.locator('[data-act=tab][data-tab=chat]').click();
 await page.evaluate(()=>{const n=document.createElement('div');n.dataset.messageAuthorRole='user';n.textContent='Add login accounts.';document.querySelector('main').appendChild(n);});
 await page.waitForTimeout(2300);assert((await host.locator('#msgs').innerText()).includes('Protect accounts'));
 // Simulate streaming: no recommendation until generation stops.
 const before=await host.locator('#msgs .row').count();
 await page.evaluate(()=>{document.querySelector('main').insertAdjacentHTML('beforeend','<button data-testid="stop-button">Stop</button><div data-message-author-role="user">Add payments.</div>');});
 await page.waitForTimeout(2300);assert.equal(await host.locator('#msgs .row').count(),before);
 await page.evaluate(()=>document.querySelector('[data-testid="stop-button"]').remove());
 await page.waitForTimeout(2300);assert((await host.locator('#msgs').innerText()).includes('Verify payment'));
 // Long prior messages: preserve scroll on an actual feature change.
 await page.evaluate(()=>{const r=document.querySelector('#bob-host').shadowRoot;const v=r.getElementById('chatView');v.scrollTop=0;});
 await page.evaluate(()=>{document.querySelector('main').insertAdjacentHTML('beforeend','<div data-message-author-role="user">Remove login.</div>');});
 await page.waitForTimeout(2300);assert.equal(await host.locator('#chatView').evaluate(el=>el.scrollTop),0);assert(await host.locator('#newMessages').isVisible());
 // Pause must prevent DOM content reads and updates.
 await host.locator('#monitorBar [data-act=pause]').click();const pausedCount=await host.locator('#msgs .row').count();
 await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<div data-message-author-role="user">Add file uploads.</div>'));
 await page.waitForTimeout(2300);assert.equal(await host.locator('#msgs .row').count(),pausedCount);
 await host.locator('#monitorBar [data-act=resume]').click();await page.waitForTimeout(700);assert((await host.locator('#msgs').innerText()).includes('Validate submitted files'));
 await host.locator('[data-act=reviewpreview]').click();assert.equal(await page.evaluate(()=>window.__network.length),0);
 await host.locator('[data-act=gear]').click(); await host.locator('#key').fill('fake-test-key'); await host.locator('[data-act=gear]').click();
 await host.locator('[data-act=reviewsend]').click();await page.waitForTimeout(100);assert((await host.locator('#msgs').innerText()).includes('invalid JSON'));assert.equal(await page.evaluate(()=>window.__network.length),1);
 // Route isolation and empty page must not retain old chat guidance.
 await page.evaluate(()=>{history.pushState({},'', '/c/new');document.querySelector('main').innerHTML='<div data-message-author-role="user">Create a static portfolio website.</div>';});
 await page.waitForTimeout(2300);assert(!(await host.locator('#msgs').innerText()).includes('payments'));
 await host.locator('[data-act=gear]').click();
 await host.locator('[data-act=size][data-w="600"]').click();assert.equal(await host.locator('#panel').evaluate(el=>parseInt(el.style.width)),600);
 await page.setViewportSize({width:360,height:640});await page.waitForTimeout(100);assert(await host.locator('#panel').evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth));
 assert.equal(errors.length,0,errors.join('\n'));
 await page.screenshot({path:'/tmp/bob-mentor-ui.png'});
 console.log('Browser integration passed: consent, automatic briefings, no duplicate updates, streaming, scroll, pause, model failure, route isolation, sizing.');
 await browser.close();

})().catch(e=>{console.error(e);process.exit(1);});
