/* =====================================================================
   visitor.js — দর্শকের পোস্ট (খবর / স্বেচ্ছাসেবক যোগ)
   + অনুমোদিত পোস্ট সাইটের তথ্যের সাথে মিশিয়ে দেখানো
   + হোমস্ক্রিনে ইনস্টল (৫ সেকেন্ডের প্রস্তাব + সবসময়ের “Install this App” বাটন)
   rating.js থেকে লোড হয়। বাকি সাইট বদলায় না।
   ===================================================================== */
(function(){
'use strict';
var EXTRA=null;

/* ===== ১) অনুমোদিত পোস্ট সাইটের তথ্যের সাথে মেশানো ===== */
function applyExtra(){
  if(typeof DATA==='undefined')return;
  var vs=(DATA.volunteers||[]).filter(function(x){return !x._x});
  var ns=(DATA.news||[]).filter(function(x){return !x._x});
  if(EXTRA){
    vs=vs.concat((EXTRA.volunteers||[]).map(function(x){x._x=1;return x}));
    ns=(EXTRA.news||[]).map(function(x){x._x=1;return x}).concat(ns);
  }
  DATA.volunteers=vs;DATA.news=ns;
}
if(typeof build==='function'){
  var ob=build;
  window.build=function(){applyExtra();return ob.apply(this,arguments)};
}
fetch('/api/content',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){
  if(!j)return;
  EXTRA=j;
  if(((j.volunteers||[]).length||(j.news||[]).length)&&window.shown&&typeof render==='function')render();
}).catch(function(){});

/* খবরের দ্বিতীয় ছবি মডালে দেখানো */
var mc=document.getElementById('mc');
if(mc&&'MutationObserver' in window){
  new MutationObserver(function(){
    var h3=mc.querySelector('h3'),mt=mc.querySelector('.mt');
    if(!h3||!mt||mc.querySelector('[data-p2]'))return;
    var t=h3.textContent,n=null;
    (DATA.news||[]).forEach(function(x){if(x._x&&x.photo2&&x.title===t)n=x});
    if(!n||typeof im!=='function')return;
    var d=document.createElement('div');d.setAttribute('data-p2','1');d.innerHTML=im(n.photo2,n.title);
    mt.parentNode.insertBefore(d,mt);
  }).observe(mc,{childList:true});
}

/* ===== ২) পোস্ট করার পপআপ ===== */
var css=`
@property --vpa{syntax:'<angle>';initial-value:0deg;inherits:false}
#vp-fab{--vpa:0deg;position:fixed;left:16px;bottom:16px;z-index:900;background:var(--red);color:#fff;border:none;border-radius:30px;padding:12px 22px;font-size:16px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;animation:none;box-shadow:0 0 14px rgba(0,229,255,.4),0 6px 18px rgba(0,0,0,.4)}
#vp-fab::before,#vp-fab::after{content:'';position:absolute;inset:-5px;border-radius:36px;padding:2px;pointer-events:none;background:conic-gradient(from var(--vpa),transparent 0 48%,#00e5ff 68%,#ffffff 80%,#ff2bd6 92%,transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:vpSpin 2.2s linear infinite}
#vp-fab::after{padding:3px;filter:blur(5px);opacity:.95}
@keyframes vpSpin{to{--vpa:360deg}}
#vp-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:3600;display:none;align-items:flex-start;justify-content:center;padding:15px;overflow:auto}
#vp-ov.on{display:flex}
#vp-box{background:#fff;border-radius:14px;max-width:560px;width:100%;margin:auto;position:relative;animation:popin .4s both;padding:22px 20px 24px}
#vp-box .vp-x{position:absolute;top:10px;right:10px;background:var(--red);color:#fff;border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer}
#vp-box h3{font-size:24px;color:var(--dark);margin-bottom:12px;padding-right:40px}
.vp-pick{display:grid;gap:12px;margin-top:10px}
.vp-pick button{display:flex;align-items:center;gap:12px;background:#fff;border:2px solid var(--bd);border-radius:12px;padding:16px;font-size:18px;font-weight:600;color:var(--dark);cursor:pointer;text-align:left;transition:.3s}
.vp-pick button:hover{border-color:var(--red);color:var(--red);transform:translateY(-2px)}
.vp-pick i{color:var(--red);font-size:26px;width:34px;text-align:center}
.vp-f{position:relative}
.vp-f label{display:block;font-weight:600;font-size:14.5px;color:var(--dark);margin:12px 0 4px}
.vp-f label b{color:var(--red)}
.vp-f input[type=text],.vp-f input[type=tel],.vp-f input[type=url],.vp-f textarea,.vp-f select{display:block;width:100%;padding:10px 14px;border:2px solid var(--bd);border-radius:10px;font-size:15px;outline:none;background:#fff}
.vp-f textarea{min-height:90px;resize:vertical}
.vp-f input:focus,.vp-f textarea:focus,.vp-f select:focus{border-color:var(--red)}
.vp-f input[type=file]{display:block;width:100%;padding:8px;border:2px dashed var(--bd);border-radius:10px;font-size:14px;background:#fafafa}
.vp-prev{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.vp-prev img{width:90px;height:90px;object-fit:cover;border-radius:10px;border:2px solid var(--bd)}
.vp-hint{font-size:12.5px;color:#888;margin-top:4px}
.vp-msg{margin-top:10px;font-size:14.5px;font-weight:500;color:#198754}
.vp-msg.err{color:var(--red)}
.vp-back{background:none;border:none;color:var(--light);cursor:pointer;font-size:14px;margin-bottom:4px;padding:0}
.vp-pend{display:inline-block;background:#fff8e1;border:1px solid #ffe082;color:#8a6100;border-radius:20px;padding:6px 18px;font-weight:600;margin:8px 0}
.vp-f .btn{margin-top:16px}
#vp-inst{position:fixed;left:50%;bottom:86px;z-index:4000;width:calc(100% - 28px);max-width:420px;display:flex;align-items:center;gap:12px;padding:12px 14px 14px;border-radius:16px;color:#fff;background:linear-gradient(135deg,#121e31,#3b1220);border:1px solid rgba(255,255,255,.18);box-shadow:0 14px 40px rgba(0,0,0,.5);overflow:hidden;transform:translate(-50%,24px);opacity:0;animation:vpIn .45s cubic-bezier(.16,1,.3,1) forwards}
#vp-inst.out{animation:vpOut .4s ease-in forwards}
@keyframes vpIn{to{transform:translate(-50%,0);opacity:1}}
@keyframes vpOut{from{transform:translate(-50%,0);opacity:1}to{transform:translate(-50%,16px);opacity:0}}
#vp-inst>i.fa-mobile-screen-button{font-size:28px;color:#ffd54f;flex:0 0 auto}
#vp-inst .vp-it{flex:1;min-width:0;line-height:1.35}
#vp-inst .vp-it b{display:block;font-size:15.5px}
#vp-inst .vp-it span{font-size:13px;color:#ffcdd2}
#vp-inst button{flex:0 0 auto;border:none;cursor:pointer;border-radius:22px;font-weight:700}
#vp-inst .vp-go{background:#ffd54f;color:#121e31;padding:9px 16px;font-size:15px}
#vp-inst .vp-no{background:rgba(255,255,255,.14);color:#fff;width:30px;height:30px;font-size:16px;padding:0}
#vp-inst .vp-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:linear-gradient(90deg,#ffd54f,#ff5252);transform-origin:left;animation:vpBar 5s linear forwards}
@keyframes vpBar{to{transform:scaleX(0)}}
#vp-ib{position:fixed;right:12px;bottom:70px;z-index:890;display:flex;align-items:center;gap:6px;background:rgba(18,30,49,.92);color:#fff;border:1px solid rgba(255,213,79,.6);border-radius:20px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);font-family:Arial,Helvetica,sans-serif;letter-spacing:.2px}
#vp-ib i{color:#ffd54f;font-size:13px}
#vp-how{position:fixed;inset:0;z-index:4100;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.7)}
#vp-how .vp-hc{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:22px 20px;text-align:center}
#vp-how h4{font-size:20px;color:var(--dark);margin-bottom:10px}
#vp-how p{font-size:15.5px;color:#333;margin-bottom:6px}
#vp-how .btn{margin:14px 0 0}
`;
var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

var fab=document.createElement('button');fab.id='vp-fab';fab.type='button';
fab.innerHTML=`<i class='fas fa-pen-to-square'></i> পোস্ট করুন`;
document.body.appendChild(fab);
var ov=document.createElement('div');ov.id='vp-ov';ov.innerHTML=`<div id='vp-box'></div>`;
document.body.appendChild(ov);
var box=ov.firstChild;
var X=`<button class='vp-x' type='button' aria-label='বন্ধ করুন'>&times;</button>`;
function el(id){return document.getElementById(id)}
function closeBox(){ov.classList.remove('on');document.body.style.overflow=''}
function openBox(){ov.classList.add('on');document.body.style.overflow='hidden';pickStep()}
fab.onclick=openBox;
ov.addEventListener('click',function(e){if(e.target===ov||(e.target.classList&&e.target.classList.contains('vp-x')))closeBox()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeBox()});

function pickStep(){
  box.innerHTML=X+`<h3>কী পোস্ট করতে চান?</h3><div class='vp-pick'><button type='button' id='vp-k-news'><i class='fas fa-newspaper'></i> খবর পোস্ট করুন</button><button type='button' id='vp-k-vol'><i class='fas fa-hand-holding-heart'></i> স্বেচ্ছাসেবক যোগ করুন</button></div><div class='vp-hint' style='margin-top:14px'>আপনার পোস্ট ডেভেলপার দেখে অনুমোদন দিলে তবেই সাইটে প্রকাশ হবে।</div>`;
  el('vp-k-news').onclick=function(){formStep('news')};
  el('vp-k-vol').onclick=function(){formStep('volunteer')};
}

function fld(label,id,req,ph,type){
  return `<label for='vp-${id}'>${label}${req?' <b>*</b>':''}</label><input type='${type||'text'}' id='vp-${id}' placeholder='${ph||''}' maxlength='400' autocomplete='off'>`;
}
function area(label,id,req,ph,max){
  return `<label for='vp-${id}'>${label}${req?' <b>*</b>':''}</label><textarea id='vp-${id}' placeholder='${ph||''}' maxlength='${max||500}'></textarea>`;
}
function photoFld(label,req,multi){
  return `<label for='vp-file'>${label}${req?' <b>*</b>':''}</label><input type='file' id='vp-file' accept='image/*' ${multi?'multiple':''}><div class='vp-prev' id='vp-prev'></div>`;
}

function shrink(file){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,1000/Math.max(w,h));
      var c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);
      var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(u);
      c.toBlob(function(b){b?res(b):rej()},'image/jpeg',0.85);
    };
    img.onerror=function(){URL.revokeObjectURL(u);rej()};
    img.src=u;
  });
}

var ERR={
  need_submitter:'আপনার নাম লিখুন।',need_name:'স্বেচ্ছাসেবকের নাম লিখুন।',need_photo:'ছবি দিতে হবে।',need_news:'শিরোনাম ও বিস্তারিত লিখুন।',
  bad_phone:'ফোন নম্বরটি সঠিক নয়।',bad_fb:'ফেসবুক লিংকটি সঠিক নয় (https:// দিয়ে শুরু করুন)।',bad_map:'ম্যাপ লিংকটি সঠিক নয় (https:// দিয়ে শুরু করুন)।',
  img_big:'ছবিটি অনেক বড়, ছোট ছবি দিন।',img_type:'ছবিটি সঠিক নয়, JPG বা PNG দিন।',
  limit:'আজকের জন্য পোস্টের সীমা শেষ, কাল আবার চেষ্টা করুন।',busy:'এখন অনেক পোস্ট অপেক্ষায় আছে, পরে চেষ্টা করুন।'
};

function formStep(kind){
  var news=kind==='news',picked=[];
  var who=news?'আপনার নাম (যিনি খবরটি পোস্ট করছেন)':'আপনার নাম (যিনি এই স্বেচ্ছাসেবককে যোগ করছেন)';
  var body=news?
    fld('শিরোনাম','title',1,'খবরের শিরোনাম লিখুন')+
    area('বিস্তারিত','text',1,'খবরটি বিস্তারিত লিখুন',3000)+
    `<label for='vp-cat'>ক্যাটাগরি</label><select id='vp-cat'><option>স্থানীয়</option><option>শিক্ষা</option><option>ধর্মীয়</option><option>খেলাধুলা</option><option>সতর্কতা</option><option>অন্যান্য</option></select>`+
    photoFld('ছবি (সর্বোচ্চ ২টি, ঐচ্ছিক)',0,1)+
    `<label for='vp-days'>খবরটি কতদিন সাইটে থাকবে?</label><select id='vp-days'><option value='1'>১ দিন</option><option value='3'>৩ দিন</option><option value='7' selected>৭ দিন</option><option value='15'>১৫ দিন</option><option value='30'>৩০ দিন</option></select><div class='vp-hint'>সময় শেষ হলে খবরটি নিজে থেকেই আর্কাইভে চলে যাবে।</div>`
    :
    fld('নাম','name',1,'স্বেচ্ছাসেবকের পুরো নাম')+
    photoFld('ছবি',1,0)+
    fld('বাড়ির নাম','house',0,'যেমন: সরকার বাড়ি')+
    fld('ঠিকানা','address',0,'যেমন: শাহবাজপুর পূর্বপাড়া, জামালপুর সদর, জামালপুর')+
    area('পরিচিতি','about',0,'ডাকনাম, বয়স, পড়াশোনা, কাজ ইত্যাদি',500)+
    fld('ফোন নম্বর','phone',0,'যেমন: 01XXXXXXXXX','tel')+
    fld('ফেসবুক আইডির লিংক','fb',0,'https://facebook.com/...','url')+
    fld('বাড়ির গুগল ম্যাপ লিংক','map',0,'https://maps.app.goo.gl/...','url');
  box.innerHTML=X+`<button class='vp-back' type='button' id='vp-back'>← পিছনে</button><h3>${news?'খবর পোস্ট করুন':'স্বেচ্ছাসেবক যোগ করুন'}</h3><div class='vp-f'>${body}${fld(who,'sub',1,'আপনার নাম লিখুন')}<input type='text' id='vp-web' tabindex='-1' autocomplete='off' style='position:absolute;left:-9999px;opacity:0;height:0'><button class='btn' type='button' id='vp-go'><i class='fas fa-paper-plane'></i> পোস্ট জমা দিন</button><div id='vp-msg' class='vp-msg'></div><div class='vp-hint'>জমা দিলে পোস্টটি “অনুমোদনের অপেক্ষায়” থাকবে।</div></div>`;
  el('vp-back').onclick=pickStep;
  var msg=function(t,bad){var m=el('vp-msg');if(m){m.textContent=t;m.className='vp-msg'+(bad?' err':'')}};
  var val=function(id){var e=el('vp-'+id);return e?e.value.trim():''};

  el('vp-file').onchange=function(){
    var fs=[].slice.call(this.files).slice(0,news?2:1),pv=el('vp-prev');
    picked=[];pv.innerHTML='';
    if(!fs.length)return;
    msg('ছবি প্রস্তুত হচ্ছে...');
    Promise.all(fs.map(shrink)).then(function(bs){
      picked=bs;
      bs.forEach(function(b){var i=document.createElement('img');i.src=URL.createObjectURL(b);pv.appendChild(i)});
      msg('');
    }).catch(function(){picked=[];msg('ছবিটি পড়া যায়নি, অন্য ছবি দিন (JPG/PNG)।',1)});
  };

  el('vp-go').onclick=function(){
    var go=this;
    if(!val('sub')){msg('আপনার নাম লিখুন।',1);return}
    if(news){
      if(!val('title')||!val('text')){msg('শিরোনাম ও বিস্তারিত লিখুন।',1);return}
    }else{
      if(!val('name')){msg('স্বেচ্ছাসেবকের নাম লিখুন।',1);return}
      if(!picked.length){msg('ছবি দিতে হবে।',1);return}
      var f=val('fb'),m=val('map');
      if(f&&f.indexOf('http://')!==0&&f.indexOf('https://')!==0){msg(ERR.bad_fb,1);return}
      if(m&&m.indexOf('http://')!==0&&m.indexOf('https://')!==0){msg(ERR.bad_map,1);return}
    }
    var fd=new FormData();
    fd.append('kind',kind);fd.append('submitter',val('sub'));fd.append('website',val('web'));
    if(news){fd.append('title',val('title'));fd.append('text',val('text'));fd.append('cat',val('cat'));fd.append('days',val('days'))}
    else{['name','house','address','about','phone','fb','map'].forEach(function(k){fd.append(k,val(k))})}
    picked.forEach(function(b){fd.append('photo',b,'photo.jpg')});
    go.disabled=true;msg('জমা হচ্ছে...');
    fetch('/api/submit',{method:'POST',body:fd}).then(function(r){return r.json().catch(function(){return {ok:false}})}).then(function(j){
      if(j&&j.ok)done();
      else{go.disabled=false;msg(ERR[j&&j.error]||'জমা দেওয়া যায়নি, আবার চেষ্টা করুন।',1)}
    }).catch(function(){go.disabled=false;msg('ইন্টারনেট সমস্যা, আবার চেষ্টা করুন।',1)});
  };
}

function done(){
  box.innerHTML=X+`<div style='text-align:center;padding:10px 0'><div style='font-size:56px;color:#198754'><i class='fas fa-circle-check'></i></div><h3 style='padding:0'>ধন্যবাদ!</h3><p>আপনার পোস্টটি জমা হয়েছে।</p><div class='vp-pend'><i class='fas fa-hourglass-half'></i> অনুমোদনের অপেক্ষায় (Pending)</div><p class='vp-hint'>ডেভেলপার দেখে অনুমোদন দিলে পোস্টটি সাইটে প্রকাশ হবে।</p><button class='btn' type='button' id='vp-ok'>ঠিক আছে</button></div>`;
  el('vp-ok').onclick=closeBox;
}

/* ===== ৩) হোমস্ক্রিনে অ্যাপ হিসেবে ইনস্টল (PWA) =====
   • স্বাগতম পপআপের পর প্রস্তাব কার্ড ৫ সেকেন্ড দেখায়, তারপর নিজে সরে যায়
   • আর ডান পাশে সবসময় ছোট “Install this App” বাটন থাকে (ইনস্টল করা থাকলে থাকে না) */
function standalone(){return (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true}
if(!standalone()){
  var W0='https://ourvillage.rvallagena2.workers.dev';
  if(!document.querySelector('link[rel=manifest]')){
    var ml=document.createElement('link');ml.rel='manifest';ml.href=(location.origin===W0?'/manifest.webmanifest':'manifest.webmanifest');document.head.appendChild(ml);
  }
  if(!document.querySelector('meta[name=theme-color]')){
    var tc=document.createElement('meta');tc.name='theme-color';tc.content='#d32f2f';document.head.appendChild(tc);
  }
  if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){})}

  var deferred=null,shownInst=false,afterWelcome=false;
  var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;

  /* সবসময়ের “Install this App” বাটন */
  var ib=document.createElement('button');ib.id='vp-ib';ib.type='button';
  ib.innerHTML=`<i class='fas fa-download'></i> Install this App`;
  document.body.appendChild(ib);
  function howTo(){
    var h=document.createElement('div');h.id='vp-how';
    h.innerHTML=`<div class='vp-hc'><h4>Install this App</h4>`+
      (isIOS
        ?`<p>Safari এ নিচের <b>Share</b> বাটন চাপুন</p><p>তারপর <b>“Add to Home Screen”</b> বেছে নিন</p>`
        :`<p>ব্রাউজারের ওপরের <b>⋮</b> মেনু চাপুন</p><p>তারপর <b>“Install app”</b> বা <b>“Add to Home screen”</b> বেছে নিন</p>`)+
      `<button class='btn' type='button'>ঠিক আছে</button></div>`;
    document.body.appendChild(h);
    function cl(){if(h.parentNode)h.parentNode.removeChild(h)}
    h.addEventListener('click',function(e){if(e.target===h||(e.target.classList&&e.target.classList.contains('btn')))cl()});
  }
  ib.onclick=function(){
    if(deferred){var d=deferred;deferred=null;d.prompt();if(d.userChoice)d.userChoice.catch(function(){});return}
    howTo();
  };

  /* প্রস্তাব কার্ড (৫ সেকেন্ড) */
  function showInstall(){
    if(shownInst||!afterWelcome)return;
    if(!deferred&&!isIOS)return;
    shownInst=true;
    var b=document.createElement('div');b.id='vp-inst';
    b.innerHTML=deferred
      ?`<i class='fas fa-mobile-screen-button'></i><div class='vp-it'><b>হোমস্ক্রিনে অ্যাপ হিসেবে রাখুন</b><span>এক ট্যাপে সাইট খুলুন</span></div><button class='vp-go' type='button'>ইনস্টল</button><button class='vp-no' type='button' aria-label='বন্ধ করুন'>&times;</button><i class='vp-bar'></i>`
      :`<i class='fas fa-mobile-screen-button'></i><div class='vp-it'><b>হোমস্ক্রিনে রাখুন</b><span>শেয়ার বাটন চেপে “Add to Home Screen” বেছে নিন</span></div><button class='vp-no' type='button' aria-label='বন্ধ করুন'>&times;</button><i class='vp-bar'></i>`;
    document.body.appendChild(b);
    var gone=false;
    function hideInst(){
      if(gone)return;gone=true;
      b.classList.add('out');
      setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b)},450);
    }
    var no=b.querySelector('.vp-no');if(no)no.onclick=hideInst;
    var go=b.querySelector('.vp-go');
    if(go)go.onclick=function(){
      hideInst();
      if(deferred){var d=deferred;deferred=null;d.prompt();if(d.userChoice)d.userChoice.catch(function(){})}
    };
    setTimeout(hideInst,5000);
  }
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;showInstall()});
  window.addEventListener('appinstalled',function(){
    deferred=null;
    var x=document.getElementById('vp-inst');if(x&&x.parentNode)x.parentNode.removeChild(x);
    if(ib.parentNode)ib.parentNode.removeChild(ib);
  });
  setTimeout(function(){afterWelcome=true;showInstall()},3200);
}
})();
