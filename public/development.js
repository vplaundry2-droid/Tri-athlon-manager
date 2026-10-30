// Physiology-inspired GAME rules, not estimates of genetic potential or medical outcomes.
// Evidence and deliberately invented coefficients: MODEL_PRINCIPLES.md.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;
export const gymModes={
  none:{label:'No gym',rpe:0,gain:0,muscle:0},
  foundation:{label:'Movement foundation',rpe:4,gain:.18,muscle:.002},
  strength:{label:'Maximum-strength emphasis',rpe:7,gain:.38,muscle:.004},
  power:{label:'Explosive-strength emphasis',rpe:6,gain:.25,muscle:.002},
  hypertrophy:{label:'Muscle-building emphasis',rpe:7,gain:.25,muscle:.012},
  core:{label:'Trunk stability & control',rpe:4,gain:.16,muscle:.001}
};
const targets={full:[1,1,1],lower:[0,1,.35],upper:[1,0,.25],core:[.2,.2,1]};
export function initializeDevelopment(s){
  const strength=clamp(12+s.p.strengthYears*6,12,55);
  s.development={startedDay:s.day,startAge:s.p.age,experience:s.p.experienceYears,
    potential:100,debt:0,skill:clamp(s.p.strengthYears*30,0,100),
    strength:[strength,strength,strength],baseline:strength,
    muscleKg:s.p.mass*s.p.musclePercent/100,initialMuscleKg:s.p.mass*s.p.musclePercent/100,
    fatigue:[0,0,0],soreness:[0,0,0],pending:[0,0,0],
    oxidative:30,fastEndurance:30,gymCTL:0,gymATL:0,gymDays:0};
  return s.development;
}
export function developmentStats(s){
  const d=s.development;
  if(!d)return {age:s.p.age||30,potential:100,readiness:clamp(100-s.fatigue*.65-(100-s.energy)*.3,0,100),mass:s.p.mass,bonus:[0,0,0],capacity:[1,1,1]};
  const age=d.startAge+(s.day-d.startedDay)/365.25;
  const local=[d.fatigue[0]+d.fatigue[2]*.2,d.fatigue[1]+d.fatigue[2]*.2,d.fatigue[1]+d.fatigue[2]*.3];
  const delta=d.strength.map(v=>Math.max(0,v-d.baseline));
  return {age,potential:d.potential,mass:s.p.mass+d.muscleKg-d.initialMuscleKg,
    readiness:clamp(100-s.fatigue*.65-(100-s.energy)*.3-Math.max(...local)*.25-Math.max(...d.soreness)*2,0,100),
    bonus:[delta[0]*.0007,delta[1]*.0009+delta[2]*.0002,delta[1]*.0008+delta[2]*.0003],
    capacity:local.map(v=>clamp(1-v*.003+Math.max(0,d.oxidative-30)*.0003+Math.max(0,d.fastEndurance-30)*.0005,.55,1.06))};
}
export function gymPreview(s,choice,endurance){
  const mode=choice.gym||'none';if(!gymModes[mode])throw Error('Choose a gym emphasis.');
  const target=choice.gymTarget||'full';if(!targets[target])throw Error('Choose a gym muscle group.');
  const effort=choice.gymEffort||'controlled';if(!['controlled','failure'].includes(effort))throw Error('Choose gym effort.');
  const gap=Number(choice.gymGap??6);if(![0,6].includes(gap))throw Error('Choose session spacing.');
  const planned=mode==='none'?0:Number(choice.gymMinutes??30);
  if(!Number.isFinite(planned)||planned<0||planned>60||(mode!=='none'&&planned<10))throw Error('Gym duration must be 10–60 minutes.');
  const d=s.development,notes=[];
  let effective=mode,actual=planned;
  if(['strength','power'].includes(mode)&&(d?.skill??0)<20){effective='foundation';notes.push('Technical preparation comes first: the requested gym session became movement foundation.');}
  const relevant=s.medical.filter(m=>m.kind==='femur'||m.kind==='back'||effective==='core'||target==='full'||target==='core'||(target==='upper'?m.kind==='shoulder':m.kind!=='shoulder'));
  if(relevant.length){actual=0;notes.push('Gym blocked by an active injury involving this target. In-game rehabilitation is separate from gym training.');}
  const weights=effective==='core'?targets.core:targets[target];
  const fatigue=clamp((d?Math.max(...d.fatigue.map((v,i)=>v*weights[i])):0)+(gap===0?(endurance?.tss||0)*.25:0),0,100);
  const limit=Math.max(10,Math.floor((25+(d?.skill??0)*.35)*(1-fatigue*.006)));
  actual=Math.min(actual,limit);
  if(actual<planned&&actual>0)notes.push('Gym duration shortened to match technique experience and local muscle recovery.');
  const rpe=actual?clamp(gymModes[effective].rpe+(effort==='failure'?2:0)+fatigue*.025,1,10):0;
  return {mode,effective,label:gymModes[effective].label,target,effort,gap,weights,planned,actual,rpe,load:actual*rpe,notes};
}
export function advanceDevelopment(s,choice,plan,gym,previous){
  const d=s.development,prior=previous.development,notes=[];
  const age=developmentStats(s).age,ageRecovery=clamp(1-(age-30)*.006,.6,1.06);
  const support=(choice.sleep?1:.7)*(choice.meals?1:.7);
  const stimulated=plan.actual>0||gym.actual>0;
  const stress=previous.fatigue>70||Math.max(...prior.fatigue)>55||Math.max(...plan.over)>.15;
  const neglected=!choice.sleep||!choice.meals||choice.care==='ignore';
  // Debt requires actual work plus repeated under-recovery; an uncompleted request is not a dose.
  d.debt=clamp(d.debt+(stimulated&&((neglected&&stress)||(previous.fatigue>88))?1.5:-.8*support),0,60);
  const experience=d.experience+(s.day-d.startedDay)/365.25;
  const vulnerability=(1+Math.max(0,age-30)*.025)*(1+mean(previous.fit)/180)/(1+experience*.015);
  const ageLimit=clamp(100-(Math.max(0,age-40)**1.2-Math.max(0,d.startAge-40)**1.2)*.12,50,100);
  const loss=d.debt>14&&stimulated&&stress?(d.debt-14)*.0015*vulnerability*(.5+d.potential/200):0;
  const repair=d.debt<8&&support===1?.008/vulnerability:0;
  d.potential=clamp(d.potential-loss+repair,50,ageLimit);
  if(loss)notes.push('Repeated under-recovery reduced the long-term potential game index. One difficult day alone does not cause this.');
  const adaptation=clamp((d.potential/100)*ageRecovery/(1+experience*.012),.4,1.1);
  s.fit=s.fit.map((v,i)=>v>previous.fit[i]?previous.fit[i]+(v-previous.fit[i])*adaptation:v);
  const concurrent=gym.actual>0&&plan.actual>0&&plan.cfg.intensity>.8&&gym.gap===0;
  // Close hard endurance chiefly attenuates explosive adaptation, not all strength gains.
  const powerFactor=concurrent&&gym.effective==='power'?.65:1;
  const quality=clamp(1-Math.max(...prior.fatigue)*.009,.12,1)*support*clamp(1-previous.fatigue*.004,.5,1)*clamp(previous.energy/75,.2,1);
  gym.quality=Math.round(quality*100);
  const dose=gym.actual/30;
  const novelty=1-clamp(prior.skill/100,0,.85);
  const cfg=gymModes[gym.effective];
  d.fatigue=d.fatigue.map((v,i)=>clamp(v*Math.exp(-.6*ageRecovery*support)+dose*cfg.rpe*3.2*gym.weights[i]*(gym.effort==='failure'?1.5:1),0,100));
  d.soreness=d.soreness.map((v,i)=>clamp(v*.48+prior.pending[i],0,10));
  d.pending=gym.weights.map(w=>clamp(dose*cfg.rpe*.36*novelty*w*(gym.effort==='failure'?1.5:1),0,10));
  d.strength=d.strength.map((v,i)=>clamp(d.baseline+(v-d.baseline)*.998+dose*cfg.gain*gym.weights[i]*quality*adaptation*(1-v/110)*powerFactor,0,100));
  // Modelled muscle mass: tiny session changes, not a measured lean-mass or fibre-type estimate.
  d.muscleKg=d.initialMuscleKg+(d.muscleKg-d.initialMuscleKg)*.9995+dose*cfg.muscle*quality*(1-(d.muscleKg-d.initialMuscleKg)/Math.max(1,d.initialMuscleKg*.08));
  d.muscleKg=clamp(d.muscleKg,d.initialMuscleKg,d.initialMuscleKg*1.08);
  d.skill=clamp(d.skill+gym.actual*.07,0,100);if(gym.actual)d.gymDays++;
  d.oxidative=clamp(30+(d.oxidative-30)*.998+plan.actual*.002*support,0,100);
  d.fastEndurance=clamp(30+(d.fastEndurance-30)*.998+dose*.05*quality,0,100);
  d.gymCTL+=(gym.load-d.gymCTL)/42;d.gymATL+=(gym.load-d.gymATL)/7;
  s.fatigue=clamp(s.fatigue+gym.load*.055*(gym.effort==='failure'?1.3:1),0,100);
  s.energy=clamp(s.energy-gym.load*.035,0,100);
  s.soreness=Math.max(s.soreness,...d.soreness,...d.pending);
  if(gym.actual){
    const exposure=dose*(gym.effort==='failure'?12:4)*(1+Math.max(...prior.fatigue)/50);
    [gym.weights[0],gym.weights[1],gym.weights[1]*.5,0,gym.weights[2]].forEach((w,i)=>s.strain[i]=clamp(s.strain[i]+exposure*w,0,140));
    notes.push(...gym.notes,`${gym.label}: ${gym.actual} min, RPE ${gym.rpe.toFixed(1)}, ${gym.load.toFixed(0)} strength-load AU. Kept separate from endurance TSS.`);
    notes.push('Local muscle fatigue affects the next swim, ride or run; soreness can peak on a later day.');
    if(concurrent)notes.push('Hard endurance and gym were close together. Explosive-strength adaptation is reduced when relevant; strength training is not universally cancelled by endurance.');
    if(gym.effort==='failure')notes.push('Training to failure added fatigue and tissue strain, without a guaranteed extra adaptation benefit.');
  }else notes.push(...gym.notes);
  return notes;
}
export function validateDevelopment(s){
  const d=s.development;
  const ranges={startedDay:[0,s.day],startAge:[18,85],experience:[0,73],potential:[50,100],debt:[0,60],skill:[0,100],baseline:[0,100],muscleKg:[1,100],initialMuscleKg:[1,100],oxidative:[0,100],fastEndurance:[0,100],gymCTL:[0,1000],gymATL:[0,1000],gymDays:[0,s.day]};
  if(!d)throw Error('Missing athlete development.');
  for(const [k,[lo,hi]]of Object.entries(ranges))if(!Number.isFinite(d[k])||d[k]<lo||d[k]>hi)throw Error('Invalid development '+k);
  for(const [k,max]of [['strength',100],['fatigue',100],['soreness',10],['pending',10]])if(!Array.isArray(d[k])||d[k].length!==3||d[k].some(v=>!Number.isFinite(v)||v<0||v>max))throw Error('Invalid muscle '+k);
  if(d.muscleKg<d.initialMuscleKg||d.muscleKg>d.initialMuscleKg*1.080001)throw Error('Invalid modelled muscle mass.');
}
