'use strict';
(() => {
 const $=s=>document.querySelector(s);
 const root=$('#mf-community'),authDialog=$('#mf-auth'),board=$('#mf-board');
 const message=(id,text)=>$(id).textContent=text;
 if(!window.supabase){message('#mf-note-status','登录服务加载失败，请刷新页面。');return;}
 const api=window.supabase.createClient('https://cblncghtvszmlmmerjpj.supabase.co','sb_publishable_zONgdhCm-duoy9PTfMbz6w_-huoVsqK',{auth:{storageKey:'morefeel-community-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 let profile=null,mode='login',loading=false,authVersion=0;
 const entrance=$('#mf-entrance');
 document.body.classList.add('mf-at-door');
 function enterCinema(){entrance.hidden=true;document.body.classList.remove('mf-at-door');document.querySelector('header').inert=false;document.querySelector('main').inert=false;document.querySelector('footer').inert=false;$('#mf-open-board').focus();}
 document.querySelector('header').inert=true;document.querySelector('main').inert=true;document.querySelector('footer').inert=true;
 $('#mf-ticket').onclick=()=>{$('#mf-admission').hidden=false;$('#mf-ticket').classList.add('mf-ticket-chosen');$('#mf-enter').focus();};
 $('#mf-enter').onclick=()=>{if(profile)enterCinema();else{renderAccount();authDialog.showModal();}};
 function renderAccount(){
  $('#mf-enter').textContent=profile?'检票完成 · 进入影院 ↗':'登录 / 注册 · 进入影院 ↗';
  $('#mf-account').textContent=profile?profile.nickname+' · 账号':'注册 / 登录';
  $('#mf-current').textContent=profile?'以「'+profile.nickname+'」的身份留言':'登录后即可留下你的留言。';
  $('#mf-logout').hidden=!profile;$('#mf-auth-form').hidden=!!profile;
  $('#mf-auth-title').textContent=profile?'你好，'+profile.nickname:mode==='login'?'登录电影院':'注册一个账号';
  $('#mf-register-fields').hidden=mode!=='register';$('#mf-nickname').required=mode==='register';
  $('#mf-password').autocomplete=mode==='login'?'current-password':'new-password';
  $('#mf-submit-auth').textContent=mode==='login'?'登录':'注册';
  $('#mf-toggle-auth').textContent=mode==='login'?'还没有账号？去注册':'已有账号？去登录';
 }
 async function restore(){
  const version=++authVersion;const {data,error}=await api.auth.getUser();
  if(version!==authVersion)return;
  if(error||!data.user){profile=null;renderAccount();return;}
  const r=await api.from('cinema_profiles').select('id,username,nickname').eq('id',data.user.id).single();
  if(version!==authVersion)return;
  if(r.error)throw Error('账号资料加载失败，请稍后重试');profile=r.data;renderAccount();
 }
 $('#mf-account').onclick=()=>{renderAccount();authDialog.showModal();};
 $('#mf-open-board').onclick=()=>{board.showModal();loadMessages();};
 root.querySelectorAll('[data-mf-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 $('#mf-toggle-auth').onclick=()=>{mode=mode==='login'?'register':'login';message('#mf-auth-status','');renderAccount();};
 $('#mf-auth-form').onsubmit=async e=>{
  e.preventDefault();const button=$('#mf-submit-auth');button.disabled=true;message('#mf-auth-status','正在处理…');
  try{
   const username=$('#mf-username').value.trim().toLowerCase(),password=$('#mf-password').value;
   const response=await fetch('https://cblncghtvszmlmmerjpj.supabase.co/functions/v1/cinema-auth',{
    method:'POST',headers:{'Content-Type':'application/json','apikey':'sb_publishable_zONgdhCm-duoy9PTfMbz6w_-huoVsqK'},
    body:JSON.stringify({action:mode,username,password,nickname:$('#mf-nickname').value.trim()}),signal:AbortSignal.timeout(30000)
   });
   const value=await response.json();if(!response.ok)throw Error(value.error||'登录失败');
   const {error}=await api.auth.setSession(value);if(error)throw error;
   await restore();$('#mf-password').value='';authDialog.close();enterCinema();message('#mf-auth-status','');
   if(board.open){await loadMessages();}
  }catch(e){message('#mf-auth-status',e.message==='Failed to fetch'?'暂时无法连接登录服务，请稍后重试':e.message);}
  finally{button.disabled=false;}
 };
 $('#mf-logout').onclick=async()=>{const {error}=await api.auth.signOut({scope:'local'});if(error){message('#mf-auth-status','退出未完成，请重试');return;}++authVersion;profile=null;renderAccount();authDialog.close();if(board.open)loadMessages();};
 function readable(error){if(error?.message?.includes('每小时'))return '留言太频繁，每小时最多 20 条。';return '操作未完成，请检查网络或重新登录后重试。';}
 async function loadMessages(){
  if(loading)return;loading=true;message('#mf-list-status','正在读取留言…');
  try{
   const data=[];
   for(let offset=0;;offset+=100){
    const result=await api.from('cinema_messages').select('id,user_id,nickname,body,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
    if(result.error)throw result.error;data.push(...result.data);if(result.data.length<100)break;
   }
   const list=$('#mf-messages');list.replaceChildren();
   for(const m of data){
    const card=document.createElement('article');card.className='mf-note';
    const body=document.createElement('p');body.textContent=m.body;
    const author=document.createElement('small');author.textContent=m.nickname+' · '+new Date(m.created_at).toLocaleString('zh-CN');card.append(body,author);
    if(profile?.id===m.user_id){
     const actions=document.createElement('div');actions.className='mf-note-actions';
     const edit=document.createElement('button');edit.type='button';edit.textContent='编辑';
     edit.onclick=async()=>{const value=prompt('修改留言（最多 500 字）',m.body);if(value===null)return;if(!value.trim()||[...value.trim()].length>500){message('#mf-note-status','留言需为 1–500 字');return;}edit.disabled=true;const {data,error}=await api.from('cinema_messages').update({body:value.trim()}).eq('id',m.id).select('id');if(error||!data.length){message('#mf-note-status',readable(error));edit.disabled=false;}else await loadMessages();};
     const del=document.createElement('button');del.type='button';del.textContent='删除';
     del.onclick=async()=>{if(!confirm('确定删除这条留言？'))return;del.disabled=true;const {data,error}=await api.from('cinema_messages').delete().eq('id',m.id).select('id');if(error||!data.length){message('#mf-note-status',readable(error));del.disabled=false;}else{await loadMessages();}};
     actions.append(edit,del);card.append(actions);
    }list.append(card);
   }
   message('#mf-list-status',data.length?'共 '+data.length+' 条回声 · 已全部展示':'还没有留言，来留下第一句话吧。');

  }catch(e){message('#mf-list-status','留言加载失败，请点击刷新重试。');}
  finally{loading=false;}
 }
 $('#mf-refresh').onclick=()=>{if(!loading){loadMessages();}};
 $('#mf-note-form').onsubmit=async e=>{
  e.preventDefault();if(!profile){authDialog.showModal();return;}
  const button=$('#mf-post');button.disabled=true;message('#mf-note-status','正在发布…');
  try{const {error}=await api.from('cinema_messages').insert({body:$('#mf-note-body').value.trim()});if(error)throw error;$('#mf-note-body').value='';message('#mf-note-status','留言已公开发布。');await loadMessages();}
  catch(e){message('#mf-note-status',readable(e));}finally{button.disabled=false;}
 };
 // Keep this callback synchronous; auth SDK callbacks must not await another auth call.
 api.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){++authVersion;profile=null;renderAccount();}});
 api.auth.getSession().then(({data})=>data.session?restore():renderAccount()).catch(()=>message('#mf-auth-status','账号加载失败，请重新登录。'));
 renderAccount();
})();
