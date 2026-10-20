(function(root){
  'use strict';
  // Order the next work by capability and stage, not a completion percentage.
  function prioritize(requirements,model){
    const priorities={'core':8,'agent-tools':4,'secrets':4,'game-sandbox':5,'uploads':6,'payments':7,'auth':7,'authorization':9,'game':10,'device':12,'network':13,'data':14,'privacy':15,'permissions':15,'saves':16,'ai-evals':18,'operations':22,'release':30,'accessibility':35,'tests':40};
    return [...requirements].sort((a,b)=>{
      const score=r=>(r.status==='not-applicable'?1000:['verified','reported-complete'].includes(r.status)?500:0)+(model?.progress.stage==='production'&&r.id==='operations'?3:priorities[r.id]||25);
      return score(a)-score(b);
    });
  }
  root.BobReadiness={prioritize};if(typeof module!=='undefined')module.exports=root.BobReadiness;
})(typeof window!=='undefined'?window:globalThis);
