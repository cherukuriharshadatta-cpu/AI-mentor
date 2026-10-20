/* Bounded, cancellable provider transport. No page actions, telemetry, or URL choice. */
const API='https://openrouter.ai/api/v1/chat/completions';
chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='bob'||port.sender?.id&&port.sender.id!==chrome.runtime.id)return;
  let running=false,closed=false,controller=null;
  port.onDisconnect.addListener(()=>{closed=true;controller?.abort();});
  const send=m=>{if(!closed)try{port.postMessage(m);}catch{closed=true;controller?.abort();}};
  port.onMessage.addListener(async request=>{
    if(running)return;running=true;
    const {models,messages,key,responseFormat}=request||{};
    if(!Array.isArray(models)||!models.length||models.length>4||!models.every(m=>typeof m==='string'&&/^[\w/.:@-]{1,150}$/.test(m))||!Array.isArray(messages)||messages.length>24||!messages.every(m=>['system','user','assistant'].includes(m.role)&&typeof m.content==='string')||JSON.stringify(messages).length>18000||typeof key!=='string'||!key.trim()||key.length>500){send({error:{message:'Invalid request or missing OpenRouter key.',fatal:true}});return;}
    let last='No model responded.';
    for(const model of models){
      if(closed)return;
      controller=new AbortController();let emitted=false;
      const timeout=setTimeout(()=>controller.abort(),45000);
      try{
        const res=await fetch(API,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Title':'Bob Project Mentor'},body:JSON.stringify({model,messages,stream:true,max_tokens:2500,...(responseFormat?{response_format:responseFormat}:{})})});
        if([401,403].includes(res.status))throw Object.assign(new Error('OpenRouter rejected the key. Check Settings.'),{fatal:true});
        if(!res.ok){last='Provider returned HTTP '+res.status+'.';continue;}
        if(!res.body)throw new Error('The provider returned no response body.');
        const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',total=0;
        const consume=line=>{
          if(!line.startsWith('data:'))return;
          const text=line.slice(5).trim();if(!text||text==='[DONE]')return;
          let event;try{event=JSON.parse(text);}catch{return;}
          if(event.error)throw new Error('The provider reported a streaming error.');
          const chunk=event.choices?.[0]?.delta?.content;
          if(typeof chunk==='string'&&chunk){emitted=true;send({chunk});}
        };
        try{
          while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>160000)throw new Error('The provider response exceeded the limit.');buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)consume(line);}
          buffer+=decoder.decode();if(buffer.trim())consume(buffer);
        }finally{await reader.cancel().catch(()=>{});}
        if(!emitted)throw new Error('The provider returned an empty response.');
        send({done:true});return;
      }catch(error){last=error.name==='AbortError'?'The request timed out. Local guidance is still available.':error.message;if(error.fatal||emitted){send({error:{message:last,fatal:!!error.fatal}});return;}}
      finally{clearTimeout(timeout);}
    }
    send({error:{message:last+' Local guidance is still available.'}});
  });
});
