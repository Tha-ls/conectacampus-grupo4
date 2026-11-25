'use strict';
window.CC_API=(()=>{
 const config=window.CC_CONFIG||{};
 const url=String(config.url||'').replace(/\/+$/,'');
 const key=String(config.publicKey||'');
 function isPublicKey(){if(key.startsWith('sb_publishable_'))return true;try{const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(part)).role==='anon';}catch{return false;}}
 const online=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)&&isPublicKey();
 const invalidConfig=!!(url||key)&&!online;
 const STORE='cc-local-preview-responses-v2';
 async function request(path,{method='GET',body,token,headers={}}={}){
  if(!online)throw new Error('Banco de dados ainda não configurado.');
  const h={apikey:key,...headers}; if(token)h.Authorization='Bearer '+token;else if(key.startsWith('eyJ'))h.Authorization='Bearer '+key;
  if(body)h['Content-Type']='application/json';
  const response=await fetch(url+path,{method,headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const raw=await response.text(); let data;try{data=JSON.parse(raw)}catch{data=raw;}
  if(!response.ok){const e=new Error(data?.message||data?.msg||data?.error_description||`HTTP ${response.status}`);e.status=response.status;e.code=data?.code;throw e;}return data;
 }
 function localRows(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}}
 async function submit(row){if(invalidConfig)throw new Error('Configuração inválida.');if(!online){const list=localRows();if(!list.some(r=>r.id===row.id))list.push({...row,created_at:new Date().toISOString()});localStorage.setItem(STORE,JSON.stringify(list));return {local:true};}
  try{await request('/rest/v1/cc_responses',{method:'POST',body:row,headers:{Prefer:'return=minimal'}})}catch(e){if(e.status!==409||e.code!=='23505')throw e;}return {local:false};
 }
 async function login(email,password){return request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})}
 async function rows(token){const output=[];for(let offset=0;;offset+=500){const data=await request(`/rest/v1/cc_responses?select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}`,{token});if(!Array.isArray(data))throw new Error('Resposta inesperada do banco.');output.push(...data);if(data.length<500)break;}return output;}
 async function authorized(token){const data=await request('/rest/v1/rpc/cc_is_admin',{method:'POST',token,body:{}});return data===true;}
 const FEEDBACK_STORE='cc-local-preview-feedback-v3';
 function localFeedback(){try{return JSON.parse(localStorage.getItem(FEEDBACK_STORE)||'[]')}catch{return []}}
 async function submitFeedback(row){if(invalidConfig)throw new Error('Configuração inválida.');if(!online){const list=localFeedback();if(!list.some(r=>r.id===row.id))list.push({...row,created_at:new Date().toISOString()});localStorage.setItem(FEEDBACK_STORE,JSON.stringify(list));return {local:true};}try{await request('/rest/v1/cc_feedback',{method:'POST',body:row,headers:{Prefer:'return=minimal'}})}catch(e){if(e.status!==409||e.code!=='23505')throw e;}return {local:false};}
 async function feedbackRows(token){const output=[];for(let offset=0;;offset+=500){const data=await request(`/rest/v1/cc_feedback?select=*&order=created_at.asc,id.asc&limit=500&offset=${offset}`,{token});if(!Array.isArray(data))throw new Error('Resposta inesperada do banco.');output.push(...data);if(data.length<500)break;}return output;}
 return {online,invalidConfig,submit,login,rows,authorized,localRows,submitFeedback,feedbackRows,localFeedback};
})();
