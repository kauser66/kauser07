/* =====================================================================
   rating.js — স্বেচ্ছাসেবকের রেটিং (পপআপ + গড় রেটিং)
   রেটিং জমা থাকে Cloudflare D1 ডাটাবেসে (/api/rate, /api/ratings)।
   শুধু #volunteers সেকশনের কার্ডে কাজ করে। বাকি সাইট বদলায় না।
   ===================================================================== */
(function(){
'use strict';

var RATINGS={};
var CUR=null;

var css=''+
'#volunteers .card{cursor:pointer}'+
'.vr-badge{display:inline-block;margin:4px 0 6px;background:#fff8e1;border:1px solid #ffe082;color:#8a6100;border-radius:20px;padding:2px 12px;font-size:13.5px;font-weight:600;font-family:\'Noto Sans Bengali\',\'Hind Siliguri\',sans-serif}'+
'.vr-badge.none{background:#f3f4f6;border-color:#e0e0e0;color:#888;font-weight:500}'+
'#vr-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:3500;display:none;align-items:center;justify-content:center;padding:15px}'+
'#vr-ov.on{display:flex}'+
'#vr-box{background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow:auto;position:relative;animation:popin .4s both}'+
'#vr-box .vr-x{position:absolute;top:10px;right:10px;background:var(--red);color:#fff;border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;z-index:3}'+
'.vr-ph{position:relative;width:100%;aspect-ratio:1/1;max-height:340px;background:linear-gradient(135deg,#e8ebf0,#cfd5de);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:60px;color:#aab2bf}'+
'.vr-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'+
'.vr-body{padding:18px 20px 22px}'+
'.vr-body h3{font-size:24px;color:var(--dark);margin-bottom:6px}'+
'.vr-form{margin-top:18px;padding-top:16px;border-top:2px solid var(--bd)}'+
'.vr-form h5{font-size:18px;color:var(--dark);margin-bottom:8px}'+
'.vr-st{display:flex;gap:2px;margin-bottom:10px}'+
'.vr-st button{background:none;border:none;font-size:36px;line-height:1;color:#ccc;cursor:pointer;padding:0 4px;transition:.2s}'+
'.vr-st button.on{color:#f5a623}'+
'.vr-form input[type=email]{display:block;width:100%;padding:10px 14px;margin-bottom:10px;border:2px solid var(--bd);border-radius:10px;font-size:15px;outline:none}'+
'.vr-form input:focus{border-color:var(--red)}'+
'.vr-form .btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}'+
'.vr-msg{margin-top:6px;font-size:14px;font-weight:500;color:#198754}'+
'.vr-msg.err{color:var(--red)}'+
'.vr-hint{font-size:12.5px;color:#888;margin-top:8px}'+
'.vr-note{margin-top:18px;padding:12px 16px;border-radius:10px;background:#f3f4f6;color:#555;font-weight:500;text-align:center}';

var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

function el(id){return document.getElementById(id)}
function ready(){return typeof DATA!=='undefined'&&typeof esc==='function'&&typeof bn==='function'&&typeof im==='function'&&typeof clean==='function'}
function starTxt(n){var r=Math.round(n),s='';for(var i=1;i<=5;i++)s+=i<=r?'\u2605':'\u2606';return s}
function badge(name){
  var r=RATINGS[name];
  if(r&&r.count>0)return '<span class="vr-badge">'+starTxt(r.avg)+' '+bn(Number(r.avg).toFixed(1))+' ('+bn(r.count)+' জন)</span>';
  return '<span class="vr-badge none">এখনো রেটিং নেই</span>';
}

function decorate(){
  if(!ready())return;
  var cards=document.querySelectorAll('#volunteers .card');
  if(!cards.length)return;
  var list=clean(DATA.volunteers);
  cards.forEach(function(c){
    if(c.getAttribute('data-vr'))return;
    var h=c.querySelector('h4');if(!h)return;
    var nm=h.textContent,v=null;
    for(var k=0;k<list.length;k++){if(list[k].name===nm){v=list[k];break}}
    if(!v)return;
    c.setAttribute('data-vr','1');c.setAttribute('data-vname',nm);
    var b=document.createElement('div');b.className='vr-b';b.innerHTML=badge(nm);
    h.parentNode.insertBefore(b,h.nextSibling);
    c.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a'))return;openBox(v)});
  });
}

function refresh(){
  document.querySelectorAll('#volunteers .card[data-vname]').forEach(function(c){
    var b=c.querySelector('.vr-b');if(b)b.innerHTML=badge(c.getAttribute('data-vname'));
  });
  var a=el('vr-avg');if(a&&CUR)a.innerHTML=badge(CUR);
}

function closeBox(){var o=el('vr-ov');if(o)o.classList.remove('on');document.body.style.overflow='';CUR=null}

function loadRatings(){
  fetch('/api/ratings',{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
    if(j&&typeof j==='object'&&!Array.isArray(j)){RATINGS=j;refresh()}
  }).catch(function(){});
}

function openBox(v){
  CUR=v.name;
  var o=el('vr-ov');
  if(!o){
    o=document.createElement('div');o.id='vr-ov';o.innerHTML='<div id="vr-box"></div>';document.body.appendChild(o);
    o.addEventListener('click',function(e){if(e.target===o||(e.target.classList&&e.target.classList.contains('vr-x')))closeBox()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeBox()});
  }
  var rows='';
  if(v.house)rows+='<div class="row"><b>বাড়ি:</b> '+esc(v.house)+'</div>';
  if(v.address)rows+='<div class="row"><b>ঠিকানা:</b> '+esc(v.address)+'</div>';
  if(v.about)rows+='<div class="about">'+esc(v.about)+'</div>';
  var sb='';for(var i=1;i<=5;i++)sb+='<button type="button" data-s="'+i+'" aria-label="'+i+' তারা">\u2605</button>';
  var form='<div class="vr-form"><h5>আপনার রেটিং দিন</h5><div class="vr-st" id="vr-st">'+sb+'</div>'+
    '<input id="vr-mail" type="email" placeholder="আপনার ইমেইল (আবশ্যক)" maxlength="100" autocomplete="email">'+
    '<button class="btn" id="vr-go" type="button" disabled><i class="fas fa-star"></i> রেটিং জমা দিন</button>'+
    '<div id="vr-msg" class="vr-msg"></div><div class="vr-hint">আপনার ইমেইল সাইটে দেখানো হবে না, সরাসরি জমাও রাখা হয় না। এক ইমেইল থেকে একজনকে একবারই রেটিং দেওয়া যাবে, আবার দিলে আগেরটা বদলে যাবে।</div></div>';
  var box=el('vr-box');
  box.innerHTML='<button class="vr-x" type="button" aria-label="বন্ধ করুন">&times;</button>'+
    '<div class="vr-ph"><i class="fas fa-user"></i>'+im(v.photo,v.name)+'</div>'+
    '<div class="vr-body"><h3>'+esc(v.name)+'</h3><div id="vr-avg">'+badge(v.name)+'</div>'+rows+
    (typeof acts==='function'?acts(v,'বাড়ির ম্যাপ'):'')+form+'</div>';
  o.classList.add('on');document.body.style.overflow='hidden';
  loadRatings();

  var stBox=el('vr-st'),sel=0,btns=stBox.querySelectorAll('button'),go=el('vr-go');
  var msg=function(t,bad){var m=el('vr-msg');if(!m)return;m.textContent=t;m.className='vr-msg'+(bad?' err':'')};
  var paint=function(n){btns.forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-s')<=n)})};
  btns.forEach(function(b){
    b.onclick=function(){sel=+b.getAttribute('data-s');paint(sel);go.disabled=false;msg('')};
    b.onmouseenter=function(){paint(+b.getAttribute('data-s'))};
  });
  stBox.onmouseleave=function(){paint(sel)};
  go.onclick=function(){
    var mail=el('vr-mail').value.trim().toLowerCase();
    if(!sel){msg('প্রথমে তারা বেছে নিন।',1);return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){msg('সঠিক ইমেইল দিন, যেমন name@gmail.com',1);return}
    go.disabled=true;msg('জমা হচ্ছে...');
    fetch('/api/rate',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({volunteer:v.name,stars:sel,email:mail})
    }).then(function(r){return r.json().catch(function(){return {ok:false}})}).then(function(j){
      if(j&&j.ok){
        var f=stBox.parentNode;f.innerHTML='<div class="vr-note">ধন্যবাদ! আপনার রেটিং জমা হয়েছে।</div>';
        loadRatings();
      }else{
        go.disabled=false;
        msg(j&&j.error==='bad_email'?'সঠিক ইমেইল দিন।':'জমা দেওয়া যায়নি, আবার চেষ্টা করুন।',1);
      }
    }).catch(function(){go.disabled=false;msg('ইন্টারনেট সমস্যা, আবার চেষ্টা করুন।',1)});
  };
}

function init(){
  decorate();loadRatings();
  var app=el('app');
  if(app&&'MutationObserver' in window){new MutationObserver(decorate).observe(app,{childList:true,subtree:true})}
  else{setInterval(decorate,1500)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* স্বাগতম পপআপ: সাইটে ঢুকলেই ২.৫ সেকেন্ড দেখায়, তারপর নিজে থেকে মিলিয়ে যায় (ট্যাপ করলে আগেই বন্ধ হয়) */
(function(){
  var wcss=''+
  '#wl-ov{position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,18,32,.72);backdrop-filter:blur(3px);opacity:1;transition:opacity .5s}'+
  '#wl-ov.out{opacity:0;pointer-events:none}'+
  '#wl-box{position:relative;overflow:hidden;max-width:440px;width:100%;text-align:center;color:#fff;border-radius:20px;padding:34px 24px 32px;background:linear-gradient(135deg,#121e31,#7f1d1d,#d32f2f);box-shadow:0 20px 60px rgba(0,0,0,.55);animation:popin .6s both}'+
  '#wl-box i{display:block;font-size:46px;color:#ffeb3b;margin-bottom:14px;animation:floating 2s ease-in-out infinite}'+
  '#wl-box h2{font-size:26px;line-height:1.5;font-weight:700}'+
  '#wl-box h2 span{color:#ffcdd2}'+
  '#wl-bar{position:absolute;left:0;bottom:0;height:4px;width:100%;background:#ffeb3b;transform-origin:left;animation:wlbar 2.5s linear forwards}'+
  '@keyframes wlbar{to{transform:scaleX(0)}}';
  var ws=document.createElement('style');ws.textContent=wcss;document.head.appendChild(ws);
  var wo=document.createElement('div');wo.id='wl-ov';
  wo.innerHTML=`<div id='wl-box'><i class='fas fa-house-chimney'></i><h2>শাহবাজপুর পূর্বপাড়ার <span>ভার্চুয়াল জগৎ</span>-এ আপনাকে স্বাগতম</h2><div id='wl-bar'></div></div>`;
  document.body.appendChild(wo);
  var gone=false;
  function hide(){
    if(gone)return;gone=true;
    wo.classList.add('out');
    setTimeout(function(){if(wo.parentNode)wo.parentNode.removeChild(wo)},600);
  }
  wo.addEventListener('click',hide);
  setTimeout(hide,2500);
})();

/* দর্শকের পোস্ট সুবিধা (visitor.js) লোড করা */
(function(){var s=document.createElement('script');s.src='visitor.js';document.body.appendChild(s)})();
