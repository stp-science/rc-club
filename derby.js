import {outcomes,newDerby,scores,ranked,addRace,applyOutcome} from './derby-engine.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false, wheelAngle=0, selected=new Set(), draftParticipants=new Set();
let ctx;
const clone=v=>JSON.parse(JSON.stringify(v));
const $=id=>document.getElementById(id);
export function renderDerby(context) {
  ctx=context;
  if(busy) return;
  const {data,isAdmin}=ctx, host=$('derby');if(!host) return;
  const roster=data.students.filter(s=>s.active!==false && !/^dylan e\.?$/i.test(s.name.trim()));
  const t=data.derby;
  const name=id=>data.students.find(s=>s.id===id)?.name||id;
  const checkList=(students,attr,set)=>students.map(s=>`<label class="derby-check"><input type="checkbox" ${attr}="${esc(s.id)}" ${set.has(s.id)?'checked':''}> ${esc(s.name)}</label>`).join('');
  const button=(id,text,extra='')=>`<button id="${id}" class="btn btn-primary" ${extra}>${text}</button>`;
  host.innerHTML=`<div class="derby-banner"><p class="kicker">ONE-OFF TOURNAMENT • 3 / 2 / 1 POINTS</p><h2>DEMOLITION <span>DERBY</span></h2><p>Survive the arena. Climb the table. Risk it all on the Chaos Wheel.</p><div class="derby-pills"><span>1st · 3 pts</span><span>2nd · 2 pts</span><span>3rd · 1 pt</span></div></div><p class="muted">Separate from the Winter Championship. Teacher Admin controls races and spins; everyone can view the table.</p><p id="derbyNotice" role="status" aria-live="polite"></p>`;
  if(!t) {
    host.insertAdjacentHTML('beforeend',`<div class="admin-card"><h3>Who's in the arena?</h3>${isAdmin?`<p>Choose today's drivers from the existing RC Club roster.</p><div class="derby-checks">${checkList(roster,'data-derby-student',selected)}</div><p>${button('derbyAll','Select all')} ${button('derbyStart','Start tournament',roster.length<2?'disabled':'')}</p>`:'<p>Sign in using Teacher Admin to start the tournament.</p>'}${!roster.length?'<p>The live roster is loading or has no active drivers.</p>':''}</div>`);
    if(isAdmin){$('derbyAll').onclick=()=>{selected=new Set(roster.map(s=>s.id));renderDerby(ctx);};host.querySelectorAll('[data-derby-student]').forEach(el=>el.onchange=()=>el.checked?selected.add(el.dataset.derbyStudent):selected.delete(el.dataset.derbyStudent));$('derbyStart').onclick=()=>commit(()=>{const ids=roster.filter(s=>selected.has(s.id)).map(s=>s.id);if(ids.length<2)throw Error('Choose at least two drivers.');data.derby=newDerby(ids);},'Derby started.');}
    return;
  }
  const s=scores(t), rows=ranked(t), phaseText={racing:'RACES OPEN',wheel:'CHAOS FINALE',finished:'FINAL RESULTS'}[t.phase];
  const racePoints=Object.fromEntries(t.ids.map(id=>[id,0])); t.races.forEach(r=>r.podium.forEach((id,i)=>racePoints[id]+=[3,2,1][i]));
  host.insertAdjacentHTML('beforeend',`<div class="derby-toolbar"><strong>${phaseText} · ${t.races.length} ${t.races.length===1?'race':'races'}</strong>${isAdmin?`<div>${button('derbyUndo','Undo last action',!t.history?.length?'disabled':'')} ${button('derbyReset','New tournament')}</div>`:''}</div><div class="derby-layout"><div><div class="admin-card"><h3>${t.phase==='finished'?'Final table':'Tournament table'}</h3><p class="muted small">Equal scores share a place. Spins happen in the order you choose.</p><div class="table-wrap"><table class="standings-table derby-table"><thead><tr><th>Pos</th><th>Driver</th><th>Races</th><th>Race pts</th><th>Chaos</th><th>Total</th></tr></thead><tbody>${rows.map((r,i)=>{const place=rows.findIndex(x=>x.score===r.score)+1;return `<tr class="${place<=3?'medal-row-'+place:''}"><td>${place}</td><td class="driver-name">${esc(name(r.id))}<small class="derby-decision">${t.decisions[r.id]==='spun'?'Spun':t.decisions[r.id]==='banked'?'Kept points':''}</small></td><td>${t.races.filter(x=>x.participants.includes(r.id)).length}</td><td>${racePoints[r.id]}</td><td>${s[r.id]-racePoints[r.id]>0?'+':''}${s[r.id]-racePoints[r.id]}</td><td class="total-points">${r.score}</td></tr>`;}).join('')}</tbody></table></div>${t.phase==='finished'?`<p class="derby-champion">${rows.filter(r=>r.score===rows[0].score).map(r=>esc(name(r.id))).join(' &amp; ')} ${rows.filter(r=>r.score===rows[0].score).length>1?'share the title!':'wins the derby!'}</p>`:''}</div><details class="admin-card"><summary>Race history (${t.races.length})</summary>${t.races.length?t.races.map((r,i)=>`<p><strong>Race ${i+1}</strong> · ${r.podium.map((id,j)=>`${j+1}. ${esc(name(id))} (+${[3,2,1][j]})`).join(' · ')}<br><small>Drivers: ${r.participants.map(id=>esc(name(id))).join(', ')}</small></p>`).join(''):'<p>No races yet.</p>'}</details><details class="admin-card"><summary>Chaos history (${t.events.length})</summary>${t.events.map(e=>`<p><strong>${esc(name(e.id))}: ${outcomes[e.index][0]}</strong><br>${Object.keys(e.after).filter(id=>e.before[id]!==e.after[id]).map(id=>`${esc(name(id))}: ${e.before[id]} → ${e.after[id]}`).join(' · ')||'No points changed.'}</p>`).join('')||'<p>No spins yet.</p>'}</details></div><div id="derbyControls"></div></div>`);
  const controls=$('derbyControls');
  if(t.phase==='racing') {
    controls.innerHTML=`<div class="admin-card"><h3>Add a race</h3>${isAdmin?`<p>Tick the drivers in this race, then select the podium. Everyone else scores zero.</p><div class="derby-checks">${checkList(t.ids.map(id=>({id,name:name(id)})),'data-derby-racer',draftParticipants)}</div><form id="derbyRaceForm"><div id="derbyPodium"></div><p>${button('derbyAddRace','Save race')}</p></form><hr><p>Finished racing? Close scoring and let each driver keep their points or take one spin.</p>${button('derbyOpenWheel','Finish races → Chaos Wheel',!t.races.length?'disabled':'')}`:'<p>Waiting for the teacher to record a race.</p>'}</div>`;
    if(isAdmin){const refreshPodium=()=>{const previous=[...host.querySelectorAll('[data-derby-place]')].map(el=>el.value);$('derbyPodium').innerHTML=Array.from({length:Math.min(3,draftParticipants.size)},(_,i)=>`<label class="label" for="derbyPlace${i}">${i+1}${['st','nd','rd'][i]} · ${[3,2,1][i]} points</label><select class="input" id="derbyPlace${i}" data-derby-place required><option value="">Select driver</option>${t.ids.filter(id=>draftParticipants.has(id)).map(id=>`<option value="${esc(id)}" ${previous[i]===id?'selected':''}>${esc(name(id))}</option>`).join('')}</select>`).join('');};draftParticipants=new Set([...draftParticipants].filter(id=>t.ids.includes(id)));refreshPodium();host.querySelectorAll('[data-derby-racer]').forEach(el=>el.onchange=()=>{el.checked?draftParticipants.add(el.dataset.derbyRacer):draftParticipants.delete(el.dataset.derbyRacer);refreshPodium();});$('derbyRaceForm').onsubmit=e=>{e.preventDefault();commit(()=>addRace(data.derby,[...draftParticipants],[...host.querySelectorAll('[data-derby-place]')].map(el=>el.value)),'Race saved: 3 / 2 / 1 points.');};$('derbyOpenWheel').onclick=()=>{if(confirm('Close race scoring and open the optional Chaos Wheel finale?'))commit(()=>{data.derby.phase='wheel';},'Chaos Wheel unlocked.');};}
  } else {
    const pending=t.ids.filter(id=>!t.decisions[id]);
    controls.innerHTML=`<div class="admin-card derby-wheel-card"><p class="kicker">${t.phase==='finished'?'THE CHAOS IS OVER':'KEEP YOUR POINTS… OR SPIN?'}</p><h3>The Chaos Wheel</h3><div class="derby-wheel-wrap"><div class="derby-pointer" aria-hidden="true">▼</div><canvas id="derbyWheel" width="640" height="640" role="img" aria-label="Chaos Wheel with 12 equally likely outcomes"></canvas></div><p id="derbyOutcome" class="derby-outcome" role="status" aria-live="polite">${t.events.length?esc(name(t.events.at(-1).id))+': '+outcomes[t.events.at(-1).index][0]+' — '+outcomes[t.events.at(-1).index][1]:'One spin. Twelve possibilities.'}</p>${isAdmin&&t.phase==='wheel'?`<label class="label" for="derbySpinner">Choose driver (${pending.length} undecided)</label><select class="input" id="derbySpinner"><option value="">Select driver</option>${pending.map(id=>`<option value="${esc(id)}">${esc(name(id))} · ${s[id]} pts</option>`).join('')}</select><p class="derby-wheel-actions">${button('derbySpin','SPIN THE WHEEL',!pending.length?'disabled':'')} ${button('derbyBank','Keep my points',!pending.length?'disabled':'')}</p><p class="muted small">Keeping points skips your own spin; another driver's swap or heist can still affect you. Each driver gets one choice. All 12 outcomes have equal odds.</p>${button('derbyFinish','Crown the champion',pending.length?'disabled':'')}`:''}</div>`;
    drawWheel();
    if(isAdmin&&t.phase==='wheel'){$('derbySpin').onclick=spin;$('derbyBank').onclick=()=>{const id=$('derbySpinner').value;commit(()=>{if(!id||data.derby.decisions[id])throw Error('Choose a driver who has not decided yet.');data.derby.decisions[id]='banked';},'Points kept.');};$('derbyFinish').onclick=()=>commit(()=>{data.derby.phase='finished';},'Final results saved.');}
  }
  controls.insertAdjacentHTML('beforeend',`<details class="admin-card"><summary>What's on the wheel?</summary><div class="derby-options">${outcomes.map(([title,description],i)=>`<div><b>${i+1}. ${title}</b><p>${description}</p></div>`).join('')}</div></details>`);
  if(isAdmin){$('derbyUndo').onclick=()=>commit(()=>{const history=data.derby.history||[];if(!history.length)throw Error('Nothing to undo.');data.derby={...JSON.parse(history.at(-1)),history:history.slice(0,-1)};},'Last action undone.',false);$('derbyReset').onclick=()=>{if(confirm('Start a new one-off derby? This clears only the derby tournament.'))commit(()=>{delete data.derby;selected=new Set();draftParticipants=new Set();},'Ready for a new derby.',false);};}
}
async function commit(change,message,record=true,animate) {
  if(busy||!ctx.isAdmin) return false;
  const old=ctx.data.derby?clone(ctx.data.derby):null;
  try {
    change();
    if(record&&old&&ctx.data.derby){const {history,...snapshot}=old;ctx.data.derby.history=[...(history||[]),JSON.stringify(snapshot)].slice(-50);}
    busy=true;document.querySelectorAll('#derby button,#derby select,#derby input').forEach(el=>el.disabled=true);
    const ok=await ctx.saveData(message);
    if(!ok)throw Error('Could not save the derby. Check the connection and try again.');
    if(animate)await animate();
    busy=false;ctx.renderAll();return true;
  } catch(e){if(old)ctx.data.derby=old;else delete ctx.data.derby;busy=false;ctx.renderAll();$('derbyNotice').textContent=e.message;return false;}
}
async function spin() {
  const id=$('derbySpinner').value;
  if(!id){$('derbyNotice').textContent='Choose a driver first.';return;}
  const n=new Uint32Array(1);let value;do{crypto.getRandomValues(n);value=n[0];}while(value>=4294967292);
  const index=value%outcomes.length;
  await commit(()=>applyOutcome(ctx.data.derby,id,index),'Wheel result saved.',true,async()=>{
    const wheel=$('derbyWheel'), result=$('derbyOutcome');
    result.textContent='The wheel is deciding…';
    const target=360*6+(360-((index+.5)*30))-((wheelAngle%360+360)%360);
    wheelAngle+=target;
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:4600;
    const animation=wheel.animate([{transform:wheel.style.transform||'rotate(0deg)'},{transform:`rotate(${wheelAngle}deg)`}],{duration,easing:'cubic-bezier(.12,.68,.08,1)',fill:'forwards'});
    await animation.finished;wheel.style.transform=`rotate(${wheelAngle}deg)`;animation.cancel();
    result.textContent=outcomes[index][0]+'! '+outcomes[index][1];
  });
}
function drawWheel(){
  const canvas=$('derbyWheel');if(!canvas)return;const c=canvas.getContext('2d'),size=640,center=size/2;
  const colors=['#f5b942','#b4314a','#277e83','#7153a5'];
  for(let i=0;i<12;i++){const start=-Math.PI/2+i*Math.PI/6,end=start+Math.PI/6;c.beginPath();c.moveTo(center,center);c.arc(center,center,302,start,end);c.closePath();c.fillStyle=colors[i%4];c.fill();c.strokeStyle='#121c2d';c.lineWidth=4;c.stroke();c.save();c.translate(center,center);c.rotate(start+Math.PI/12);c.fillStyle=i%4===0?'#152035':'#fff';c.font='bold 17px system-ui';c.textAlign='right';c.fillText(outcomes[i][0],283,6);c.restore();}
  c.beginPath();c.arc(center,center,56,0,2*Math.PI);c.fillStyle='#121c2d';c.fill();c.fillStyle='#fff';c.font='bold 21px system-ui';c.textAlign='center';c.fillText('CHAOS',center,center+7);canvas.style.transform=`rotate(${wheelAngle}deg)`;
}
