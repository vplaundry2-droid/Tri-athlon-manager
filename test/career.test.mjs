import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/engine.js';
import { levelFloor } from '../public/career.js';
const rest={session:'rest',minutes:0,sleep:true,meals:true,backoff:true,care:'protect'};
test('calendar years matter without granting idle XP or mastery',()=>{
  let s=G.createCareer();for(let i=0;i<365;i++)s=G.train(s,rest);
  assert.equal(G.careerStats(s).season,2);assert.equal(s.progression.xp,0);assert.deepEqual(s.progression.mastery,[0,0,0]);assert.ok(G.developmentStats(s).age>30.99);assert.equal(G.badges(s).find(b=>b.name==='One full season').earned,false);
});
test('completed quality work earns bounded XP and sport-specific mastery',()=>{
  const s=G.createCareer(),next=G.train(s,{...rest,session:'swim-tech',minutes:20});assert.ok(next.progression.xp>0);assert.ok(next.progression.mastery[0]>0);assert.equal(next.progression.mastery[1],0);assert.equal(next.progression.minutes[0],20);assert.equal(s.progression.xp,0);assert.equal(next.reports[0].xp,next.progression.xp);
});
test('blocked sessions cannot farm progression',()=>{
  const s=G.createCareer();G.addInjury(s,'femur');const n=G.train(s,{...rest,session:'run-hard',minutes:90,gym:'strength',gymMinutes:15});assert.equal(n.progression.xp,0);assert.equal(n.progression.trainingDays,0);assert.deepEqual(n.progression.mastery,[0,0,0]);
});
test('level boundaries are exact and levels alone never grant speed',()=>{
  const s=G.createCareer(),before=G.forecast(s,{event:'rookie'}).total;s.progression.xp=levelFloor(10)-1;assert.equal(G.careerStats(s).level,9);s.progression.xp++;assert.equal(G.careerStats(s).level,10);assert.equal(G.forecast(s,{event:'rookie'}).total,before);
});
test('fixed courses override attempts to change their geometry and distance',()=>{
  const s=G.createCareer();const a=G.forecast(s,{event:'rookie'}),b=G.forecast(s,{event:'rookie',course:'hilly',distance:[4,180,42]});assert.deepEqual(a,b);assert.deepEqual(a.distance,[.3,8,2]);assert.throws(()=>G.forecast(s,{event:'unknown'}));
});
test('entry levels and health/preparation are independently enforced',()=>{
  const s=G.createCareer({longSwim:90,longBike:180,longRun:120});assert.equal(G.forecast(s,{event:'summit'}).locked,true);assert.throws(()=>G.race(s,{event:'summit'}));s.progression.xp=levelFloor(10);assert.equal(G.forecast(s,{event:'summit'}).locked,false);G.addInjury(s,'shoulder');assert.equal(G.forecast(s,{event:'rookie'}).canFinish,false);
});
test('short entry race allows a plausible beginner finish and records the actual distances',()=>{
  const s=G.createCareer({vo2:38,ftp:160,run:400,swim:150,longSwim:15,longBike:30,longRun:15});assert.ok(G.forecast(s,{event:'rookie'}).canFinish);assert.equal(G.forecast(s).canFinish,false);
  const n=G.race(s,{event:'rookie'});assert.equal(n.day,1);assert.deepEqual(n.reports[0].distance,[.3,8,2]);assert.equal(n.progression.finishes,1);assert.ok(n.progression.bests.rookie.total>0);assert.equal(n.reports[0].xp,n.progression.xp);assert.deepEqual(G.restore(n),n);
});
test('experience changes race execution on exactly the same course',()=>{
  const fresh=G.createCareer({longSwim:60,longBike:150,longRun:90}),veteran=structuredClone(fresh);veteran.progression.mastery=[80,80,80];veteran.progression.raceCraft=80;
  const a=G.forecast(fresh),b=G.forecast(veteran);assert.deepEqual(a.distance,b.distance);assert.ok(b.total<a.total*.97);assert.ok(b.transitions<a.transitions);assert.ok(b.carrySeconds<a.carrySeconds);
});
test('practice never overwrites a standardized course record',()=>{
  const s=G.createCareer({longSwim:60,longBike:150,longRun:90}),n=G.race(s);assert.deepEqual(n.progression.bests,{});assert.equal(n.progression.finishes,1);
});
test('a training week is transactional and retains all daily debriefs',()=>{
  const s=G.createCareer(),n=G.trainWeek(s);assert.equal(s.day,0);assert.equal(n.day,7);assert.equal(n.reports.length,7);assert.ok(n.progression.minutes.every(m=>m>0));assert.equal(n.progression.trainingDays,5);assert.deepEqual(G.restore(n),n);
});
test('fast-forward stops at a new injury warning',()=>{
  const s=G.createCareer();s.bone=100;const n=G.trainWeek(s);assert.equal(n.day,1);assert.ok(n.medical.length>0);assert.match(n.message,/Stopped/);
});
test('v4 migration preserves development and does not fabricate lifetime XP',()=>{
  const old=G.train(G.createCareer(),{...rest,session:'bike-easy',minutes:20});old.version=4;delete old.progression;const n=G.restore(old);assert.equal(n.version,5);assert.deepEqual(n.development,old.development);assert.equal(n.progression.startedDay,n.day);assert.equal(n.progression.xp,0);assert.equal(n.reports.length,1);
});
test('invalid career import records are rejected',()=>{
  const s=G.createCareer();for(const modify of [s=>s.progression.xp=-1,s=>s.progression.mastery[0]=101,s=>s.progression.bests.fake={total:20,day:0},s=>s.progression.medals.rookie=99]){const n=structuredClone(s);modify(n);assert.throws(()=>G.restore(n));}
});
