import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const files=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/components.css','components.css'],['/app.js','app.js'],['/core.js','core.js'],['/engine.js','engine.js']]);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
const supported=['rest','swim-tech','bike-easy','run-easy'];
export function validateSummary(input){
  if(!input||input.consent!==true)throw Error('Consent is required.');
  const out={};
  for(const [k,max] of [['day',100000],['ctl',1000],['atl',1000],['exhaustion',100],['energy',100]]){if(!Number.isFinite(input[k])||input[k]<0||input[k]>max)throw Error('Invalid game summary.');out[k]=input[k];}
  if(!Array.isArray(input.allowedOptions)||input.allowedOptions.length>4||!input.allowedOptions.includes('rest')||input.allowedOptions.some(x=>!supported.includes(x)))throw Error('Invalid options.');out.allowedOptions=[...new Set(input.allowedOptions)];
  if(!Array.isArray(input.activeInjuries)||input.activeInjuries.length>6)throw Error('Invalid injury summary.');
  out.activeInjuries=input.activeInjuries.map(m=>{if(!['shoulder','knee','achilles','shin','back','femur'].includes(m.kind)||!['protect','rebuild','return','review'].includes(m.phase))throw Error('Invalid injury summary.');return{kind:m.kind,phase:m.phase};});
  if(input.lastReport){out.lastReport={};for(const k of ['actual','planned','rpe']){if(!Number.isFinite(input.lastReport[k])||input.lastReport[k]<0||input.lastReport[k]>1000)throw Error('Invalid session summary.');out.lastReport[k]=input.lastReport[k];}}
  return out;
}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
export function createServer({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL,fetcher=fetch}={}){
  let lastRequest=0,inFlight=false;
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' blob: data:; frame-ancestors 'none'");
    const url=new URL(req.url,'http://localhost');
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||'')){send(res,403,{error:'Local host only.'});return;}
    if(url.pathname==='/api/config'&&req.method==='GET'){send(res,200,{aiEnabled:!!(apiKey&&model)});return;}
    if(url.pathname==='/api/coach'&&req.method==='POST'){
      if(req.headers.origin!==`http://${req.headers.host}`){send(res,403,{error:'Same-origin request required.'});return;}
      if(!apiKey||!model){send(res,503,{error:'Configure OPENAI_API_KEY and OPENAI_MODEL on the server.'});return;}
      if(inFlight||Date.now()-lastRequest<10000){send(res,429,{error:'Please wait before asking again.'});return;}
      let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){send(res,413,{error:'Request too large.'});return;}}}catch{send(res,400,{error:'Invalid request.'});return;}
      let summary;try{summary=validateSummary(JSON.parse(body));}catch(e){send(res,400,{error:e.message});return;}
      inFlight=true;lastRequest=Date.now();
      try{
        const schema={type:'object',properties:{explanation:{type:'string'},suggestedOption:{type:'string',enum:summary.allowedOptions},caution:{type:'string'}},required:['explanation','suggestedOption','caution'],additionalProperties:false};
        const upstream=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model,store:false,max_output_tokens:1200,instructions:'You narrate a fictional triathlon management game. In at most 100 words, explain the supplied simulation state and choose one supplied allowedOption. Never diagnose a person, prescribe treatment, promise recovery dates, change game stats or override restrictions. Mention that injury recovery is a game simulation, not medical advice. Only supplied state is authoritative.',input:JSON.stringify(summary),text:{format:{type:'json_schema',name:'game_coach',strict:true,schema}}})});
        if(!upstream.ok)throw Error('Provider request failed. Check model access, credentials and billing.');
        const data=await upstream.json();const output=data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
        const answer=JSON.parse(output||'{}');if(!summary.allowedOptions.includes(answer.suggestedOption)||typeof answer.explanation!=='string'||typeof answer.caution!=='string'||answer.explanation.length>3000||answer.caution.length>1500)throw Error('Coach response could not be validated.');
        send(res,200,{explanation:answer.explanation,suggestedOption:answer.suggestedOption,caution:answer.caution});
      }catch(e){send(res,502,{error:e.name==='TimeoutError'?'Coach timed out. Try again later.':e.message.startsWith('Provider')||e.message.startsWith('Coach')?e.message:'Coach unavailable. Use the local coach.'});}finally{inFlight=false;}return;
    }
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'Method not allowed.'});return;}
    const file=files.get(url.pathname);if(!file){send(res,404,{error:'Not found.'});return;}
    try{const data=await readFile(resolve(publicDir,file));res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);}catch{send(res,500,{error:'Could not load app file.'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT)||4173;
  createServer().listen(port,'127.0.0.1',()=>console.log(`Triathlon Manager: http://127.0.0.1:${port}`));
}
