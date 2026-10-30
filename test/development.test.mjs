import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/engine.js';
const rest={session:'rest',minutes:0,sleep:true,meals:true,backoff:true,care:'protect'};
const gym={...rest,gym:'foundation',gymMinutes:20,gymTarget:'lower',gymEffort:'controlled',gymGap:6};
test('all new backgrounds start with full personal potential, not full current fitness',()=>{
  for(const age of [18,30,55,85])for(const experienceYears of [0,5]){const s=G.createCareer({age,experienceYears});assert.equal(s.development.potential,100);assert.deepEqual(s.fit,[18,18,18]);assert.equal(G.Core.stats(s).ftp,240);}
});
test('age and experience inputs are bounded and consistent',()=>{for(const p of [{age:10},{age:NaN},{age:18,experienceYears:15},{musclePercent:99},{strengthYears:-1}])assert.throws(()=>G.createCareer(p));});
test('one neglected overload day cannot remove potential; rest is not punishment',()=>{
  let s=G.createCareer({age:25});s.fatigue=90;
  s=G.train(s,{...rest,session:'bike-hard',minutes:60,sleep:false,meals:false,backoff:false});assert.equal(s.development.potential,100);
  for(let i=0;i<30;i++)s=G.train(s,rest);assert.equal(s.development.potential,100);assert.equal(s.development.debt,0);
});
test('sustained under-recovery has an age-sensitive, gradual and reversible cost',()=>{
  function exposed(age,experienceYears=0){let s=G.createCareer({age,experienceYears});for(let i=0;i<30;i++){s.fatigue=90;s=G.train(s,{...gym,sleep:false,meals:false});}return s;}
  const young=exposed(25),older=exposed(65),experienced=exposed(25,10);
  assert.ok(young.development.potential<100);assert.ok(older.development.potential<young.development.potential);assert.ok(experienced.development.potential>young.development.potential);
  let recovered=young;for(let i=0;i<100;i++)recovered=G.train(recovered,rest);
  assert.ok(recovered.development.potential>young.development.potential);assert.ok(recovered.development.potential<=100);
});
test('potential constrains actual adaptation and peak performance, not just UI',()=>{
  const full=G.createCareer({age:25,experienceYears:0});full.fit=[80,80,80];const reduced=structuredClone(full);reduced.development.potential=55;
  assert.ok(G.Core.stats(reduced).ftp<G.Core.stats(full).ftp);
  const a=G.createCareer({age:25,experienceYears:0});a.fit=[2,2,2];const b=structuredClone(a);b.development.potential=55;
  const c={...rest,session:'bike-easy',minutes:30};assert.ok(G.train(a,c).fit[1]>G.train(b,c).fit[1]);
});
test('gym advances exactly one day, adds muscle load and no endurance TSS',()=>{
  const s=G.createCareer(),n=G.train(s,gym),r=n.reports[0];
  assert.equal(n.day,1);assert.equal(r.actual,20);assert.equal(r.tss,0);assert.equal(r.gym.load,80);assert.equal(r.srpe,80);
  assert.equal(n.ctl,15-15/42);assert.equal(n.development.gymCTL,80/42);assert.equal(n.development.gymATL,80/7);assert.ok(n.development.fatigue[1]>0);assert.equal(s.development.gymDays,0);
});
test('combined days have separate loads, truthful weighted RPE and atomic budget',()=>{
  const s=G.createCareer(),c={...gym,session:'bike-easy',minutes:20},n=G.train(s,c),r=n.reports[0];assert.equal(n.day,1);assert.equal(r.actual,40);assert.ok(Math.abs(r.tss-20/60*.65**2*100)<.01);assert.equal(r.srpe,+(r.enduranceActual*r.enduranceRPE+r.gym.load).toFixed(1));
  s.timeBudget=120;assert.throws(()=>G.train(s,{...c,minutes:60,gymMinutes:30}));assert.equal(s.day,0);
});
test('new lifters get technical foundation, including in imported/raw choices',()=>{
  const s=G.createCareer(),p=G.preview(s,{...gym,gym:'strength',gymMinutes:60});assert.equal(p.gym.effective,'foundation');assert.equal(p.gym.actual,25);
  assert.equal(G.preview(G.createCareer({strengthYears:1}),{...gym,gym:'strength'}).gym.effective,'strength');
});
test('femur restrictions block every gym target and no phantom load or gain is earned',()=>{
  const s=G.createCareer();G.addInjury(s,'femur');for(const gymTarget of ['upper','lower','full','core']){const n=G.train(s,{...gym,gymTarget});assert.equal(n.reports[0].actual,0);assert.equal(n.development.gymCTL,0);assert.deepEqual(n.development.strength,s.development.strength);}
});
test('regional restrictions apply to gym and core cannot bypass lower-body injury',()=>{
  const s=G.createCareer();G.addInjury(s,'knee');assert.equal(G.preview(s,gym).gym.actual,0);assert.equal(G.preview(s,{...gym,gymTarget:'upper'}).gym.actual,20);assert.equal(G.preview(s,{...gym,gym:'core',gymTarget:'upper'}).gym.actual,0);
});
test('delayed soreness, region-specific capacity and race readiness persist after gym',()=>{
  const start=G.createCareer({longSwim:60,longBike:150,longRun:90}),lift=G.train(start,gym),control=G.train(start,rest);
  assert.ok(lift.development.pending[1]>0);assert.equal(lift.development.soreness[1],0);
  const next=G.train(lift,rest);assert.ok(next.development.soreness[1]>lift.development.soreness[1]);
  assert.ok(G.developmentStats(lift).capacity[2]<G.developmentStats(lift).capacity[0]);assert.ok(G.developmentStats(lift).readiness<G.developmentStats(control).readiness);
  assert.ok(G.forecast(lift).total>G.forecast(control).total);
});
test('failure adds fatigue without a guaranteed extra strength reward',()=>{
  const s=G.createCareer({strengthYears:1}),a=G.train(s,gym),b=G.train(s,{...gym,gymEffort:'failure'});assert.ok(b.development.fatigue[1]>a.development.fatigue[1]);assert.deepEqual(b.development.strength,a.development.strength);
});
test('close hard endurance affects explosive emphasis, not every concurrent strength session',()=>{
  const s=G.createCareer({strengthYears:2}),c={...gym,session:'bike-hard',minutes:20,gym:'power'};
  assert.ok(G.train(s,{...c,gymGap:0}).development.strength[1]<G.train(s,{...c,gymGap:6}).development.strength[1]);
  assert.deepEqual(G.train(s,{...c,gym:'strength',gymGap:0}).development.strength,G.train(s,{...c,gym:'strength',gymGap:6}).development.strength);
});
test('weeks of gym improve force/economy with modest muscle change, no VO2 gift',()=>{
  let s=G.createCareer(),control=structuredClone(s);for(let i=0;i<56;i++){s=G.train(s,i%3===0?gym:rest);control=G.train(control,rest);}
  assert.ok(s.development.strength[1]>s.development.baseline);assert.ok(G.Core.stats(s).ftp>G.Core.stats(control).ftp);assert.ok(G.Core.stats(s).run<G.Core.stats(control).run);assert.ok(G.Core.stats(s).vo2<=G.Core.stats(control).vo2);assert.ok(s.development.muscleKg-s.development.initialMuscleKg<.5);
});
test('v3 migration preserves progress and current outputs; no retroactive penalty',()=>{
  const old=G.train(G.createCareer(),{...rest,session:'bike-easy',minutes:20});old.version=3;delete old.development;for(const k of ['age','experienceYears','strengthYears','musclePercent'])delete old.p[k];const before=G.Core.stats(old);
  const s=G.restore(old);assert.equal(s.version,5);assert.equal(s.day,old.day);assert.deepEqual(s.medical,old.medical);assert.deepEqual(s.history,old.history);assert.deepEqual(G.Core.stats(s),before);assert.equal(s.development.startedDay,old.day);assert.equal(s.development.potential,100);
});
test('development and gym reports roundtrip; corrupt imported state is rejected',()=>{
  const s=G.train(G.createCareer(),gym);assert.deepEqual(G.restore(JSON.parse(JSON.stringify(s))),s);
  for(const mutate of [s=>s.development.potential=101,s=>s.development.fatigue[1]='bad',s=>s.development.startedDay=99,s=>s.reports[0].gym.actual=999,s=>s.reports[0].after.potential='bad']){const bad=structuredClone(s);mutate(bad);assert.throws(()=>G.restore(bad));}
});
