/* GA4 basic consent mode. No app records or DOM form values are read here. */
(function(root){'use strict';
  if(root.OnsenAnalytics)return;
  const config=Object.freeze({
    measurementId:'G-5P0Y0M7SNM',
    // Add a custom domain with its canonical path here after configuring GA4.
    sites:[{hostname:'uchidats.github.io',path:'/web-onsen-stamp-rally/'}],
    consentKey:'onsen-analytics-consent-v1',consentDays:180,
    pageTitle:'温泉の旅 | My Onsen Journey'
  });
  const site=root.location.protocol==='https:'&&config.sites.find(s=>s.hostname===root.location.hostname&&[s.path,s.path+'index.html'].includes(root.location.pathname));
  const canonical=site?root.location.origin+site.path:'';
  const disableKey='ga-disable-'+config.measurementId;
  let choice=null,started=false,sent=false,loading=false,tagReady=false;
  function savedChoice(){try{const saved=JSON.parse(root.localStorage.getItem(config.consentKey));return saved?.version===1&&['granted','denied'].includes(saved.choice)&&Number.isFinite(saved.expiresAt)&&saved.expiresAt>Date.now()?saved.choice:null;}catch{return null;}}
  function storeChoice(value){try{root.localStorage.setItem(config.consentKey,JSON.stringify({version:1,choice:value,expiresAt:Date.now()+config.consentDays*86400000}));}catch{/* Storage blocked: the explicit choice applies to this document only. */}}
  const $=id=>document.getElementById(id);
  function ui(){
    if($('analyticsNotice'))$('analyticsNotice').hidden=!site||choice!==null;
    if($('analyticsSettings'))$('analyticsSettings').hidden=!site;
    if($('analyticsChoice'))$('analyticsChoice').textContent=choice==='granted'?'アクセス解析：許可中':choice==='denied'?'アクセス解析：許可しない':'アクセス解析：未選択';
  }
  function eraseAnalyticsCookies(){
    for(const item of document.cookie.split(';')){
      const name=item.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;
      // Only analytics cookies. Visit records in localStorage are never cleared.
      for(const path of ['/',site.path])for(const domain of ['',root.location.hostname,'.'+root.location.hostname]){
        document.cookie=name+'=; Max-Age=0; path='+path+(domain?'; domain='+domain:'')+'; SameSite=Lax; Secure';
      }
    }
  }
  function sendPageView(){
    if(!tagReady||sent||choice!=='granted'||root[disableKey])return;
    sent=true;root.gtag('event','page_view',{send_to:config.measurementId,page_location:canonical,page_title:config.pageTitle,page_referrer:''});
  }
  function start(){
    if(!site||choice!=='granted'||started)return;
    started=true;loading=true;root[disableKey]=false;
    root.dataLayer=root.dataLayer||[];
    root.gtag=root.gtag||function(){root.dataLayer.push(arguments);};
    root.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    root.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    root.gtag('set','ads_data_redaction',true);root.gtag('set','url_passthrough',false);
    root.gtag('js',new Date());
    root.gtag('config',config.measurementId,{send_page_view:false,page_location:canonical,page_title:config.pageTitle,page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false,cookie_flags:'SameSite=Lax;Secure'});
    const script=document.createElement('script');script.id='onsenGtag';script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+config.measurementId;
    script.onload=()=>{loading=false;tagReady=true;sendPageView();};
    script.onerror=()=>{loading=false;const e=$('analyticsMessage');if(e)e.textContent='アクセス解析を読み込めませんでした。温泉の機能はそのまま利用できます。';};
    document.head.appendChild(script);
  }
  function setConsent(value){
    if(!site||!['granted','denied'].includes(value))return;
    choice=value;storeChoice(value);ui();
    if(value==='granted'){start();if(!loading)sendPageView();}
    else{
      root[disableKey]=true;eraseAnalyticsCookies();
      // Reload to unload the already-running Google tag, without a denied-mode ping.
      if(started)root.location.reload();
    }
  }
  function init(){
    if(!site){ui();return;}
    choice=savedChoice();root[disableKey]=choice!=='granted';
    $('analyticsAccept').onclick=()=>setConsent('granted');$('analyticsDecline').onclick=()=>setConsent('denied');
    $('analyticsSettings').onclick=()=>{$('analyticsNotice').hidden=false;$('analyticsDecline').focus();};
    ui();if(choice==='granted')start();
  }
  root.OnsenAnalytics=Object.freeze({config,setConsent,getConsent:()=>choice});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
