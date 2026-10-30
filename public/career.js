// Persistent game progression. XP unlocks events; practiced skills affect execution.
// No real-time clock, daily-login rewards, equipment purchases or hidden level speed boost.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const events={
  rookie:{name:'First Light',subtitle:'Super-sprint · the first finish',level:1,distance:[.3,8,2],course:'flat',par:2400,medals:[1800,2100,2400],color:'#75f0c5'},
  harbour:{name:'Harbour Loop',subtitle:'Sprint · find your rhythm',level:3,distance:[.75,20,5],course:'flat',par:5400,medals:[4200,4800,5400],color:'#7ebdff'},
  metro:{name:'Metro Classic',subtitle:'Standard · build your engine',level:6,distance:[1.5,40,10],course:'rolling',par:10800,medals:[8400,9600,10800],color:'#c3a4ff'},
  summit:{name:'Summit Circuit',subtitle:'Standard · earn every metre',level:10,distance:[1.5,40,10],course:'hilly',par:11700,medals:[9000,10200,11700],color:'#ffb978'}
};
export function initializeProgression(s){
  s.progression={startedDay:s.day,xp:0,trainingDays:0,minutes:[0,0,0],gymMinutes:0,mastery:[0,0,0],raceCraft:0,finishes:0,bests:{},medals:{}};
  return s.progression;
}
export const levelFloor=level=>level<=1?0:Math.round(180*Math.pow(level-1,1.65));
export function careerStats(s){
  const p=s.progression;let level=1;while(level<50&&p.xp>=levelFloor(level+1))level++;
  const from=levelFloor(level),to=levelFloor(level+1);
  return {level,rank:level>=30?'Elite contender':level>=18?'Veteran':level>=10?'Circuit racer':level>=6?'Club athlete':level>=3?'Developing athlete':'Rookie',
    season:Math.floor(s.day/365)+1,seasonDay:s.day%365+1,years:s.day/365.25,
    totalHours:(p.minutes.reduce((a,b)=>a+b,0)+p.gymMinutes)/60,progress:level===50?100:clamp((p.xp-from)/(to-from)*100,0,100),nextXP:level===50?null:to};
}
export function recordTraining(s,report,parts){
  const p=s.progression,quality=clamp(report.quality/100,0,1);
  const xp=Math.round(Math.min(70,(report.actual||0)*.7)*quality);
  p.xp+=xp;if(report.actual>0)p.trainingDays++;
  parts.forEach((m,i)=>{p.minutes[i]+=m;p.mastery[i]=clamp(p.mastery[i]+m*.007*quality*(1-p.mastery[i]/105),0,100);});
  p.gymMinutes+=report.gym?.actual||0;
  report.xp=xp;report.level=careerStats(s).level;
}
export function recordRace(s,result){
  const p=s.progression;p.finishes++;p.raceCraft=clamp(p.raceCraft+2*(1-p.raceCraft/110),0,100);
  const id=result.eventId;
  if(id&&events[id]){
    const best=p.bests[id];if(!best||result.total<best.total)p.bests[id]={total:result.total,day:s.day};
    const medals=events[id].medals;const medal=result.total<=medals[0]?3:result.total<=medals[1]?2:result.total<=medals[2]?1:0;
    p.medals[id]=Math.max(p.medals[id]||0,medal);
  }
  p.xp+=80;
}
export function badges(s){const p=s.progression;return [
  {name:'First step',detail:'Complete your first training day',earned:p.trainingDays>=1},
  {name:'Three disciplines',detail:'Train in swim, bike and run',earned:p.minutes.every(m=>m>0)},
  {name:'First finish',detail:'Complete a race',earned:p.finishes>=1},
  {name:'Built to last',detail:'Complete 100 hours of training',earned:careerStats(s).totalHours>=100},
  {name:'One full season',detail:'365 career days and 60 training days',earned:s.day>=365&&p.trainingDays>=60},
  {name:'Long-game athlete',detail:'Three game years and 300 training hours',earned:s.day>=1095&&careerStats(s).totalHours>=300}
];}
export function validateProgression(s){
  const p=s.progression;if(!p)throw Error('Missing career progression.');
  for(const [k,max]of [['startedDay',s.day],['xp',20000000],['trainingDays',s.day],['gymMinutes',6000000],['raceCraft',100],['finishes',s.day]])if(!Number.isFinite(p[k])||p[k]<0||p[k]>max)throw Error('Invalid career '+k);
  for(const [key,max]of [['minutes',50000000],['mastery',100]])if(!Array.isArray(p[key])||p[key].length!==3||p[key].some(v=>!Number.isFinite(v)||v<0||v>max))throw Error('Invalid sport progression.');
  for(const key of ['bests','medals'])if(!p[key]||typeof p[key]!=='object'||Array.isArray(p[key])||Object.keys(p[key]).some(k=>!Object.hasOwn(events,k)))throw Error('Invalid event record.');
  for(const best of Object.values(p.bests))if(!Number.isFinite(best.total)||best.total<=0||!Number.isInteger(best.day)||best.day<0||best.day>s.day)throw Error('Invalid personal best.');
  for(const medal of Object.values(p.medals))if(!Number.isInteger(medal)||medal<0||medal>3)throw Error('Invalid medal.');
}
