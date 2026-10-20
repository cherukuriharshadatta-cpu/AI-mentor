/* Only redacted derived facts and progress are persisted, never raw chat messages. */
(function(root){
  'use strict';
  class Store {
    constructor(storage){this.storage=storage;this.queue=Promise.resolve();}
    key(route){return 'bob.project:'+route;}
    async load(route){const k=this.key(route);return (await this.storage.get(k))[k]||null;}
    save(route,model,status,signature){
      const snapshot=JSON.parse(JSON.stringify({model,status,signature,savedAt:Date.now()}));
      this.queue=this.queue.catch(()=>{}).then(async()=>{
        const k=this.key(route);await this.storage.set({[k]:snapshot});
        const all=await this.storage.get(null);
        const old=Object.entries(all).filter(([key])=>key.startsWith('bob.project:')).sort((a,b)=>(b[1].savedAt||0)-(a[1].savedAt||0)).slice(30).map(([key])=>key);
        if(old.length)await this.storage.remove(old);
      });return this.queue;
    }
    async clear(){await this.queue.catch(()=>{});const all=await this.storage.get(null);await this.storage.remove(Object.keys(all).filter(k=>k.startsWith('bob.project:')));}
  }
  root.BobProjectStore={Store};if(typeof module!=='undefined')module.exports=root.BobProjectStore;
})(typeof window!=='undefined'?window:globalThis);
