/* Project facts retain provenance. Optional suggestions never become requirements. */
(function (root) {
  'use strict';
  const P = root.BobPrivacy || (typeof require === 'function' ? require('./privacy') : null);
  const DEFINITIONS = [
    ['interface', 'a user interface', /\b(website|web ?app|landing page|portfolio|dashboard|mobile app|desktop app|game|gui|interface)\b/i],
    ['accounts', 'user accounts', /\b(log ?in|sign[ -]?(?:up|in)|accounts?|authentication|user registration)\b/i],
    ['database', 'a database', /\b(database|postgres(?:ql)?|mysql|sqlite|mongodb|firestore|supabase|firebase|prisma)\b/i],
    ['cloud-data', 'cloud data', /\b(cloud (?:data|sav\w*|storage)|hosted database|supabase|firestore|firebase)\b/i],
    ['payments', 'payments', /\b(payments?|checkout|stripe|razorpay|paypal|billing|subscriptions?)\b/i],
    ['uploads', 'file submissions', /\b(upload\w*|file submissions?|attachments?|submit games?)\b/i],
    ['game-submissions', 'uploaded games', /\b((?:upload|submit|publish)\w* (?:their |user |custom )?games?|game (?:submissions?|uploads?)|developers (?:can |to )?(?:share|publish) games)\b/i],
    ['gameplay', 'gameplay', /\b(single.player|strategy game|platformer|playable|gameplay|puzzle game|video game|game for (?:pc|mobile))\b/i],
    ['saves', 'saved progress', /\b(save (?:games?|progress)|saving|save files?|saved progress)\b/i],
    ['multiplayer', 'multiplayer networking', /\b(multiplayer|co.op|pvp|online play|online leaderboard|real.time match)\b/i],
    ['backend', 'a remote service', /\b(backend|server|rest api|graphql|hosted api|cloud functions?)\b/i],
    ['public-web', 'public web access', /\b(public website|publish (?:the |my |a )?(?:site|website)|online website|web hosting|public web|deploy (?:the |my |a )?(?:site|website))\b/i],
    ['external-api', 'an external API', /\b(external api|third.party api|openrouter|openai api|stripe api)\b/i],
    ['secrets', 'private credentials', /\b(api[ _-]?keys?|secret keys?|access tokens?|private credentials|\.env)\b/i],
    ['ai', 'AI responses', /\b(ai agent|ai assistant|llm|language model|chatbot|generative ai)\b/i],
    ['tools', 'AI tool actions', /\b(tool[ -]?(?:calling|calls?|access)|agent tools?|autonomous actions|execute commands|send emails automatically)\b/i],
    ['personal-data', 'personal information', /\b(personal (?:data|information)|health data|phone numbers?|email addresses|location data|customer data)\b/i],
    ['roles', 'privileged roles', /\b(admin|roles?|permissions?|multi.user|staff access|team access)\b/i],
    ['device-permissions', 'device permissions', /\b(camera|microphone|gps|location access|contacts access|device permissions)\b/i],
    ['dependencies', 'third-party dependencies', /\b(dependencies|libraries|packages|npm|pip|unity|godot|react|next\.js|flutter)\b/i],
    ['production', 'a live service', /\b(in production|live service|production service|already deployed|production deployment)\b/i],
    ['organization', 'team or company use', /\b(company|enterprise|organization|staff|internal dashboard)\b/i]
  ];
  const matches = (text) => DEFINITIONS.filter(d => d[2].test(text));
  function fact(key, value, message, classification = 'confirmed', stage = 'planned') {
    return { key, value: Array.isArray(value)?value.map(v=>P.redact(v,240)):P.redact(value,500), classification, stage, confidence: classification === 'confirmed' || classification === 'excluded' ? 0.94 : 0.65,
      source: { id: message.id, role: message.role, excerpt: P.redact(message.text, 200) }, timestamp: message.timestamp || new Date().toISOString() };
  }
  function build(messages, previous) {
    const model = { schemaVersion: 1, identity: {}, environment: {}, constraints: {}, capabilities: {}, suggestions: [], conflicts: [], uncertainties: [],
      progress: { stage: 'unknown', knownProblems: [], completedWork: [], evidence: [] }, messageCount: messages.length };
    for (const message of messages.slice(-160)) {
      if (!['user','assistant'].includes(message.role)) continue;
      const text = message.text.replace(/```[\s\S]*?```/g, '').slice(-16000);
      const clauses = text.split(/[.!?;\n]+|\bbut\b/i).map(x=>x.trim()).filter(Boolean);
      if (message.role === 'user') {
        const identity = text.match(/\b(?:build|create|making|develop|building|working on)\s+(.{3,240})/i);
        if (identity) {
          model.identity.description = fact('description', P.redact(identity[1].split(/[.\n]/)[0],240), message);
          model.identity.objective = model.identity.description;
        }
        const name = text.match(/\b(?:called|named|project name[: ]+)\s*["“']?([\w][\w -]{1,45})/i);
        if (name) model.identity.name = fact('name',name[1].trim(),message);
        const categories = [['gaming platform',/gaming (?:community|platform)|platform for game developers|game submission/i],['game',/game|platformer/i],['mobile app',/mobile app|android|ios/i],['browser extension',/browser extension|chrome extension/i],['AI agent',/ai agent|chatbot/i],['website',/website|web app|portfolio|landing page/i],['backend',/backend|rest api/i],['data tool',/research|dataset|data tool/i],['automation',/automation|workflow/i]];
        const hit = categories.filter(x=>x[1].test(text));
        if (hit.length) { model.identity.category = fact('category', hit[0][0], message, 'inferred'); model.identity.secondaryCategories = hit.slice(1).map(x=>x[0]); }
        for (const [key, regex] of [['platforms',/\b(PC|Windows|macOS|Linux|Android|iOS|mobile|desktop|web)\b/gi],['stack',/\b(React|Next\.js|Vue|Svelte|Django|Flask|FastAPI|Express|Node(?:\.js)?|Python|TypeScript|JavaScript|Godot|Unity|Flutter|Kotlin|Swift|Postgres(?:ql)?|Supabase|Firebase)\b/gi]]) {
          const values = [...new Set(text.match(regex) || [])];
          if (values.length) model.environment[key] = fact(key, [...new Set([...(model.environment[key]?.value || []),...values])],message);
        }
        for (const [key,regex] of [['budget',/\b(no budget|zero budget|free only|budget[^.\n]{0,50})/i],['hardware',/\b(low.end[^.\n]{0,60}|only (?:a |my )?(?:phone|laptop)[^.\n]{0,40})/i],['experience',/\b(I(?:'m| am) (?:a )?(?:beginner|experienced developer)|first project)/i],['time',/\b(deadline[^.\n]{0,50}|within \d+ (?:days|weeks|months))/i],['organization',/\b(company policy[^.\n]{0,80}|contract requires[^.\n]{0,80})/i]]) {
          const m=text.match(regex); if(m)model.constraints[key]=fact(key,m[0],message);
        }
        for(const [key,regex] of [['hosting',/\b(?:host(?:ing|ed)? (?:on|using)|deploy(?:ed)? (?:on|to)) ([^.;\n]{2,80})/i],['architecture',/\b(local.first|client.server|serverless|microservices|monolith|offline.first)\b/i],['services',/\b(OpenRouter|Stripe|Razorpay|Supabase|Firebase|AWS|Azure|Cloudflare|Vercel)\b/gi],['storage',/\b(SQLite|Postgres(?:ql)?|MongoDB|Firestore|localStorage|local files?)\b/gi]]) {
          const values=text.match(regex); if(values)model.environment[key]=fact(key,P.redact(values.join(', '),180),message);
        }
        const users=text.match(/\b(?:for|used by) (children|kids|students|developers|employees|staff|customers|researchers|myself)\b/i);
        if(users)model.identity.users=fact('users',users[1],message);
      }
      for (const clause of clauses) {
        const negative = /\b(no|without|not using|don't need|do not need|don't want|do not want|not include|remove[ds]?|exclude[ds]?|avoid|never|won't|disabled)\b/i.test(clause);
        const optional = /\b(maybe|could|might|optional|consider|perhaps|should we|should I|do I need|do we need|what if|would it)\b/i.test(clause);
        const complete = /\b(implemented|finished|completed|already works|built|done)\b/i.test(clause);
        const underway = /\b(working on|implementing|building now|in progress)\b/i.test(clause);
        for (const [key,label,pattern] of matches(clause)) {
          const matchIndex = clause.search(pattern);
          const prefix = clause.slice(0,matchIndex);
          const suffix = clause.slice(matchIndex);
          const excluded = /\b(no|without|not using|don't need|do not need|don't want|do not want|not include|remove[ds]?|exclude[ds]?|avoid|never|won't|disabled)\b/i.test(prefix) || /\b(?:is|are) (?:not needed|excluded|disabled)\b/i.test(suffix);
          const m = {...message,text:clause};
          if (message.role === 'assistant' || optional) {
            const suggestion = fact(key,label,m,'suggested',complete?'reported-complete':'optional');
            model.suggestions.push(suggestion);
            if (complete && model.capabilities[key]?.classification === 'confirmed') {
              model.capabilities[key].stage = 'reported-complete';
              model.progress.completedWork.push(suggestion);
            }
            if (model.capabilities[key]?.classification === 'excluded' && complete)
              model.conflicts.push({key,reason:'The coding AI reports an excluded feature as built.',sources:[model.capabilities[key].source,suggestion.source]});
            continue;
          }
          const f = fact(key,label,m,excluded?'excluded':'confirmed',complete?'reported-complete':underway?'in-progress':'planned');
          if (excluded && /\b(?:no|without) budget\b/i.test(clause) && !/\b(?:no|without) (?:accounts|payments|server|database)\b/i.test(clause)) f.classification='confirmed';
          model.capabilities[key]=f;
        }
        if(message.role==='user' && /\b(offline|single.player|local.only)\b/i.test(clause)) {
          model.environment.connectivity=fact('connectivity','offline / local',message);
          // Single-player alone doesn't rule out accounts or cloud saves.
          if(/\b(offline|local.only)\b/i.test(clause)) for(const key of ['multiplayer','backend','public-web'])
            if(!model.capabilities[key])model.capabilities[key]=fact(key,key,message,'excluded');
        }
        if(message.role==='user' && /\b(prototype|MVP|first version)\b/i.test(clause)) model.progress.stage='prototype';
        if(message.role==='user' && /\b(ready to publish|release candidate|before release|publishing)\b/i.test(clause)) model.progress.stage='release preparation';
        if(message.role==='user' && /\b(in production|already deployed|live service)\b/i.test(clause)) model.progress.stage='production';
        if(/\b(fails?|broken|crash|bug|error)\b/i.test(clause)) model.progress.knownProblems.push(fact('problem',P.redact(clause,180),message,'inferred'));
      }
    }
    if(!model.identity.description && Object.keys(model.capabilities).length)
      model.identity.description=fact('description','a project with '+Object.values(model.capabilities).filter(f=>f.classification==='confirmed').map(f=>f.value).join(', '),messages.find(m=>m.role==='user')||{id:'unknown',role:'user',text:''},'inferred');
    model.identity.confidence=model.identity.description?model.identity.description.confidence:0;
    if(!model.identity.category)model.identity.category={value:'custom project',classification:'unknown',confidence:0,source:null,timestamp:new Date().toISOString()};
    if(!model.identity.description)model.uncertainties.push('What are you trying to build, and who will use it?');
    if(model.identity.description && !model.environment.platforms)model.uncertainties.push('Where should the finished product run?');
    if(model.conflicts.length)model.uncertainties.unshift('The AI reports a feature you excluded. Should it stay excluded?');
    model.suggestions=model.suggestions.slice(-30);model.progress.knownProblems=model.progress.knownProblems.slice(-10);
    return model;
  }
  const active = (m,id) => m.capabilities[id]?.classification==='confirmed';
  const signature = m => JSON.stringify({identity:m.identity.description?.value,features:Object.entries(m.capabilities).map(([k,v])=>[k,v.classification,v.stage]).sort(),stage:m.progress.stage,platform:m.environment.platforms?.value,stack:m.environment.stack?.value,budget:m.constraints.budget?.value,conflicts:m.conflicts.map(c=>c.key)});
  root.BobProjectModel={build,active,signature,DEFINITIONS};
  if(typeof module!=='undefined')module.exports=root.BobProjectModel;
})(typeof window!=='undefined'?window:globalThis);
