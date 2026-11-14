/* ForgeRoster rule-linked datasheets and validation. Bundled and user-installed rules packs. */
(()=>{'use strict';
const P='fr-rule-packs-v1';
const $=id=>document.getElementById(id);
const style=document.createElement('style');style.textContent=`
#frLinked{max-width:1150px;margin:12px auto;padding:0 12px}#frLinked .panel{background:#151e30;border:1px solid #35445d;border-radius:14px;padding:15px}#frLinked .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#frLinked select,#frLinked input{max-width:100%;min-height:44px}#frLinked .unit{display:block;padding:12px 0;border-bottom:1px solid #34435e}#frLinked .chip{border-radius:7px;background:#2a3c5c;padding:5px 8px;margin:3px;display:inline-block;font-size:13px}#frLinked .warning{color:#ffd3a1}#frLinked details{margin:7px 0;padding:7px;border:1px solid #33435d;border-radius:8px}#frLinked summary{cursor:pointer;font-weight:650}#frLinked .muted{font-size:13px;color:#afbdd4}#frLinked .ruletext{white-space:pre-wrap;line-height:1.5}#frLinked button{min-height:44px}
`;document.head.append(style);
const root=document.createElement('section');root.id='frLinked';root.innerHTML='<div class="panel"><h2>Datasheets, keywords & legality</h2><p class="muted">Faction summaries and datasheets from versioned rules packs.</p><div id="frLinkedInfo"></div><div id="frLinkedUnits"></div><div id="frLinkedChecks"></div></div>';document.getElementById('frRules')?.after(root);
function norm(x){return String(x||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'')}
function packs(){return window.ForgeRosterRules?.getPacks() || []}
function roster(){return window.frRosterStorage.read()}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n}
function entries(){return packs().flatMap(p=>p.entries.map(e=>({...e,_pack:p})))}
function applies(e,r,u){if(e.faction&&norm(e.faction)!==norm(r.faction))return false;const detachments=Array.isArray(r.detachments)&&r.detachments.length?r.detachments:[r.detachment];if(e.detachment&&!detachments.some(selection=>norm(e.detachment)===norm(typeof selection==='string'?selection:selection?.name)))return false;if(e.unit&&norm(e.unit)!==norm(u.name))return false;return true}
function lookup(name,all,r,u){return all.filter(e=>norm(e.name)===norm(name)&&applies(e,r,u))}
function displayRule(parent,e){
const details=el('details');
details.append(el('summary',e.name+' · '+e.kind),el('p',e.text,'ruletext'));
if(e.stats)details.append(el('p',Object.entries(e.stats).map(([key,value])=>key+': '+value).join(' · ')));
for(const keyword of e.keywords||[])details.append(el('span',keyword,'chip'));
details.append(el('p',(e.references||[]).join(' · ')||e._pack.title+' · '+e._pack.version,'muted'));
parent.append(details);
}
function render(){const r=roster(),all=entries(),info=$('frLinkedInfo'),list=$('frLinkedUnits'),valid=$('frLinkedChecks');if(!info||!list||!valid)return;info.replaceChildren();list.replaceChildren();valid.replaceChildren();if(!r?.faction){info.append(el('p','Create an army to view linked rules.','muted'));return}
const scoped=all.filter(e=>!e.faction||norm(e.faction)===norm(r.faction));
info.append(el('p',scoped.length+' matching rule entries · '+r.faction,'muted'));
const armyRules=scoped.filter(e=>e.kind==='faction-rule'&&!e.unit);
if(armyRules.length){const section=el('div');section.append(el('h3','Faction rules'));for(const e of armyRules)displayRule(section,e);list.append(section)}
for(const u of r.units||[]){const card=el('div',undefined,'unit');card.append(el('strong',u.name));const combat=el('button','Combat calculator');combat.onclick=()=>window.frOpenCombat({faction:r.faction,name:u.name,id:u.id});card.append(combat);const sheet=all.find(e=>e.kind==='datasheet'&&norm(e.unit||e.name)===norm(u.name)&&applies(e,r,u));if(!sheet){const updates=scoped.filter(e=>e.kind==='errata'&&e.unit&&applies(e,r,u));if(updates.length){for(const e of updates)displayRule(card,e);list.append(card)}continue}const ds=el('details');ds.append(el('summary','Datasheet · '+sheet._pack.title+' v'+sheet._pack.version));if(sheet.text)ds.append(el('p',sheet.text,'ruletext'));if(sheet.stats&&typeof sheet.stats==='object'){const stats=el('p',Object.entries(sheet.stats).map(([k,v])=>k+': '+v).join(' · '),'muted');ds.append(stats)}card.append(ds);
for(const keyword of sheet.keywords||[]){const chip=el('span',keyword,'chip');card.append(chip);for(const def of lookup(keyword,all,r,u))displayRule(card,def)}
for(const ability of sheet.abilities||[]){const linked=lookup(ability,all,r,u);if(!linked.length)card.append(el('p','Missing ability definition: '+ability,'warning'));for(const def of linked)displayRule(card,def)}
for(const weapon of sheet.weapons||[]){const linked=lookup(weapon,all,r,u);if(!linked.length)card.append(el('p','Missing weapon profile: '+weapon,'warning'));for(const def of linked)displayRule(card,def)}
for(const rule of all.filter(e=>e.kind!=='datasheet'&&e.unit&&norm(e.unit)===norm(u.name)&&applies(e,r,u)&&!([...(sheet.keywords||[]),...(sheet.abilities||[]),...(sheet.weapons||[])].some(x=>norm(x)===norm(e.name)))))displayRule(card,rule);
list.append(card)}
const chosen=Array.isArray(r.detachments)&&r.detachments.length?r.detachments:[r.detachment];
for(const selection of chosen.filter(Boolean)){const name=typeof selection==='string'?selection:selection.name;const rules=scoped.filter(e=>e.detachment&&norm(e.detachment)===norm(name)&&!e.unit&&e.kind!=='detachment');if(rules.length){const section=el('div');section.append(el('h3',name));for(const e of rules)displayRule(section,e);list.append(section)}}
if(!list.childElementCount)valid.append(el('p','No linked rules summaries for this roster.','muted'))}
document.addEventListener('fr-roster-saved',render);document.addEventListener('fr-roster-opened',render);document.addEventListener('fr-rule-packs-changed',render);window.addEventListener('storage',e=>{if(e.key===P)render()});render();
})();
