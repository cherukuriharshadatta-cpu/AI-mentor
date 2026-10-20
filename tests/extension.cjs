const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 // Load the real MV3 extension against a locally fulfilled ChatGPT fixture.
 const extensionRoot=path.resolve(__dirname,'..');
 const profile=fs.mkdtempSync(require('node:os').tmpdir()+'/bob-browser-');
 const extension=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',args:['--no-sandbox','--disable-extensions-except='+extensionRoot,'--load-extension='+extensionRoot]});
 await extension.route('https://chatgpt.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><main><div data-message-author-role="user">Build an offline strategy game for PC.</div></main></body></html>'}));
 const real=await extension.newPage();const realErrors=[];real.on('pageerror',e=>realErrors.push(e.message));await real.goto('https://chatgpt.com/c/bob-fixture');
 const bob=real.locator('#bob-host');await bob.locator('#bubble').click();await bob.locator('#monitorBar [data-act=enable]').click();await real.waitForFunction(() => document.querySelector('#bob-host')?.shadowRoot?.querySelector('#msgs')?.textContent?.includes('strategy game'), null, {timeout:10000}).catch(async error => {
   const messages=await bob.locator('#msgs').innerText().catch(e=>'UNAVAILABLE: '+e.message);
   const details=await bob.locator('#body').innerText().catch(()=>'');
   const status=await bob.locator('#monitorBar').innerText().catch(()=>'');
   throw new Error('Initial MV3 briefing missing: '+error.message+'\\nMONITOR: '+status+'\\nCHAT: '+messages.slice(0,1300)+'\\nDETAILS: '+details.slice(0,800)+'\\nPAGE ERRORS: '+realErrors.join('; '));
 });
 assert.equal(realErrors.length,0,realErrors.join('\n'));
 await real.reload();await bob.locator('#bubble').click();
 await real.waitForFunction(() => document.querySelector('#bob-host')?.shadowRoot?.querySelector('#msgs')?.textContent?.includes('strategy game'),null,{timeout:10000});
 await extension.close();fs.rmSync(profile,{recursive:true,force:true});
 console.log('Real MV3 extension injection, storage and refresh recovery passed on the fixture.');
})().catch(e=>{console.error(e);process.exit(1);});
