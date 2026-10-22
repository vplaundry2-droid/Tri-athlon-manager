import { Core } from './core.js';
export { Core };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=v=>structuredClone(v);
export const catalog={
  shoulder:{name:'Shoulder tendon irritation',tissue:0,days:[14,35],weights:[1,.12,0],methods:['Unload the affected stroke','In-game graded shoulder rehabilitation','Reassess before full swimming']},
  knee:{name:'Patellofemoral pain',tissue:1,days:[21,49],weights:[.15,.7,1],methods:['Reduce repetitive knee loading','In-game progressive strength work','Rebuild bike and run separately']},
  achilles:{name:'Achilles tendon irritation',tissue:2,days:[28,70],weights:[.05,.2,1],methods:['Reduce impact and hard running','In-game graded calf loading','Progressively rebuild running tolerance']},
  shin:{name:'Shin overload',tissue:3,days:[21,49],weights:[0,.12,1],methods:['Unload impact','In-game assessment if symptoms persist','Graduated return to running']},
  back:{name:'Cycling-related lower-back irritation',tissue:4,days:[14,35],weights:[.25,1,.25],methods:['Reduce time in the riding position','In-game bike-fit review and rehabilitation','Rebuild duration gradually']},
  femur:{name:'Femoral-neck bone stress injury',tissue:3,days:[70,140],weights:[1,1,1],methods:['Stop sport pending simulated assessment','Protected recovery: no automatic cycling clearance','Reassessment before limited cross-training or impact']}
};
export function noise(seed,day,salt=0){let x=(Number(seed)^Math.imul(day+1,2654435761)^Math.imul(salt+1,1597334677))>>>0;x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;return (x>>>0)/4294967296;}
export function createCareer(profile={},seed=31415){
  const s=Core.create(profile);s.version=3;s.career=true;s.seed=Number(seed)>>>0;
  s.traits={adaptation:.88+noise(seed,0,1)*.24,recovery:.85+noise(seed,0,2)*.3,durability:.9+noise(seed,0,3)*.2};
  s.durability=s.durability.map(v=>v*s.traits.durability);s.timeBudget=180;s.medical=[];s.resolved=[];s.reports=[];s.bone=0;s.soreness=0;s.races=[];s.raceDay=56;
  s.message='Your career starts here. Build the athlete, not just the numbers.';syncRestrictions(s);return s;
}
export function restrictions(s){
  const out=Core.sports.map(()=>({minutes:300,maxIF:1.2,reasons:[]}));
  for(const m of s.medical){const d=catalog[m.kind];for(let i=0;i<3;i++){
    if(d.weights[i]<.35)continue;
    let minutes=0,maxIF=0;
    if(m.assessed&&m.phase==='rebuild'){minutes=m.kind==='femur'?(i===2?0:15):20;maxIF=.65;}
    else if(m.assessed&&m.phase==='return'){minutes=m.kind==='femur'?20:30;maxIF=.65;}
    out[i].minutes=Math.min(out[i].minutes,minutes);out[i].maxIF=Math.min(out[i].maxIF,maxIF);out[i].reasons.push(d.name);
  }}return out;
}
function syncRestrictions(s){s.restrictions=restrictions(s);s.injuries=[];}
export function injuryName(m){return m.kind==='femur'?(m.assessed?'Fictional femoral-neck stress fracture':'Suspected femoral bone stress injury'):catalog[m.kind].name;}
export function recoveryEstimate(s,m){const d=catalog[m.kind],elapsed=s.day-m.onset;const lower=Math.max(0,Math.ceil((m.minDays-elapsed)/7));return [lower,Math.max(lower+1,Math.ceil((d.days[1]+m.setback-elapsed)/7))];}
export function assess(s,id){const m=s.medical.find(x=>x.id===id);if(!m)throw Error('Injury no longer active.');m.assessed=true;m.reviewDay=s.day;if(m.burden<=0&&s.day-m.onset>=m.minDays){s.resolved.push({...m,resolved:s.day});s.medical=s.medical.filter(x=>x.id!==id);s.message=injuryName(m)+' cleared in the simulation. Durability must still be rebuilt.';}else{s.message='Simulated assessment recorded. Restrictions remain until healing milestones and reassessment are met.';}syncRestrictions(s);return s;}
export function addInjury(s,kind,severity=1){
  if(!catalog[kind]||s.medical.some(x=>x.kind===kind))return;
  const d=catalog[kind],span=d.days[1]-d.days[0];
  const minDays=Math.round((d.days[0]+span*.25*noise(s.seed,s.day,kind.length))/s.traits.recovery);
  s.medical.push({id:kind+'-'+s.day,kind,severity,onset:s.day,minDays,burden:100,phase:'protect',assessed:false,reviewDay:-1,setback:0});syncRestrictions(s);
}
function heal(s,plan,choice){
  const notes=[];
  for(const m of s.medical){
    const d=catalog[m.kind],exposure=plan.parts.reduce((n,v,i)=>n+v*d.weights[i],0),elapsed=s.day-m.onset;
    const aggravation=exposure>12&&choice.care==='ignore';
    if(aggravation){m.burden=clamp(m.burden+8,0,130);m.minDays+=2;m.setback+=2;notes.push(injuryName(m)+': setback after loading affected tissues.');}
    else{const adherence=choice.care==='ignore'?.25:choice.care==='rehab'&&m.assessed?1.1:1;const support=(choice.sleep?1:.75)*(choice.meals?1:.75);m.burden=clamp(m.burden-(100/m.minDays)*s.traits.recovery*support*adherence,0,130);}
    if(m.assessed&&elapsed>=m.minDays*.45&&m.burden<=55)m.phase='rebuild';
    if(m.assessed&&elapsed>=m.minDays*.8&&m.burden<=20)m.phase='return';
    if(m.burden<=0&&elapsed>=m.minDays)m.phase='review';
  }return notes;
}
export function preview(s,choice){
  const temp=copy(s);syncRestrictions(temp);const p=Core.preview(temp,choice);
  // Never exceed a restriction even when the player elects to push past normal durability.
  p.parts=p.parts.map((m,i)=>Math.min(m,temp.restrictions[i].minutes));
  p.actual=p.parts.reduce((a,b)=>a+b,0);p.loads=p.parts.map(m=>m/60*100*p.cfg.intensity**2);p.tss=p.loads.reduce((a,b)=>a+b,0);p.partial=p.actual+.1<p.planned;p.blocked=p.planned>0&&p.actual===0;
  return p;
}
function numbers(s){return {ctl:s.ctl,atl:s.atl,form:s.ctl-s.atl,exhaustion:s.fatigue,energy:s.energy,vo2:Core.stats(s).vo2,ftp:Core.stats(s).ftp};}
export function train(state,raw){
  const s=copy(state),choice={session:'rest',minutes:0,sleep:true,meals:true,backoff:true,care:'protect',...raw};
  if(!['protect','rehab','ignore'].includes(choice.care))throw Error('Choose a recovery approach.');
  const planned=choice.session==='rest'?0:Number(choice.minutes),cost=planned+(choice.sleep?30:0)+(choice.meals?20:0)+(choice.care==='rehab'?15:0);
  if(cost>s.timeBudget)throw Error(`Plan uses ${cost} of ${s.timeBudget} available minutes.`);
  const p=preview(s,choice),before=numbers(s),oldFit=[...s.fit],oldDuration=[...s.durability],startMedical=s.medical.length;
  syncRestrictions(s);
  Core.day(s,choice);
  s.fit=s.fit.map((v,i)=>clamp(oldFit[i]+(v-oldFit[i])*(v>oldFit[i]?s.traits.adaptation:1),0,100));
  s.durability=s.durability.map((v,i)=>oldDuration[i]+(v-oldDuration[i])*(v>oldDuration[i]?s.traits.adaptation:1));
  const log=s.log.at(-1);const actual=log.minutes;const over=Math.max(...p.over);
  const notes=heal(s,p,choice);
  // Delayed bone stress uses cumulative actual running, never requested-but-uncompleted minutes.
  const runExposure=p.parts[2]/Math.max(8,s.durability[2]);
  s.bone=clamp(s.bone*(p.parts[2]? .985:.92)+runExposure*(2+Math.max(0,p.cfg.intensity-.7)*12)*(choice.meals?1:1.6)*(choice.sleep?1:1.3),0,160);
  if(s.bone>88&&!s.medical.some(x=>x.kind==='femur')){addInjury(s,'femur',2);notes.push('Persistent hip/thigh warning: sport paused for simulated assessment.');}
  ['shoulder','knee','achilles','shin','back'].forEach((kind,i)=>{if(s.strain[i]>=75&&!s.medical.some(m=>m.kind===kind)){addInjury(s,kind,s.strain[i]>105?2:1);notes.push(catalog[kind].name+' triggered a game restriction.');}});
  const variation=(noise(s.seed,s.day,9)-.5)*.8;
  const rpe=actual?Math.round(clamp(1+p.cfg.intensity*5+before.exhaustion*.025+(100-before.energy)*.012+over*5+variation,1,10)*10)/10:0;
  const pain=actual?Math.round(clamp(Math.max(...s.strain)/25+(s.bone>40?1:0),0,10)):0;
  const targetRPE=planned?Math.round(clamp(p.cfg.intensity*7,1,10)):0;
  const reasons=[];if(before.exhaustion>35)reasons.push('Accumulated exhaustion raised perceived effort.');if(before.energy<65)reasons.push('Low starting fuel reduced session quality.');if(over>.05)reasons.push('Pushing beyond durability added strain and reduced adaptation.');if(actual+0.1<planned)reasons.push(actual?'The athlete stopped before the planned finish.':'An injury restriction prevented the session.');if(choice.backoff&&actual<planned&&actual)reasons.push('Early back-off limited the overload.');if(!reasons.length)reasons.push(actual?'The session stayed within the athlete’s current preparation.':'No training load today; recovery and detraining both continue.');
  s.soreness=clamp(s.soreness*.6+(actual?rpe*.4:0),0,10);
  const after=numbers(s),a=Core.stats(s);const distance=p.parts.map((m,i)=>i===0?m*60/a.swim*p.cfg.intensity*100/1000:i===1?m/60*(40000/Core.bikeSeconds(Math.max(30,a.ftp*p.cfg.intensity),s.p.mass,a.cda,'flat')*3.6):m*60/a.run*p.cfg.intensity);
  const report={day:s.day,session:choice.session,label:p.cfg.label,planned,actual,rpe,targetRPE,pain,srpe:+(actual*rpe).toFixed(1),tss:log.tss,quality:log.quality,before,after,distance,pace:actual&&p.parts[2]?a.run/p.cfg.intensity:null,power:actual&&p.parts[1]?Math.round(a.ftp*p.cfg.intensity):null,soreness:+s.soreness.toFixed(1),reasons,notes,newInjuries:s.medical.length-startMedical,choice};
  s.reports.push(report);s.reports=s.reports.slice(-180);s.log=s.log.slice(-180);s.history=s.history.slice(-181);s.resolved=s.resolved.slice(-100);s.message=actual?`${p.cfg.label}: ${actual.toFixed(1)} / ${planned} min. RPE ${rpe}/10.`:planned?'Session blocked by injury restrictions. Day advanced with zero training load.':'Recovery day completed.';syncRestrictions(s);return s;
}
export function forecast(s,policy={}){const r=Core.race(s,policy);if(s.medical.length){r.canFinish=false;r.status='No race start · active injury restriction';}return r;}
export function race(s,policy={}){
  const result=forecast(s,policy);if(!result.canFinish)throw Error(result.status);
  const next=copy(s),before=numbers(s),parts=[result.swim,result.bike,result.run].map(v=>v/60);
  const intensities=[.75,clamp(Number(policy.effort)||88,70,110)/100,.8];
  const loads=parts.map((v,i)=>v/60*100*intensities[i]**2),stress=loads.reduce((a,b)=>a+b,0);
  const prior=Core.updateLoad(next,stress,loads);next.day++;
  next.fatigue=clamp(s.fatigue+stress*.3,0,100);next.energy=clamp(result.runFuel-25,0,100);
  next.fit=s.fit.map((v,i)=>clamp(v*Math.exp(-1/42)+loads[i]*.06*s.traits.adaptation*(1-v/140),0,100));
  next.strain=s.strain.map((v,j)=>clamp(v*.94+parts.reduce((sum,m,i)=>sum+Core.tissueWeights[i][j]*12*m/Math.max(5,s.durability[i]),0),0,140));
  next.bone=clamp(s.bone*.985+parts[2]/Math.max(8,s.durability[2])*5,0,160);
  const notes=[];['shoulder','knee','achilles','shin','back'].forEach((kind,i)=>{if(next.strain[i]>=75){addInjury(next,kind);notes.push(catalog[kind].name+' triggered a game restriction.');}});
  if(next.bone>88){addInjury(next,'femur',2);notes.push('Sport paused for simulated bone-stress assessment.');}
  next.soreness=clamp(s.soreness*.6+4,0,10);
  next.history.push({day:next.day,ctl:next.ctl,atl:next.atl,form:prior,tss:stress});next.history=next.history.slice(-181);
  const duration=result.total/60,rpe=clamp(7+s.fatigue*.025,1,10);
  next.reports.push({day:next.day,session:'race',label:'Standard-distance race',planned:duration,actual:duration,rpe,targetRPE:8,pain:Math.round(Math.max(...next.strain)/25),srpe:duration*rpe,tss:stress,quality:Math.round(result.freshness*100),before,after:numbers(next),distance:[1.5,40,10],pace:result.run/10,power:Math.round(result.power),soreness:next.soreness,reasons:['Race load includes all three disciplines. Recover before resuming hard training.'],notes,newInjuries:next.medical.length,choice:{session:'race'}});next.reports=next.reports.slice(-180);
  next.log.push({day:next.day,session:'race',planned:duration,minutes:duration,tss:stress,quality:100,event:'Standard-distance race'});next.log=next.log.slice(-180);
  next.races.push({day:next.day,...result});next.races=next.races.slice(-50);next.raceDay=next.day+56;next.message='Race completed. Load, tissue stress and exhaustion applied; next target is eight weeks away.';syncRestrictions(next);return next;
}
export function suggestions(s){return ['rest','swim-tech','bike-easy','run-easy'].map((session,i)=>{const choice={session,minutes:i?20:0,sleep:true,meals:true,backoff:true,care:s.medical.length?'rehab':'protect'};const p=preview(s,choice);return{id:session,label:Core.sessions[session].label,choice,minutes:p.actual};}).filter(p=>p.id==='rest'||p.minutes>=5);}
export function coach(s){const options=suggestions(s);const latest=s.reports.at(-1);const text=s.medical.length?'Protect the recovery phase. Fitness can be maintained only through activities the engine permits.':s.fatigue>50?'Exhaustion is high. A low-load day is more useful than forcing another hard session.':latest?.actual<latest?.planned?'The last session exceeded current capacity. Build from what was completed, not what was planned.':'Build repeatable sessions across all three sports. Keep an eye on tissue strain as well as Form.';return{text,options};}
export function restore(raw){
  if(!raw||typeof raw!=='object')throw Error('Invalid save.');
  if(raw.version!==3){const old=Core.restore(raw);if(!old)throw Error('Unrecognized save version.');const s=createCareer(old.p);for(const k of ['day','fit','fatigue','energy','tech','economy','brick','ctl','atl','localCTL','localATL','durability','strain','history','log'])s[k]=copy(old[k]);for(const i of old.injuries)addInjury(s,['shoulder','knee','achilles','shin','back'][i.tissue],i.severity);s.message='Prototype save migrated. New career reports start with the next session.';return s;}
  const s=copy(raw);s.p=Core.profile(s.p);
  for(const k of ['day','seed','ctl','atl','fatigue','energy','bone','soreness','timeBudget','raceDay','tech','economy','brick'])if(!Number.isFinite(s[k])||s[k]<0)throw Error('Save contains invalid '+k);
  if(!Number.isInteger(s.day)||s.day>100000||s.timeBudget<120||s.timeBudget>360)throw Error('Invalid career duration or budget.');
  for(const [k,n]of [['fit',3],['durability',3],['strain',5],['localCTL',3],['localATL',3]])if(!Array.isArray(s[k])||s[k].length!==n||s[k].some(v=>!Number.isFinite(v)||v<0||v>1000))throw Error('Invalid '+k);
  for(const k of ['adaptation','recovery','durability'])if(!s.traits||!Number.isFinite(s.traits[k])||s.traits[k]<.5||s.traits[k]>1.5)throw Error('Invalid athlete traits.');
  for(const k of ['medical','resolved','reports','log','history','races'])if(!Array.isArray(s[k])||s[k].length>200)throw Error('Invalid history.');
  for(const m of s.medical)if(!catalog[m.kind]||!['protect','rebuild','return','review'].includes(m.phase)||!Number.isFinite(m.burden)||m.burden<0||m.burden>130||!Number.isFinite(m.minDays)||m.minDays<1||!Number.isFinite(m.onset)||m.onset>s.day||!Number.isFinite(m.setback))throw Error('Invalid injury record.');
  for(const h of s.history)if(!['day','ctl','atl','form','tss'].every(k=>Number.isFinite(h[k])))throw Error('Invalid chart history.');
  for(const r of s.reports)if((r.session!=='race'&&!Core.sessions[r.session])||!['day','planned','actual','rpe','tss','quality','srpe','pain','soreness'].every(k=>Number.isFinite(r[k]))||!Array.isArray(r.reasons)||r.reasons.some(x=>typeof x!=='string')||!Array.isArray(r.notes)||r.notes.some(x=>typeof x!=='string')||!['before','after'].every(side=>r[side]&&['ctl','atl','form','exhaustion','energy','vo2','ftp'].every(k=>Number.isFinite(r[side][k])))||!Array.isArray(r.distance)||r.distance.length!==3||r.distance.some(x=>!Number.isFinite(x)))throw Error('Invalid session report.');
  for(const m of s.resolved)if(!catalog[m.kind]||!Number.isFinite(m.onset)||!Number.isFinite(m.resolved))throw Error('Invalid recovery history.');
  for(const r of s.races)if(!['day','swim','bike','run','total'].every(k=>Number.isFinite(r[k])))throw Error('Invalid race history.');
  syncRestrictions(s);return s;
}
