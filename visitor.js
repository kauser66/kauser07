/* =====================================================================
   visitor.js — দর্শকের পোস্ট (খবর / স্বেচ্ছাসেবক যোগ)
   + অনুমোদিত পোস্ট সাইটের তথ্যের সাথে মিশিয়ে দেখানো
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
#vp-fab{position:fixed;left:16px;bottom:16px;z-index:900;background:var(--red);color:#fff;border:none;border-radius:30px;padding:12px 20px;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;animation:glow 2s infinite}
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
})();
