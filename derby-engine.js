export const outcomes = [
  ['LEADER SWAP', 'Swap points with the leader. Already leading? Swap with last place!'],
  ['DOUBLE UP', 'Double your current points.'],
  ['SCRAPYARD', 'Go straight to the bottom: one point below the lowest other score (may be negative).'],
  ['TURBO +5', 'Gain five bonus points.'],
  ['HALF TANK', 'Lose half your points, rounded down to a whole score.'],
  ['POINTS HEIST', 'Take up to three points from the highest-scoring other driver.'],
  ['OIL SLICK −3', 'Lose three points, stopping at zero.'],
  ['LUCKY ESCAPE', 'Nothing changes. You survive the chaos!'],
  ['MIRROR SWAP', 'Swap points with the driver at the opposite end of the table.'],
  ['PIT BONUS +2', 'Gain two bonus points.'],
  ['ENGINE FAILURE', 'Your score drops to zero.'],
  ['CATCH UP', 'Gain three points, plus two extra if you are currently last.']
];
export function newDerby(ids) { return {version:1, phase:'racing', ids:[...ids], races:[], decisions:{}, events:[]}; }
export function scores(t) {
  const s=Object.fromEntries(t.ids.map(id=>[id,0]));
  for(const r of t.races) r.podium.forEach((id,i)=>{if(id) s[id]+=[3,2,1][i];});
  for(const e of t.events) Object.assign(s,e.after);
  return s;
}
export function ranked(t) { const s=scores(t);return t.ids.map(id=>({id,score:s[id]})).sort((a,b)=>b.score-a.score || t.ids.indexOf(a.id)-t.ids.indexOf(b.id)); }
export function addRace(t, participants, podium) {
  if(t.phase!=='racing') throw Error('Race scoring is closed.');
  if(participants.length<2 || new Set(participants).size!==participants.length || participants.some(id=>!t.ids.includes(id))) throw Error('Select at least two different drivers.');
  const count=Math.min(3,participants.length);
  if(podium.length!==count || new Set(podium).size!==count || podium.some(id=>!participants.includes(id))) throw Error('Choose a different driver for each podium position.');
  t.races.push({participants:[...participants],podium:[...podium]});
}
export function applyOutcome(t,id,index) {
  if(t.phase!=='wheel' || !t.ids.includes(id) || t.decisions[id]) throw Error('This driver cannot spin now.');
  if(!outcomes[index]) throw Error('Unknown wheel result.');
  const rows=ranked(t), s=scores(t), before={...s}, others=rows.filter(r=>r.id!==id);
  const swap=other=>{if(other) [s[id],s[other.id]]=[s[other.id],s[id]];};
  switch(index) {
    case 0: swap(rows[0].id===id ? others.at(-1) : others[0]); break;
    case 1: s[id]*=2; break;
    case 2: s[id]=Math.min(...others.map(r=>r.score))-1; break;
    case 3: s[id]+=5; break;
    case 4: s[id]=Math.floor(s[id]/2); break;
    case 5: {const other=others[0]; if(other){const n=Math.min(3,Math.max(0,s[other.id]));s[other.id]-=n;s[id]+=n;}break;}
    case 6: s[id]=Math.max(0,s[id]-3); break;
    case 7: break;
    case 8: swap(rows[rows.length-1-rows.findIndex(r=>r.id===id)]); break;
    case 9: s[id]+=2;break;
    case 10: s[id]=0;break;
    case 11: s[id]+=3+(before[id]===Math.min(...Object.values(before))?2:0);break;
  }
  t.decisions[id]='spun';t.events.push({id,index,before,after:s});
  return s;
}
