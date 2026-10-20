// Googleログイン/ログアウト(Firebase Authentication)。Phase 1: 認証だけ。
// ・ログインしなくても従来のすべての機能が使える。設定が無い/不完全な環境ではこのファイルは何も表示せず何も読み込まない。
// ・訪問記録・メモ・localStorage・バックアップには一切触れない(読まない・書かない・消さない・移行しない)。
// ・Firebase SDK は設定がある環境でだけ、ページ表示後に gstatic から遅延読み込みする。失敗しても既存機能は止めない。
// ・認証の保持: 既定は「このタブだけ」(session)。「この端末でログインを保持する」を選んだ時だけ端末に保持(local)。共有端末では選ばない。
// ・要求するのは Google の標準(プロフィール・メール)のみ。追加の権限(Drive等)は要求しない。アクセストークンは保存しない。
(function(root){'use strict';
  if(root.OnsenAuth)return;
  const PLACEHOLDER=/^(your|change|todo|xxx|replace)/i;
  const REQUIRED=['apiKey','authDomain','projectId','appId'];
  // ログインを有効にできる環境(設定ファイルとは別に、コードで固定)。本番(production)と試験(staging)は同じFirebaseプロジェクトを共有する。
  // 環境名がこのリストにない設定・ホスト名が hosts に一致しない設定は、設定ファイルを変えても有効にならない(完全一致のホスト名だけ)。
  const ENABLED_ENVIRONMENTS=['local','staging','production'];
  const validConfig=c=>!!c&&typeof c==='object'&&REQUIRED.every(k=>typeof c[k]==='string'&&c[k].trim()!==''&&!PLACEHOLDER.test(c[k].trim()));
  // ページのホスト名に合う環境の設定を返す。どれにも当てはまらない/設定が不完全なら null(=ログイン無効)
  function resolveEnvironment(settings,hostname){
    const envs=settings&&settings.environments;if(!envs||typeof envs!=='object'||typeof hostname!=='string')return null;
    for(const [name,env] of Object.entries(envs)){
      if(ENABLED_ENVIRONMENTS.includes(name)&&env&&Array.isArray(env.hosts)&&env.hosts.includes(hostname)&&validConfig(env.config))return {name,config:env.config,sync:env.sync===true};
    }
    return null;
  }
  function sdkUrls(version){
    if(typeof version!=='string'||!/^\d+\.\d+\.\d+$/.test(version))return null;
    const base='https://www.gstatic.com/firebasejs/'+version+'/';return {app:base+'firebase-app.js',auth:base+'firebase-auth.js',firestore:base+'firebase-firestore.js'};
  }
  // SDK の読み込み(設定の loadSdk があればそれを使う=試験用)。
  async function defaultLoadSdk(settings){
    const urls=sdkUrls(settings.sdkVersion);if(!urls)throw Error('invalid-sdk-version');
    const [app,auth]=await Promise.all([import(urls.app),import(urls.auth)]);
    return {initializeApp:app.initializeApp,getAuth:auth.getAuth,GoogleAuthProvider:auth.GoogleAuthProvider,signInWithPopup:auth.signInWithPopup,signOut:auth.signOut,
      onAuthStateChanged:auth.onAuthStateChanged,setPersistence:auth.setPersistence,browserSessionPersistence:auth.browserSessionPersistence,browserLocalPersistence:auth.browserLocalPersistence,
      reauthenticateWithPopup:auth.reauthenticateWithPopup,deleteUser:auth.deleteUser};
  }
  // エラーは利用者向けの短い文言にする(エラー本文・メールアドレス等は出さない)。記録の利用には影響しないことを添える。
  const NOTE='記録は引き続きこの端末で利用できます。';
  function errorInfo(error){
    const code=String(error&&error.code||'');
    if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request'||code==='auth/user-cancelled')return {code,message:'ログインを中止しました。'+NOTE};
    if(code==='auth/popup-blocked')return {code,message:'ポップアップがブロックされました。ブラウザのポップアップを許可してから、もう一度お試しください。'+NOTE};
    if(code==='auth/network-request-failed')return {code,message:'ネットワークに接続できませんでした。接続を確認してもう一度お試しください。'+NOTE};
    if(code==='auth/unauthorized-domain')return {code,message:'このURLではログインを利用できません。'+NOTE};
    if(code==='auth/operation-not-allowed')return {code,message:'ログインは現在準備中です。'+NOTE};
    if(code==='auth/too-many-requests')return {code,message:'試行回数が多すぎます。しばらくしてからお試しください。'+NOTE};
    if(code==='auth/requires-recent-login')return {code,message:'セキュリティのため、もう一度Googleで確認(再ログイン)してから続けてください。'};
    if(code==='auth/user-mismatch'||code==='auth/user-not-found')return {code,message:'ログイン中とは別のアカウントが選ばれました。同じアカウントで確認してください。'};
    return {code:code||'unknown',message:'ログインできませんでした。時間をおいてもう一度お試しください。'+NOTE};
  }
  function create(options){
    const settings=options.settings,env=options.environment;
    const loadSdk=typeof settings.loadSdk==='function'?()=>settings.loadSdk():()=>defaultLoadSdk(settings);
    let state={status:env?'signedOut':'disabled',user:null,message:'',busy:false,sdkReady:false};
    const listeners=new Set();let sdk=null,auth=null,loading=null;
    // 内部の認証セッション(同期用)。表示用の state には UID を入れない。トークンは扱わない。generation は認証状態が変わるたびに増える
    let session={ready:false,uid:null,generation:0},fbApp=null;const sessionListeners=new Set();
    const apiSession=()=>({ready:session.ready,uid:session.uid,generation:session.generation,projectId:env.config.projectId,app:fbApp});
    const set=patch=>{state={...state,...patch};for(const fn of listeners)try{fn(state)}catch(e){}};
    // 公開するユーザー情報は表示名だけ(メール・写真・UIDは画面にも状態にも持たない)
    const toUser=u=>u?{name:String(u.displayName||'').trim()||'Googleアカウント'}:null;
    function ensureSdk(){
      if(!env)return Promise.reject(Error('disabled'));
      if(sdk)return Promise.resolve(sdk);
      if(!loading)loading=(async()=>{
        const mod=await loadSdk();
        const app=mod.initializeApp(env.config);auth=mod.getAuth(app);sdk=mod;
        fbApp=app;
        mod.onAuthStateChanged(auth,u=>{session={ready:true,uid:u&&typeof u.uid==='string'?u.uid:null,generation:session.generation+1};set({status:u?'signedIn':'signedOut',user:toUser(u),busy:false,sdkReady:true});for(const fn of sessionListeners)try{fn(apiSession())}catch(e){}},()=>set({busy:false}));
        set({sdkReady:true});return mod;
      })().catch(e=>{loading=null;throw e});
      return loading;
    }
    // 起動時: 以前のログイン状態を復元するため SDK を読み込む。失敗しても黙って未ログインのままにする(従来機能は影響なし)
    function init(){if(env)ensureSdk().catch(()=>{})}
    async function signIn(remember){
      if(!env||state.busy||state.status==='signedIn')return;
      set({busy:true,message:''});
      try{
        const mod=await ensureSdk();
        await mod.setPersistence(auth,remember?mod.browserLocalPersistence:mod.browserSessionPersistence);
        const provider=new mod.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
        await mod.signInWithPopup(auth,provider);
        set({busy:false,message:''});
      }catch(error){
        // SDK を読み込めなかった(ネットワーク/ブロック)場合は通信エラーとして案内する
        set({busy:false,message:errorInfo(sdk?error:{code:'auth/network-request-failed'}).message,status:state.status==='signedIn'?'signedIn':'signedOut'});
      }
    }
    // アカウントの削除(Firebase Authentication)。クラウドのデータを先に削除してから呼ぶこと(削除後は認証できず、データを消せなくなるため)。
    // 最近のログインが必要な操作のため、auth/requires-recent-login が返ったら reauthenticate() してからもう一度呼ぶ。
    async function reauthenticate(expectedUid){
      const mod=await ensureSdk();const u=auth.currentUser;if(!u)throw Object.assign(Error('not signed in'),{code:'auth/user-not-found'});
      if(expectedUid&&u.uid!==expectedUid)throw Object.assign(Error('account changed'),{code:'auth/user-mismatch'});
      const provider=new mod.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
      await mod.reauthenticateWithPopup(u,provider);
    }
    async function deleteAccount(expectedUid){
      const mod=await ensureSdk();const u=auth.currentUser;if(!u)throw Object.assign(Error('not signed in'),{code:'auth/user-not-found'});
      if(expectedUid&&u.uid!==expectedUid)throw Object.assign(Error('account changed'),{code:'auth/user-mismatch'});
      await mod.deleteUser(u);
    }
    async function signOut(){
      if(!env||!sdk||state.busy)return;
      set({busy:true,message:''});
      try{await sdk.signOut(auth);set({busy:false,message:''})}
      catch(error){set({busy:false,message:'ログアウトできませんでした。時間をおいてもう一度お試しください。'})}
    }
    return {init,signIn,signOut,getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},enabled:()=>!!env,
      reauthenticate,deleteAccount,getSession:apiSession,onSession:fn=>{sessionListeners.add(fn);return()=>sessionListeners.delete(fn)},syncEnabled:()=>!!env&&env.sync===true};
  }
  // 画面: ヘッダーの既存ボタン(#loginBtn)を使い、ログイン設定がある時だけ小さな行(#accountRow)を表示する。
  function bind(controller,doc){
    const $=id=>doc.getElementById(id);const btn=$('loginBtn'),row=$('accountRow');if(!btn||!row||!controller.enabled())return;
    const initialLabel=btn.textContent;
    row.hidden=false;
    const render=s=>{
      const signedIn=s.status==='signedIn';
      btn.textContent=s.busy?(signedIn?'処理中…':'ログイン中…'):signedIn?'ログアウト':'Googleでログイン';
      btn.disabled=!!s.busy;
      $('accountName').hidden=!signedIn;$('accountName').textContent=signedIn?'ログイン中: '+s.user.name:'';
      $('accountRemember').hidden=signedIn;
      const msg=$('accountMsg');msg.textContent=s.message||'';msg.hidden=!s.message;
    };
    controller.subscribe(render);render(controller.getState());
    btn.addEventListener('click',()=>{const s=controller.getState();if(s.status==='signedIn')controller.signOut();else controller.signIn(!!$('accountRememberBox').checked)});
    return {initialLabel};
  }
  const environment=resolveEnvironment(root.ONSEN_FIREBASE,root.location&&root.location.hostname);
  const api={validConfig,resolveEnvironment,sdkUrls,errorInfo,create,bind,enabledEnvironments:()=>ENABLED_ENVIRONMENTS.slice(),syncEnabled:()=>!!environment&&environment.sync===true,enabled:()=>!!environment,environmentName:()=>environment?environment.name:null};
  root.OnsenAuth=api;
  if(environment){
    const controller=create({settings:root.ONSEN_FIREBASE,environment});
    api.controller=controller;
    if(root.document){
      const start=()=>{bind(controller,root.document);controller.init()};
      if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start);else start();
    }
  }
})(typeof window!=='undefined'?window:globalThis);
