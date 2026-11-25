'use strict';
const $ = id => document.getElementById(id);
const params=new URLSearchParams(location.search);
const study=params.get('study')==='1';
const version=params.get('version')==='A'?'A':'B';
const KEY=study?'cc-study-'+(params.get('session')||'local')+'-'+version:'conectacampus-reminder-v2';
function emit(event,extra={}){if(study&&parent!==window)parent.postMessage({source:'cc-prototype',event,...extra},location.origin==='null'?'*':location.origin);}
if(study){document.body.classList.add('study');if(version==='A')document.body.classList.add('legacy');document.querySelector('.lab').hidden=true;}

const pad = n => String(n).padStart(2,'0');
const dateValue = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const timeValue = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const format = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} às ${timeValue(d)}`;
let deadline = params.has("deadline") && Number.isFinite(Date.parse(params.get("deadline"))) ? new Date(params.get("deadline")) : new Date(2026,10,30,23,59);
if(!params.has("deadline") && deadline.getTime()-Date.now()<48*3600000){deadline = new Date();deadline.setDate(deadline.getDate()+4);deadline.setHours(23,59,0,0);}
let reminder = null, busy = false, editing = false, opener = null;
try {const data=JSON.parse(localStorage.getItem(KEY));if(data && Number.isFinite(new Date(data.when).getTime())) reminder=data;}catch{}
if(study&&params.get("seed")==="1"&&!reminder){reminder={when:new Date(deadline.getTime()-86400000).toISOString(),sent:false};persist(reminder);}
let frozen=false, previousReminder=null;
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
function persist(value){try{if(value)localStorage.setItem(KEY,JSON.stringify(value));else localStorage.removeItem(KEY);return true;}catch{return false;}}
function notify(text){$('notice').textContent=text;}
function pageError(text){$('page-error').textContent=text;}
function render(){
  const active=!!reminder&&!reminder.sent;
  $('reminder').classList.toggle('active',active);
  $('switch').setAttribute('aria-checked',String(active));
  $('switch').setAttribute('aria-label',active?`Lembrete ativo para ${format(new Date(reminder.when))}`:'Lembrete de entrega inativo');
  $('state').textContent=active?'Lembrete ativo':reminder?.sent?'Lembrete enviado (simulação)':'Nenhum lembrete ativo';
  $('state-detail').textContent=reminder?format(new Date(reminder.when)):'Programe um aviso antes do prazo.';
  const delta=active?Math.round((deadline-new Date(reminder.when))/60000):0; $('schedule-summary').hidden=!active||version==='A'; $('schedule-summary').textContent=delta>=0?`Aviso ${Math.floor(delta/1440)?Math.floor(delta/1440)+'d ':''}${Math.floor(delta%1440/60)?Math.floor(delta%1440/60)+'h ':''}${delta%60?delta%60+'min ':''}antes da entrega.`:'';
  $('configure').textContent=active?'Editar lembrete':'Ativar lembrete';
  $('disable').hidden=!active;
  $('simulate').disabled=!active||busy;
  $('switch').disabled=busy;$('configure').disabled=busy;$('disable').disabled=busy;
  $('reset').disabled=busy;
  if(study&&version==='A'){$('state').textContent='Lembrete de entrega';$('state-detail').hidden=true;$('configure').hidden=true;$('disable').hidden=true;$('switch').setAttribute('aria-label','Lembrete de entrega');}
}
function choice(){return new Date(`${$('date').value}T${$('time').value}`);}
let lastValidation="";
function validate(){
  const d=choice();let msg='';
  if(!$('date').value||!$('time').value||!Number.isFinite(d.getTime()))msg='Preencha a data e o horário.';
  else if(d<=new Date()||d>deadline)msg='Escolha uma data e horário entre agora e o prazo final da atividade.';
  $('validation').textContent=msg;
  for(const id of ['date','time'])$(id).setAttribute('aria-invalid',String(!!msg));
  $('save').disabled=busy||!!msg; if(msg && $('date').value && $('time').value && msg!==lastValidation){emit('invalid');} lastValidation=msg; return !msg;
}
function markPreset(hours){document.querySelectorAll('[data-hours]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.hours)===hours)));$('custom').setAttribute('aria-pressed',String(hours===null));}
function fill(d){$('date').value=dateValue(d);$('time').value=timeValue(d);}
function setPreset(hours){const d=new Date(deadline.getTime()-hours*3600000);fill(d);markPreset(hours);validate();}
function clearSaveError(){$('save-error').textContent='';$('open-settings').hidden=true;$('save').textContent=editing?'Atualizar lembrete':'Salvar lembrete';}
function openEditor(source){if(busy)return;previousReminder=null;$('undo').hidden=true;opener=source;editing=!!reminder&&!reminder.sent;notify('');pageError('');$('editor-title').textContent=editing?'Editar lembrete':'Configurar lembrete';clearSaveError();$('processing').textContent='';
  if(editing){fill(new Date(reminder.when));markPreset(null);}else{const d=new Date(deadline.getTime()-86400000);if(d>new Date())setPreset(24);else{fill(new Date(Math.min(deadline.getTime(),Date.now()+3600000)));markPreset(null);}}
  $('editor').showModal();validate();$('date').focus();
}
function setBusy(value){busy=value;for(const el of $('editor-form').querySelectorAll('button,input'))el.disabled=value;validate();render();}
function closeEditor(){if(busy)return;$('editor').close();opener?.focus();}
async function save(event){event.preventDefault();if(busy||!validate())return;clearSaveError();const selected=choice();
  if($('blocked').checked){$('save-error').textContent='As notificações estão desativadas. Ative-as nas configurações para receber o alerta.';$('open-settings').hidden=false;return;}
  setBusy(true);$('processing').textContent='Salvando lembrete...';$('save').textContent='Salvando...';$('save').classList.add('busy');await sleep(850);
  $('save').classList.remove('busy');$('processing').textContent='';if(frozen)return;setBusy(false);
  if($('offline').checked){$('offline').checked=false;emit('failure',{operation:editing?'edited':'activated'});$('save-error').textContent='Não foi possível salvar o lembrete. Verifique sua conexão e tente novamente.';$('save').textContent='Tentar novamente';return;}
  if($('blocked').checked){clearSaveError();$('save-error').textContent='As notificações estão desativadas. Ative-as nas configurações para receber o alerta.';$('open-settings').hidden=false;return;}
  if(!validate())return;
  const next={when:selected.toISOString(),sent:false};if(!persist(next)){$('save-error').textContent='Não foi possível guardar o lembrete neste navegador. Tente novamente.';$('save').textContent='Tentar novamente';return;}
  reminder=next;render();closeEditor();notify(`Lembrete ${editing?'atualizado':'programado'} para ${format(selected)}.`);emit(editing?'edited':'activated',{when:next.when});
}
async function deactivate(){if(busy||!reminder||reminder.sent)return;notify('Desativando lembrete...');pageError('');busy=true;render();await sleep(650);if(frozen)return;busy=false;
  if($('offline').checked||!persist(null)){$('offline').checked=false;notify('');pageError('Não foi possível desativar o lembrete. Ele continua ativo. Tente novamente.');render();$('disable').focus();return;}
  previousReminder=reminder;reminder=null;render();$('undo').hidden=study;notify('Lembrete desativado.');emit('deactivated');$('configure').focus();
}
$('deadline').textContent=format(deadline);$('limit').textContent=`Prazo máximo: ${format(deadline)}.`;
if(!study)$('date').max=dateValue(deadline);
$('configure').addEventListener('click',e=>openEditor(e.currentTarget));
$('switch').addEventListener('click',e=>{if(study&&version==='A'){if(reminder){if(persist(null)){reminder=null;render();emit('deactivated');}}else{const d=new Date(deadline.getTime()-86400000);const next={when:d.toISOString(),sent:false};if(persist(next)){reminder=next;render();emit('activated',{when:next.when});}}return;}reminder&&!reminder.sent?deactivate():openEditor(e.currentTarget);});
$('disable').addEventListener('click',deactivate);
$('undo').addEventListener('click',()=>{if(busy||!previousReminder)return;if(new Date(previousReminder.when)<=new Date()){previousReminder=null;$('undo').hidden=true;pageError('O horário anterior já passou. Configure outro lembrete.');return;}if(!persist(previousReminder)){pageError('Não foi possível restaurar o lembrete. Tente novamente.');return;}reminder=previousReminder;previousReminder=null;$('undo').hidden=true;render();notify('Lembrete restaurado.');$('configure').focus();});
$('close').addEventListener('click',closeEditor);$('cancel').addEventListener('click',closeEditor);
$('editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('editor-form').addEventListener('submit',save);
document.querySelectorAll('[data-hours]').forEach(b=>b.addEventListener('click',()=>{clearSaveError();setPreset(Number(b.dataset.hours));}));
$('custom').addEventListener('click',()=>{markPreset(null);$('date').focus();});
for(const id of ['date','time'])$(id).addEventListener('input',()=>{markPreset(null);clearSaveError();validate();});
$('open-settings').addEventListener('click',()=>{$('blocked').checked=false;clearSaveError();$('save').focus();$('processing').textContent='Notificações habilitadas na simulação. Salve novamente.';});
$('motion').addEventListener('change',()=>document.body.classList.toggle('reduce-motion',$('motion').checked));
$('simulate').addEventListener('click',()=>{if(!reminder||reminder.sent||busy)return;const next={...reminder,sent:true};if(!persist(next)){pageError('Não foi possível guardar a simulação.');return;}reminder=next;render();notify('Disparo de lembrete simulado. Nenhuma notificação real foi enviada.');});
$('reset').addEventListener('click',()=>{if(busy)return;if(!persist(null)){pageError('Não foi possível limpar o armazenamento.');return;}reminder=null;previousReminder=null;$('undo').hidden=true;$('offline').checked=false;$('blocked').checked=false;$('motion').checked=false;document.body.classList.remove('reduce-motion');notify('');pageError('');render();$('configure').focus();});
render();

if(!study){try{localStorage.setItem('cc-demo-visited-v3','1')}catch{}}
if(study){
 document.addEventListener('click',e=>{if(e.target.closest('button,input'))emit('click');},true);
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='cc-study')return;if(e.data.command==='fail-next')$('offline').checked=true;if(e.data.command==='freeze'){frozen=true;if($('editor').open)$('editor').close();document.querySelectorAll('button,input').forEach(x=>x.disabled=true);}});
 emit('ready',{deadline:deadline.toISOString()});
}
