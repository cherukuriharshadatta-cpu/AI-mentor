/* Declarative dependency graph: evidence -> capability -> requirement. */
(function(root){
  'use strict';
  const M=root.BobProjectModel||(typeof require==='function'?require('./project-model'):null);
  const C=(id,title,category,capabilities,why,does,implement,verify,options={})=>({id,title,category,capabilities,why,does,implement,verify,...options});
  const RULES=[
    C('core','Finish the main user journey','Functionality',[], 'The product must solve the stated problem before adding extras.','Defines a small usable result.','Write acceptance criteria for the stated goal and finish that workflow.','Run the workflow from start to finish, including an invalid input.',{project:true}),
    C('tests','Test important workflows','Testing and reliability',[], 'A demo working once does not cover errors or future changes.','Checks normal use and important failure cases.','Add focused tests for the core workflow and the errors it can encounter.','Run tests and confirm each result covers a named acceptance criterion.',{project:true}),
    C('release','Create and test a release','Deployment',[], 'Other people need a repeatable way to run the product.','Packages the actual product for its intended platform.','Document the build and release procedure using the existing stack.','Install or run a clean build on another target device or environment.',{project:true}),
    C('accessibility','Check usable and accessible controls','Functionality',['interface'],'People use different devices, input methods and accessibility tools.','Makes the interface understandable and operable.','Check labels, contrast, focus, scaling, keyboard access where supported, and clear error messages.','Try the primary journey using supported assistive technology and input methods.'),
    C('device','Test target devices','Testing and reliability',['interface'],'Layout, controls and performance can differ between devices.','Checks compatibility with the platforms you chose.','Choose representative target devices and test input, display, startup and resource usage.','Run the same workflow on each target platform and record results.',{platform:true}),
    C('game','Test gameplay and restart','Testing and reliability',['gameplay'],'A playable prototype can still get stuck or fail to restart.','Covers gameplay state and input transitions.','Test starting, playing, pausing if supported, losing or winning, and restarting.','Play a full session with each supported input method.'),
    C('saves','Protect saved progress','Testing and reliability',['saves'],'Interrupted writes or upgrades can lose user progress.','Makes saves recoverable and compatible.','Handle interrupted saves, invalid files and version migration without losing the last good save.','Interrupt a save in a test environment and try restoring an older save.'),
    C('auth','Protect accounts and sessions','Security and privacy',['accounts'],'People must not be able to impersonate other users.','Checks identity and limits session lifetime.','Use the existing framework’s supported authentication, secure sessions, logout and login abuse protection. Add recovery only if offered.','Try expired sessions, logout reuse, repeated login attempts and an invalid account.'),
    C('authorization','Enforce access boundaries','Security and privacy',['accounts','roles'],'Signing in does not give permission to access every record or action.','Checks ownership and roles at the trusted boundary.','Enforce authorization for every private action and resource, preserving existing roles.','Try another account’s private record and an admin action as an ordinary user.',{any:true,dependsOn:['auth']}),
    C('payments','Verify payment outcomes','Security and privacy',['payments'],'A browser success message can be forged, delayed or repeated.','Uses trusted payment state and handles failures.','Use a payment provider, verify callbacks or server results, and make fulfillment idempotent where retries occur.','Use test mode for success, decline, cancellation and duplicate notifications.'),
    C('uploads','Validate submitted files','Security and privacy',['uploads','game-submissions'],'Submitted files can be too large, malformed or malicious.','Limits what untrusted files can reach.','Restrict types and sizes, check actual file content, isolate storage and handle rejected files clearly.','Submit oversized, mismatched and malformed files in a test environment.',{any:true}),
    C('game-sandbox','Isolate uploaded games','Security and privacy',['game-submissions'],'A submitted game can execute someone else’s code.','Separates game execution from private application data.','Use an appropriate execution sandbox and origin separation, limited permissions, and a review process before publishing.','Verify a submitted game cannot access account cookies, private storage or privileged application APIs.',{dependsOn:['uploads']}),
    C('data','Protect database access','Security and privacy',['database'],'Stored records need appropriate access restrictions.','Limits database privileges and unsafe queries.','Use least-privilege access and safe query parameters. Apply per-user rules only when private user records exist.','Test forbidden reads and writes and malformed query inputs.'),
    C('recovery','Test cloud-data recovery','Operations and maintenance',['cloud-data'],'Mistakes and service failures can destroy shared data.','Defines recovery and retention expectations.','Choose backup and retention policies appropriate to the data’s importance and test restoration.','Restore a test backup and verify the expected records are usable.',{dependsOn:['data']}),
    C('network','Validate remote requests','Security and privacy',['backend','multiplayer'],'Remote requests cross a trust boundary and can fail or be forged.','Validates input and protects transport and resources.','Use secure transport, validate inputs at the trusted endpoint, limit abuse and handle connection failure.','Test invalid requests, disconnection and unauthorized calls where access controls apply.',{any:true}),
    C('https','Protect public web transport','Security and privacy',['public-web'],'Public web traffic can be intercepted or altered without protected transport.','Encrypts and authenticates the browser connection.','Configure HTTPS and redirect plain HTTP through the chosen host.','Open the public URL and verify redirects and that resources load without mixed content.'),
    C('multiplayer','Validate multiplayer state','Security and privacy',['multiplayer'],'Players can forge scores or invalid state transitions.','Places authority at the appropriate trusted host.','Validate competitive actions, rates and state transitions and handle reconnection.','Test impossible moves, forged results and reconnecting clients.',{dependsOn:['network']}),
    C('secrets','Keep credentials private','Security and privacy',['secrets'],'A leaked credential can expose services or create charges.','Keeps secrets outside distributed code and unsafe logs.','Use private configuration appropriate to the architecture, least privilege and a rotation process.','Inspect the built client and logs for secrets and test revoking a test credential.'),
    C('api-failures','Handle service failures','Testing and reliability',['external-api'],'Providers may time out, reject requests or enforce usage limits.','Provides bounded retries and useful errors.','Add timeouts, safe retries only for retryable operations and clear provider-error handling.','Simulate timeout, rate limit, invalid credentials and unavailable service.'),
    C('agent-tools','Restrict AI tool actions','Security and privacy',['ai','tools'],'Untrusted content can manipulate an agent into unintended actions.','Constrains tools independently of model instructions.','Validate tool inputs, restrict permissions, require approval for consequential actions, and keep redacted action logs.','Test malicious instructions in external content, forbidden tools and rejected approvals.'),
    C('ai-evals','Evaluate AI behavior','Testing and reliability',['ai'],'Model output can be incorrect or inconsistent.','Measures behavior on representative and adversarial inputs.','Create repeatable evaluations for actual tasks, failure handling and regression.','Run normal, ambiguous and adversarial cases and review failures.'),
    C('privacy','Minimize personal information','Security and privacy',['personal-data'],'Unnecessary personal data increases exposure.','Limits collection, access and retention.','Document necessary data, restrict access, and define retention and deletion. Determine applicable obligations rather than assuming a law applies.','Verify unnecessary fields are absent and deletion and access restrictions work.'),
    C('permissions','Request only needed device access','Security and privacy',['device-permissions'],'Device permissions expose sensitive capabilities.','Limits access and handles refusal gracefully.','Request permissions only when needed and explain the purpose. Provide a usable denied-permission state.','Deny and revoke each permission and verify safe behavior.'),
    C('dependencies','Review dependency updates','Operations and maintenance',['dependencies'],'Third-party code changes and may contain known issues.','Makes updates repeatable and reviewable.','Inventory actual dependencies, review supported versions and known advisories, and test updates.','Run the appropriate dependency check and regression tests; review each finding’s applicability.'),
    C('operations','Prepare monitoring and rollback','Operations and maintenance',['backend','production'],'A running service needs detection and recovery when failures occur.','Connects useful alerts to an actionable recovery plan.','Monitor critical workflows with redacted logs, define alerts and document rollback.','Trigger a test failure and rehearse recovery without exposing private data.')
  ];
  function plan(model,status={}) {
    if(!model)return [];
    return RULES.flatMap(rule=>{
      const hits=rule.capabilities.filter(id=>M.active(model,id));
      const applies=rule.project?!!model.identity.description:(rule.any?hits.length>0:hits.length===rule.capabilities.length);
      if(!applies||rule.platform&&!model.environment.platforms)return [];
      const record=status[rule.id];
      const saved=typeof record==='object'?record:{state:record};
      const state=['not-started','in-progress','reported-complete','not-applicable'].includes(saved.state)?saved.state:
        saved.state==='verified'&&saved.evidence?.reviewed&&saved.evidence?.scope&&saved.evidence?.reference?(saved.signature===M.signature(model)?'verified':'reported-complete'):'not-started';
      const evidence=hits.map(id=>model.capabilities[id].source);
      const reason=hits.length?'Your stated capabilities include '+hits.map(id=>model.capabilities[id].value).join(' and ')+'.':'Your stated goal is '+model.identity.description.value+'.';
      return [{...rule,reason,evidence,status:state,verification:saved.evidence||null,dependencies:(rule.dependsOn||[]),prompt:prompt(model,rule)}];
    }).map((r,i,all)=>({...r,dependencies:r.dependencies.filter(id=>all.some(x=>x.id===id))}));
  }
  function prompt(model,rule){
    return ['Project: '+(model.identity.name?.value||model.identity.description?.value||'the current project')+'.',
      'Goal: '+(model.identity.objective?.value||'finish the described workflow')+'.',
      'Stack: '+(model.environment.stack?.value?.join(', ')||'inspect the existing stack; do not invent one')+'.',
      'Platforms: '+(model.environment.platforms?.value?.join(', ')||'confirm the intended platform')+'.',
      'Requirement: '+rule.implement, 'Why: '+rule.why,
      'Preserve existing behavior and explicitly excluded features. Respect these constraints: '+(Object.values(model.constraints).map(f=>f.value).join('; ')||'no additional constraints confirmed')+'.',
      'Handle invalid input, interrupted operations and relevant failures without exposing private data. Add meaningful tests for changed behavior.',
      'Acceptance check: '+rule.verify,'Explain how to reproduce the verification; do not claim unrun tests passed.'].join('\n\n');
  }
  function briefing(model,requirements,previousIds=null){
    if(!model.identity.description)return 'I’m still learning what you are building. '+model.uncertainties[0];
    const ids=requirements.map(r=>r.id);
    const added=previousIds?requirements.filter(r=>!previousIds.includes(r.id)):requirements;
    const removed=previousIds?previousIds.filter(id=>!ids.includes(id)):[];
    const intro=previousIds?'Your project plan changed.':'I found your project: '+(model.identity.name?.value||model.identity.description.value)+'.';
    const planner=root.BobReadiness||(typeof require==='function'?require('./readiness-planner'):null);
    const active=planner.prioritize(added,model).filter(r=>!['reported-complete','verified','not-applicable'].includes(r.status)).slice(0,4);
    return [intro,model.constraints.budget?'Budget: '+model.constraints.budget.value+'.':'',
      ...active.map((r,i)=>(i+1)+'. **'+r.title+'** — '+r.why),
      removed.length?'No longer applicable: '+removed.map(id=>RULES.find(r=>r.id===id)?.title||id).join(', ')+'.':'',
      !added.length&&!removed.length?'The applicable requirements are unchanged; the project facts have been updated.':'',
      '**Next step:** '+(model.uncertainties[0]||active[0]?.verify||'Review the updated project details and the evidence for completed work.'),
      'Open Project Details for implementation prompts and verification steps. Local guidance; completion is not independently verified.'].filter(Boolean).join('\n\n');
  }
  root.BobRequirements={RULES,plan,prompt,briefing};
  if(typeof module!=='undefined')module.exports=root.BobRequirements;
})(typeof window!=='undefined'?window:globalThis);
