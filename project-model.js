/* Bob Project Model v3: local, capability-driven planning; no network access. */
(function (global) {
  "use strict";
  const RULES = [
    {id:"core",title:"Define the smallest usable version",category:"Product",when:()=>true,why:"A clear first milestone prevents endless feature additions.",prompt:"Identify the smallest working version of this project, its user journey, and three measurable acceptance tests."},
    {id:"tests",title:"Automate important user journeys",category:"Quality",when:()=>true,why:"A working demo does not prove future changes are safe.",prompt:"Add automated tests for the main user workflow, errors, and edge cases; explain how to run them."},
    {id:"errors",title:"Handle failures and recovery",category:"Reliability",when:()=>true,why:"Real users encounter failed requests, interruptions and invalid data.",prompt:"Review failure cases; add helpful errors, safe retries when appropriate, and recovery tests."},
    {id:"release",title:"Create a repeatable release process",category:"Deployment",when:()=>true,why:"Others need a dependable way to run the actual product.",prompt:"Document a reproducible build and release process appropriate to the target platforms."},
    {id:"accessibility",title:"Test accessibility and usability",category:"Quality",when:x=>x.capabilities.has("interface"),why:"People use different devices and interaction methods.",prompt:"Review keyboard support, labels, responsive layout and accessible error messages."},
    {id:"secrets",title:"Protect credentials and configuration",category:"Security",when:x=>x.capabilities.has("external-api")||x.capabilities.has("backend"),why:"Leaked credentials can expose accounts and services.",prompt:"Audit credentials and secrets in source, logs and shipped clients; move server-only secrets to secure configuration and add rotation guidance."},
    {id:"auth",title:"Implement secure accounts and sessions",category:"Security",when:x=>x.capabilities.has("accounts"),why:"Accounts require secure identity checks and session lifetimes.",prompt:"Add authentication, authorization, rate limits, session expiry, and tests for unauthorized access, using this project's stack."},
    {id:"payments",title:"Verify payments and transactions",category:"Security",when:x=>x.capabilities.has("payments"),why:"Payment state must be verified using trustworthy provider responses.",prompt:"Use a supported payment provider, verify server-side transaction state, handle retries and webhooks, and test payment failures."},
    {id:"data",title:"Protect stored user data",category:"Security",when:x=>x.capabilities.has("user-data"),why:"Stored data needs access restrictions, retention rules, and recovery.",prompt:"Implement least-privilege data access, privacy-conscious retention, backups if applicable, and data access tests."},
    {id:"network",title:"Secure network communication",category:"Security",when:x=>x.capabilities.has("backend")||x.capabilities.has("multiplayer"),why:"Remote endpoints cross a trust boundary.",prompt:"Review TLS, endpoint validation, rate limits, authorization and network failure handling for all actual remote services."},
    {id:"game",title:"Test builds, saves and device performance",category:"Quality",when:x=>x.type==="game",why:"A playable prototype may still break on target hardware or lose progress.",prompt:"Test game saves, scene transitions, input controls, performance and builds for each planned device."},
    {id:"multiplayer",title:"Validate multiplayer authority",category:"Security",when:x=>x.capabilities.has("multiplayer"),why:"Players cannot be trusted to report competitive outcomes.",prompt:"Implement authoritative validation for multiplayer state, replay protections when needed and abuse tests."},
    {id:"agents",title:"Limit AI agent tools and permissions",category:"Security",when:x=>x.capabilities.has("agent"),why:"Agent tools can perform actions outside the model's text output.",prompt:"Define least-privilege tool permissions, confirmation for consequential actions, prompt-injection defenses and auditable actions."},
    {id:"agent-evals",title:"Evaluate AI behavior",category:"Quality",when:x=>x.capabilities.has("ai"),why:"Model behavior varies and should be checked with representative inputs.",prompt:"Build repeatable AI evaluations for accuracy, refusal, tool use, prompt injection and regression."},
    {id:"operations",title:"Plan monitoring and incident recovery",category:"Operations",when:x=>x.capabilities.has("backend")||x.capabilities.has("organization"),why:"Production services need observability and a recovery plan.",prompt:"Add safe monitoring, useful alerts, incident response instructions and rollback procedures."}
  ];
  const PATTERNS = {
    interface:/\b(website|web app|mobile app|android|ios|gui|dashboard|interface|ui|desktop app)\b/i,
    backend:/\b(backend|rest api|graphql|server|hosted api|cloud functions?)\b/i,
    accounts:/\b(login|sign[ -]?up|accounts?|authentication|user profiles?)\b/i,
    payments:/\b(payment|checkout|subscriptions?|billing|purchases?)\b/i,
    "user-data":/\b(database|personal data|customer data|cloud sav(?:e|es|ing)|persisted user data)\b/i,
    multiplayer:/\b(multiplayer|co[ -]?op|pvp|online leaderboard|real[ -]?time match)\b/i,
    "external-api":/\b(external api|api key|openrouter|third.party api)\b/i,
    agent:/\b(ai agent|autonomous agent|agent tools?|tool.calling)\b/i,
    ai:/\b(ai model|llm|language model|ai agent|generative ai)\b/i,
    organization:/\b(company|enterprise|organization|staff portal|teams and roles)\b/i
  };
  function infer(type, userMessages, confirmed=[]) {
    const messages=(Array.isArray(userMessages)?userMessages:[]).map(String);
    const text=messages.slice(-12).join("\n");
    const capabilities=new Set(confirmed);
    const uncertain=[];
    for (const [name,pattern] of Object.entries(PATTERNS)) {
      if (!pattern.test(text)) continue;
      const negated=new RegExp("(?:no|without|not using|avoid)\\s+(?:\\w+\\s+){0,2}"+name.replace("-","[ -]?"),"i").test(text);
      if (!negated) capabilities.add(name); else uncertain.push(name);
    }
    if(type==="game") capabilities.add("game");
    if(type==="mobile"||type==="website") capabilities.add("interface");
    if(type==="bot") capabilities.add("agent");
    return {type:type||"unknown",capabilities,uncertain};
  }
  function plan(context, status={}) {
    return RULES.filter(rule=>rule.when(context)).map(rule=>({...rule,
      status:["not-started","in-progress","reported-complete","verified","not-applicable"].includes(status[rule.id])?status[rule.id]:"not-started",
      prompt:"I'm building "+context.type+". "+rule.prompt+" Preserve existing functionality, include meaningful error handling and tests, and state what evidence is needed to verify the result."
    }));
  }
  global.BobProjectModel={infer,plan,RULES};
})(typeof window!=="undefined"?window:globalThis);
