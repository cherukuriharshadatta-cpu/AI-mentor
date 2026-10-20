(function(root){
  'use strict';
  const STATES=['not-started','in-progress','reported-complete','verified','not-applicable'];
  function transition(state,evidence=null){
    if(!STATES.includes(state))throw new Error('Unknown progress state.');
    if(state==='verified'&&(!evidence?.reviewed||!evidence?.scope?.trim()||!evidence?.reference?.trim()))
      throw new Error('Verification needs a reviewed evidence reference and an explicit test scope.');
    return {state,evidence:state==='verified'?{reviewed:true,scope:String(evidence.scope).slice(0,500),reference:String(evidence.reference).slice(0,1000),method:'user-reviewed evidence'}:null,updatedAt:new Date().toISOString()};
  }
  root.BobVerification={STATES,transition};if(typeof module!=='undefined')module.exports=root.BobVerification;
})(typeof window!=='undefined'?window:globalThis);
