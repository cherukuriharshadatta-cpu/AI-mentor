const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8');
async function run(events,request={models:['provider/model'],messages:[{role:'user',content:'hello'}],key:'test'}){
 let connect,handler,disconnect,calls=0;const sent=[];
 const chrome={runtime:{id:'bob',onConnect:{addListener:f=>connect=f}}};
 vm.runInNewContext(source,{chrome,setTimeout,clearTimeout,AbortController,TextDecoder,fetch:async()=>{calls++;return {ok:true,status:200,body:{getReader:()=>({read:async()=>events.length?{done:false,value:new TextEncoder().encode(events.shift())}:{done:true},cancel:async()=>{}})}};}});
 connect({name:'bob',sender:{id:'bob'},onDisconnect:{addListener:f=>disconnect=f},onMessage:{addListener:f=>handler=f},postMessage:m=>sent.push(m)});
 await handler(request);return{sent,calls,disconnect};
}
(async()=>{
 const result=await run(['data: {"choices":[{"delta":{"content":"one"}}]}\n','data: {"choices":[{"delta":{"content":"two"}}]}']);assert.equal(result.sent.filter(m=>m.chunk).map(m=>m.chunk).join(''),'onetwo');assert(result.sent.at(-1).done);
 assert.equal((await run([],{models:['x'],messages:[{role:'system',content:'x'.repeat(19000)}],key:'k'})).calls,0);
 const failed=await run(['data: {"choices":[{"delta":{"content":"part"}}]}\n','data: {"error":{"message":"provider broke"}}\n'],{models:['a','b'],messages:[{role:'user',content:'test'}],key:'test'});assert.equal(failed.calls,1);assert(failed.sent.at(-1).error);
 console.log('Provider transport validates size, final SSE frames, and no retry after partial output');
})().catch(e=>{console.error(e);process.exit(1);});
