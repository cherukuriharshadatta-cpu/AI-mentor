const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const fixtures = [
      ['chatgpt', 'https://chatgpt.com/c/test', '<article data-turn="user">Build a community with file uploads.</article><article data-turn="assistant"><div class="markdown">Add upload validation.</div><button>Copy</button></article>', '<button data-testid="stop-button"></button>'],
      ['claude', 'https://claude.ai/chat/test', '<div data-testid="user-message"><div data-testid="user-message-content">Build a community with file uploads.</div></div><div class="font-claude-message"><div class="prose">Add upload validation.</div><button>Copy</button></div>', '<button aria-label="Stop response"></button>'],
      ['gemini', 'https://gemini.google.com/app/test', '<user-query><div class="query-text">Build a community with file uploads.</div><button>Edit</button></user-query><model-response><message-content>Add upload validation.</message-content><button>Copy</button></model-response>', '<div class="result-streaming"></div>']
    ];
    for (const [platform, route, html, streaming] of fixtures) {
      await page.setContent('<nav>Private sidebar text</nav><textarea>Unsent private draft</textarea><main>'+html+'</main>');
      await page.addScriptTag({path:path.join(__dirname,'../conversation.js')});
      const result = await page.evaluate(({route,streaming}) => {
        const reader = new BobConversation.Reader();
        const options = {route,enabled:true,paused:false};
        const first = reader.read(document.body,options);
        const unchanged = reader.read(document.body,options);
        const forbidden = {querySelector(){throw Error('Read without consent');},querySelectorAll(){throw Error('Read without consent');}};
        reader.read(forbidden,{...options,enabled:false});
        reader.read(forbidden,{...options,paused:true});
        document.querySelector('main').insertAdjacentHTML('beforeend',streaming);
        const pending = reader.read(document.body,options);
        document.querySelector('main').lastElementChild.remove();
        document.querySelector('main').firstElementChild.textContent = 'తెలుగులో ప్రాజెక్ట్ వివరాలు — 日本語 — مرحبا';
        const updated = reader.read(document.body,options);
        return {first,unchanged,pending,updated};
      },{route,streaming});
      assert.equal(result.first.platform,platform);
      assert.deepEqual(result.first.messages.map(m=>m.role),['user','assistant']);
      assert.deepEqual(result.first.messages.map(m=>m.text),['Build a community with file uploads.','Add upload validation.']);
      assert.equal(result.unchanged.changed,false);
      assert.equal(result.pending.streaming,true);
      assert.equal(result.updated.changed,true);
      assert.equal(result.updated.messages[0].text,'తెలుగులో ప్రాజెక్ట్ వివరాలు — 日本語 — مرحبا');
    }
    const spoof = await page.evaluate(()=>BobConversation.adapterFor('https://claude.ai.evil.example/chat').id);
    assert.equal(spoof,'generic');
    console.log('Platform fixtures passed: ChatGPT, Claude, Gemini; ordering, content boundaries, Unicode, streaming, consent and pause.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
