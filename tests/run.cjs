const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});if(r.status)process.exit(r.status);}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
for(const script of manifest.content_scripts.flatMap(c=>c.js))if(!fs.existsSync(path.join(root,script)))throw new Error('Missing manifest script '+script);
for(const name of ['test_engine.js','test_bridge.js','test_project_model.js','test_modules.js','test_background.js','smoke_intro.js','smoke.js']){const r=spawnSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit',timeout:30000});if(r.error)throw r.error;if(r.status)process.exit(r.status);}
console.log('All syntax, manifest, unit and simulated-extension checks passed.');
