/* Pure, deterministic game model. Constants are game tuning, not clinical estimates. */
export const Core = (() => {
  const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
  const average = a => a.reduce((x,y)=>x+y,0)/a.length;
  const defaultProfile = {mass:75,height:180,vo2:52,ftp:240,swim:115,run:300,build:1,cda:null,ctl:15,atl:15,longSwim:30,longBike:60,longRun:30};
  const sports=['Swim','Bike','Run'];
  const tissueNames=['Shoulder irritation','Anterior knee pain','Achilles irritation','Shin overload','Lower-back irritation'];
  // Fictional tissue-exposure weights, NOT clinical injury probabilities.
  const tissueWeights=[[1,0.05,0,0,0.1],[0.08,0.65,0.08,0,0.9],[0,0.7,0.8,1,0.15]];
  const distribution=[0.25,0.45,0.3];
  const sessions = {
    'rest':{label:'Rest',intensity:0,weights:[0,0,0]},
    'swim-tech':{label:'Swim technique',intensity:0.5,weights:[1,0,0],tech:1},
    'swim-easy':{label:'Easy swim',intensity:0.65,weights:[1,0,0],tech:0.35},
    'swim-hard':{label:'Hard swim',intensity:0.9,weights:[1,0,0],tech:0.15},
    'bike-easy':{label:'Easy bike',intensity:0.65,weights:[0,1,0]},
    'bike-hard':{label:'Bike intervals',intensity:0.95,weights:[0,1,0]},
    'run-easy':{label:'Easy run',intensity:0.65,weights:[0,0,1],economy:0.4},
    'run-hard':{label:'Run intervals',intensity:0.95,weights:[0,0,1],economy:0.55},
    'brick':{label:'Bike → run brick',intensity:0.72,weights:[0,0.7,0.3],brick:1}
  };
  function profile(raw={}) {
    const p={...defaultProfile,...raw};
    const ranges={mass:[40,130],height:[140,210],vo2:[25,85],ftp:[80,500],swim:[65,240],run:[170,540],build:[0.94,1.06],ctl:[0,150],atl:[0,200],longSwim:[5,180],longBike:[5,300],longRun:[5,180]};
    for(const [key,[lo,hi]] of Object.entries(ranges)) { if(!Number.isFinite(+p[key]) || +p[key]<lo || +p[key]>hi) throw new Error('Check the '+key+' value.'); p[key]=+p[key]; }
    if(p.cda==='' || p.cda===null) p.cda=null;
    else if(!Number.isFinite(+p.cda) || +p.cda<0.18 || +p.cda>0.65) throw new Error('Drag area must be 0.18–0.65 m².');
    else p.cda=+p.cda;
    return p;
  }
  function create(raw) {
    const p=profile(raw);
    const s={version:2,p,day:0,fit:[18,18,18],fatigue:12,energy:90,tech:0,economy:0,brick:0,ctl:p.ctl,atl:p.atl,localCTL:distribution.map(w=>w*p.ctl),localATL:distribution.map(w=>w*p.atl),durability:[p.longSwim,p.longBike,p.longRun],strain:[0,0,0,0,0],injuries:[],history:[],log:[],message:'New season. Starting load and comfortable durations are editable assumptions.'};
    snapshot(s); return s;
  }
  function stats(s) {
    const aerobic=average(s.fit)-18;
    const vo2Factor=clamp(1+0.0022*aerobic,0.88,1.2);
    // Shared adaptation changes VO2max; baseline FTP and paces remain independent inputs.
    return {
      vo2:s.p.vo2*vo2Factor,
      ftp:s.p.ftp*clamp(1+0.003*(s.fit[1]-18)+0.0008*aerobic,0.85,1.35),
      swim:s.p.swim/clamp(1+0.0026*(s.fit[0]-18)+s.tech*0.003,0.85,1.3),
      run:s.p.run/clamp(1+0.0028*(s.fit[2]-18)+0.0008*aerobic+s.economy*0.002,0.85,1.3),
      cda:s.p.cda ?? 0.30*Math.pow(s.p.height/180,1.15)*Math.pow(s.p.mass/75,0.3)*s.p.build
    };
  }
  function snapshot(s,tss=0,form=s.ctl-s.atl) { s.history.push({day:s.day,ctl:s.ctl,atl:s.atl,form,tss}); }
  function updateLoad(s,tss,parts) {
    const form=s.ctl-s.atl;
    // TrainingPeaks' documented daily updates. Rest days have zero input.
    s.ctl+=(tss-s.ctl)/42;s.atl+=(tss-s.atl)/7;
    s.localCTL=s.localCTL.map((v,i)=>v+(parts[i]-v)/42);
    s.localATL=s.localATL.map((v,i)=>v+(parts[i]-v)/7);
    return form;
  }
  function capacity(s,sport,intensity) {
    const freshness=clamp(1-s.fatigue*0.004-Math.max(0,s.atl-s.ctl)*0.002,0.4,1);
    const fuel=clamp(s.energy/70,0.4,1);
    const conditioning=clamp(1+(s.fit[sport]-18)*0.005,0.8,1.25);
    let restriction=1;
    const rule=s.restrictions?.[sport];
    if(rule && intensity>rule.maxIF)return 0;
    for(const injury of s.injuries)if(tissueWeights[sport][injury.tissue]>=0.35)restriction=Math.min(restriction,injury.severity>=2||intensity>0.75?0:0.35);
    return Math.min(rule?.minutes??Infinity,Math.max(0,s.durability[sport]*freshness*fuel*conditioning*Math.pow(0.65/Math.max(0.45,intensity),1.5)*restriction));
  }
  function preview(s,choice) {
    const cfg=sessions[choice.session];if(!cfg)throw new Error('Choose a session.');
    const planned=choice.session==='rest'?0:+choice.minutes;
    if(!Number.isFinite(planned)||planned<0||planned>120||(choice.session!=='rest'&&planned<5))throw new Error('Choose a valid session length.');
    const comfort=cfg.weights.map((w,i)=>w?capacity(s,i,cfg.intensity):0);
    const parts=[0,0,0];let stopped=false;
    // Bricks are sequential: a failed bike leg cannot grant a free run leg.
    for(let i=0;i<3;i++)if(cfg.weights[i]&&!stopped){
      const requested=planned*cfg.weights[i];
      parts[i]=Math.floor(Math.min(requested,comfort[i]*(choice.backoff?1:1.35),s.restrictions?.[i]?.minutes??Infinity)*10)/10;
      if(parts[i]+0.1<requested)stopped=true;
    }
    const actual=parts.reduce((a,b)=>a+b,0);
    const loads=parts.map(m=>m/60*100*cfg.intensity**2);
    const tss=loads.reduce((a,b)=>a+b,0);
    const over=parts.map((m,i)=>m?Math.max(0,m/Math.max(1,comfort[i])-1):0);
    return {cfg,planned,actual,parts,loads,tss,comfort,over,partial:actual+0.1<planned,blocked:planned>0&&actual===0};
  }
  function tissueUpdate(s,plan,choice) {
    const exposure=[0,0,0,0,0],events=[];
    plan.parts.forEach((minutes,i)=>{
      if(!minutes)return;
      const dose=minutes/Math.max(5,plan.comfort[i]);
      const repeated=Math.max(0,s.localATL[i]-s.localCTL[i]-5)*0.35;
      const demand=(8*dose*Math.pow(plan.cfg.intensity/0.65,2)+45*Math.max(0,dose-0.8)**2+repeated)*(i===2?1.25:1);
      tissueWeights[i].forEach((weight,j)=>exposure[j]+=demand*weight);
    });
    s.strain=s.strain.map((v,j)=>clamp(v*(exposure[j]>2?(choice.sleep?0.94:0.98):(choice.sleep?0.78:0.88))+exposure[j]*(choice.meals?1:1.1),0,140));
    if(s.career)return []; // Career engine owns injury progression and clearance.
    const active=[];
    for(const injury of s.injuries){
      const j=injury.tissue;
      injury.recovery=clamp(injury.recovery+(exposure[j]>2?Math.min(8,exposure[j]*0.3):-(choice.sleep?8:5)*(choice.meals?1:0.8)),0,100);
      if(s.strain[j]>=105&&injury.severity<2){injury.severity=2;injury.recovery=Math.max(75,injury.recovery);events.push(tissueNames[j]+' escalated: affected sports unavailable.');}
      if(injury.recovery===0&&s.strain[j]<25)events.push(tissueNames[j]+': game restriction cleared.');else active.push(injury);
    }
    s.injuries=active;
    s.strain.forEach((v,j)=>{if(v>=75&&!s.injuries.some(x=>x.tissue===j)){s.injuries.push({tissue:j,severity:v>=105?2:1,recovery:v>=105?85:60});events.push(tissueNames[j]+': new fictional injury restriction.');}});
    return events;
  }
  function day(s,choice) {

    const plan=preview(s,choice),cfg=plan.cfg,minutes=plan.actual;
    const used=plan.planned+(choice.sleep?30:0)+(choice.meals?20:0);
    if(used>(s.timeBudget||180)) throw new Error('Plan exceeds the daily time budget.');
    const oldFat=s.fatigue,oldEnergy=s.energy;
    const overshoot=Math.max(...plan.over);
    const quality=clamp(1-oldFat/145,0.18,1)*clamp(oldEnergy/75,0.05,1)*clamp(1-overshoot*1.5,0.35,1);
    const load=plan.tss;
    const recovery=choice.sleep?1.08:0.82;
    const nourishment=choice.meals?1:0.85;
    s.fit=s.fit.map((f,i)=>clamp(f*Math.exp(-1/42)+plan.loads[i]*quality*recovery*nourishment/9*(1-f/140),0,100));
    s.tech=clamp(s.tech*0.998+(cfg.tech||0)*minutes/60*quality*recovery,0,18);
    s.economy=clamp(s.economy*0.998+(cfg.economy||0)*minutes/60*quality*recovery,0,18);
    s.brick=clamp(s.brick*0.995+(plan.parts[2]>0?(cfg.brick||0)*minutes/60*quality:0),0,12);
    s.durability=s.durability.map((v,i)=>clamp(v*0.999+(!s.injuries.some(x=>tissueWeights[i][x.tissue]>=0.35)&&plan.over[i]<=0.05?plan.parts[i]*0.05*quality:0),5,i===1?300:180));
    const hardCost=1+Math.max(0,cfg.intensity-0.7)*3;
    const recoveryRate=choice.sleep?0.34:0.23;
    s.fatigue=clamp(oldFat*Math.exp(-recoveryRate)+load*0.42*hardCost+overshoot*30,0,100);
    s.energy=clamp(oldEnergy-load*0.7-overshoot*15+(choice.meals?38:20)+(choice.sleep?4:0),0,100);
    const events=tissueUpdate(s,plan,choice);
    const form=updateLoad(s,load,plan.loads);
    s.day++;
    const q=choice.session==='rest'?1:quality;
    s.log.push({day:s.day,session:choice.session,planned:plan.planned,minutes:+minutes.toFixed(1),tss:+load.toFixed(2),quality:Math.round(q*100),sleep:!!choice.sleep,meals:!!choice.meals,backoff:!!choice.backoff,event:events.join(' ')});
    const change=Math.round(s.fatigue-oldFat);
    s.message=choice.session==='rest'?'Rest: 0 load; exhaustion '+(change>=0?'+':'')+change+' points.':cfg.label+': '+minutes.toFixed(1)+' / '+plan.planned+' min; '+load.toFixed(1)+' estimated TSS. '+(plan.blocked?'Session unavailable due to an injury restriction.':plan.partial?(choice.backoff?'Stopped at the sustainable limit.':'Could not complete the session. '):'')+(overshoot>0.05?'Overreached: extra exhaustion and tissue strain, reduced adaptation.':'');
    if(events.length)s.message+=' '+events.join(' ');
    snapshot(s,load,form);return s;
  }
  const schedules={
    balanced:[['swim-tech',45],['bike-hard',45],['run-easy',45],['swim-easy',45],['bike-easy',60],['brick',60],['rest',0]],
    hard:Array.from({length:7},()=>['bike-hard',120]),
    runOverload:Array.from({length:7},()=>['run-hard',120]),
    swimOverload:Array.from({length:7},()=>['swim-hard',120]),
    rest:Array.from({length:7},()=>['rest',0]),
    taper:[['swim-tech',30],['bike-easy',30],['run-easy',30],['rest',0],['swim-easy',30],['bike-easy',30],['rest',0]]
  };
  function week(s,kind) {
    if(!schedules[kind])throw new Error('Choose an example schedule.');
    const n=Math.min(7,56-s.day);let tapered=false;const outcomes=[];
    for(let i=0;i<n;i++){
      const finalWeek=kind==='balanced'&&s.day>=49;
      const [session,minutes]=schedules[finalWeek?'taper':kind][finalWeek?(s.day-49)%7:i];
      tapered=tapered||finalWeek;
      const overload=['hard','runOverload','swimOverload'].includes(kind);
      day(s,{session,minutes,sleep:!overload,meals:!overload,backoff:!overload});
      if(s.log.at(-1).event)outcomes.push(s.log.at(-1).event);
    }
    const recent=s.log.slice(-n),partial=recent.filter(l=>l.minutes+0.1<l.planned).length;
    s.message=n+' days simulated: '+(tapered?'mixed plan, including final-week taper':({balanced:'mixed sports with early back-off',hard:'hard cycling attempts',runOverload:'hard running attempts',swimOverload:'hard swimming attempts',rest:'rest only',taper:'reduced training volume'})[kind])+'. '+partial+' shortened sessions. '+outcomes.join(' ');
    return s;
  }
  function bikeSeconds(power,mass,cda,course) {
    const grade=course==='hilly'?0.05:course==='rolling'?0.025:0;
    const segments=grade?[[28000,0],[6000,grade],[6000,-grade]]:[[40000,0]];
    return segments.reduce((t,[distance,g])=>{
      let lo=0.2,hi=22; const totalMass=mass+10;
      for(let i=0;i<60;i++){const v=(lo+hi)/2;const required=(0.5*1.225*cda*v*v+0.005*totalMass*9.81+totalMass*9.81*g)*v/0.97;if(required>power)hi=v;else lo=v;}
      return t+distance/((lo+hi)/2);
    },0);
  }
  function race(s,policy={}) {
    const options={effort:88,course:'rolling',run:'steady',fuel:'practiced',...policy};
    if(!['flat','rolling','hilly'].includes(options.course)||!['steady','conservative','attack'].includes(options.run)||!['light','practiced','excess'].includes(options.fuel)) throw new Error('Invalid race strategy.');
    const intensity=clamp(Number(options.effort)||88,70,110)/100;
    const a=stats(s);
    const freshness=clamp(1-s.fatigue*0.0015-(100-s.energy)*0.0006-Math.max(0,s.atl-s.ctl)*0.001,0.68,1);
    // Relative VO2 sets modest endurance headroom, independent of measured pace/FTP.
    const endurance=clamp(Math.sqrt(a.vo2/52),0.75,1.25);
    const swim=a.swim*15*1.035/freshness;
    const fade=Math.max(0,intensity-0.96)**2*6/endurance;
    const power=a.ftp*intensity*freshness*(1-fade);
    const bike=bikeSeconds(power,s.p.mass,a.cda,options.course);
    const fuelDrain=swim/60*0.35+bike/60*(0.52+Math.pow(Math.max(0,intensity-0.75),2)*3);
    const replenishment=options.fuel==='light'?5:options.fuel==='practiced'?34:40;
    const runFuel=clamp(s.energy-fuelDrain+replenishment,0,100);
    const carry=0.025+Math.max(0,intensity-0.82)**2*3.4/endurance+Math.max(0,bike/3600-1)*0.02;
    const brickBenefit=clamp(s.brick*0.0015,0,0.015);
    const lowFuel=Math.max(0,48-runFuel)*0.006;
    // A restrained start costs time when fresh, but limits late fading when depleted.
    const runApproach=options.run==='conservative'?0.022-0.35*Math.max(0,carry-0.025)-0.25*lowFuel:options.run==='attack'?(-0.02+0.09*Math.max(0,intensity-0.88)/0.22+s.fatigue*0.0007+Math.max(0,55-runFuel)*0.002):0;
    const gutCost=options.fuel==='excess'?150:0;
    const baseRun=a.run*10*1.025/freshness;
    const run=baseRun*(1+carry-brickBenefit+lowFuel+runApproach)+gutCost;
    const transitions=180;
    const underprepared=[swim,bike,run].map((seconds,i)=>seconds/60>s.durability[i]*1.7*freshness?sports[i]:null).filter(Boolean);
    const status=s.injuries.length?'Injury restriction · no race start':underprepared.length?'DNF forecast · '+underprepared.join(' / ')+' durability':'Finish forecast';
    return {swim,bike,run,transitions,total:swim+bike+run+transitions,power,runFuel,carrySeconds:baseRun*(carry-brickBenefit),fuelSeconds:baseRun*lowFuel+gutCost,freshness,status,canFinish:!s.injuries.length&&!underprepared.length};
  }
  function restore(raw) {
    if(!raw||![1,2].includes(raw.version)||!Number.isInteger(raw.day)||raw.day<0||raw.day>56) return null;
    try { profile(raw.p); } catch { return null; }
    if(!Array.isArray(raw.fit)||raw.fit.length!==3||raw.fit.some(x=>!Number.isFinite(x)||x<0||x>100))return null;
    for(const k of ['fatigue','energy','tech','economy','brick'])if(!Number.isFinite(raw[k])||raw[k]<0||raw[k]>100)return null;
    if(!Array.isArray(raw.history)||raw.history.length!==raw.day+1||!Array.isArray(raw.log)||raw.log.length!==raw.day)return null;
    if(raw.version===1){
      const migrated=create(raw.p);migrated.history=[];
      snapshot(migrated);
      for(const item of raw.log){
        const session=Object.keys(sessions).find(k=>sessions[k].label===item.label);
        if(!session||!Number.isFinite(item.minutes)||item.minutes<0||item.minutes>120)return null;
        const cfg=sessions[session],tss=item.minutes/60*100*cfg.intensity**2;
        const form=updateLoad(migrated,tss,cfg.weights.map(w=>tss*w));migrated.day++;
        migrated.log.push({day:migrated.day,session,planned:item.minutes,minutes:item.minutes,tss:+tss.toFixed(2),quality:item.quality,sleep:!!item.sleep,meals:!!item.meals,backoff:false,event:''});snapshot(migrated,tss,form);
      }
      for(const k of ['fit','fatigue','energy','tech','economy','brick'])migrated[k]=JSON.parse(JSON.stringify(raw[k]));
      migrated.message='Season upgraded. Old sessions kept; historical load reconstructed from estimates. Durability uses profile starting values; injury tracking starts now.';
      return migrated;
    }
    if(!['ctl','atl'].every(k=>Number.isFinite(raw[k])&&raw[k]>=0))return null;
    for(const [key,size]of [['localCTL',3],['localATL',3],['durability',3],['strain',5]])if(!Array.isArray(raw[key])||raw[key].length!==size||raw[key].some(x=>!Number.isFinite(x)||x<0))return null;
    if(raw.history.some(h=>!['day','ctl','atl','form','tss'].every(k=>Number.isFinite(h[k]))))return null;
    if(!Array.isArray(raw.injuries)||raw.injuries.some(x=>!Number.isInteger(x.tissue)||x.tissue<0||x.tissue>4||![1,2].includes(x.severity)||!Number.isFinite(x.recovery)||x.recovery<0||x.recovery>100))return null;
    if(raw.log.some(l=>!sessions[l.session]||!['day','planned','minutes','tss','quality'].every(k=>Number.isFinite(l[k]))))return null;
    const recovered=JSON.parse(JSON.stringify(raw));recovered.p=profile(raw.p);return recovered;
  }
  return {create,profile,stats,day,week,race,restore,sessions,bikeSeconds,defaultProfile,preview,capacity,updateLoad,sports,tissueNames,tissueWeights};
})();
