const assert=require('node:assert/strict');
const {Reader}=require('../conversation'),{Store}=require('../project-store');
(async()=>{
 let reads=0;const node={textContent:'Build a website.',getAttribute:()=> 'message1'};
 const container={querySelector:()=>null,querySelectorAll:()=>{reads++;return[node];}};
 const reader=new Reader();const options={route:'/a',enabled:false,paused:false,userSelectors:['u'],assistantSelectors:[]};
 reader.read(container,options);assert.equal(reads,0);
 options.enabled=true;options.paused=true;reader.read(container,options);assert.equal(reads,0);
 options.paused=false;const first=reader.read(container,options);assert(first.changed);assert.equal(reader.totalParsed,1);
 assert(!reader.read(container,options).changed);assert.equal(reader.totalParsed,1);
 node.textContent+=' Add payments.';assert(reader.read(container,options).changed);assert.equal(reader.totalParsed,2);
 const streaming={...container,querySelector:()=>({})};assert(reader.read(streaming,options).streaming);
 const data={};const storage={get:async k=>k===null?data:{[k]:data[k]},set:async x=>Object.assign(data,x),remove:async keys=>keys.forEach(k=>delete data[k])};const store=new Store(storage);
 await store.save('/a',{identity:{description:{value:'website'}}},{tests:{state:'reported-complete'}},'a');
 assert.equal((await store.load('/a')).status.tests.state,'reported-complete');assert.equal(await store.load('/b'),null);
 for(let i=0;i<33;i++)await store.save('/'+i,{identity:{}},{},String(i));assert(Object.keys(data).length<=30);
 await store.clear();assert.equal(Object.keys(data).length,0);
 console.log('Observer consent, caching, streaming, and project storage tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
