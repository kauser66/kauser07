/* =====================================================================
   rating.js — স্বেচ্ছাসেবকের রেটিং (পপআপ + গড় রেটিং)
   শুধু #volunteers সেকশনের কার্ডে কাজ করে। বাকি সাইট বদলায় না।
   ===================================================================== */
(function(){
'use strict';

/* Web3Forms Access Key এখানে বসাবেন (web3forms.com থেকে পাওয়া)। ফাঁকা থাকলে ফর্মে "শীঘ্রই চালু হবে" দেখাবে। */
var W3F_KEY='93a32002-2e4b-476b-8d2d-ec9c78fb50ae';

var RATINGS={};

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
'.vr-form input[type=text],.vr-form input[type=email]{display:block;width:100%;padding:10px 14px;margin-bottom:10px;border:2px solid var(--bd);border-radius:10px;font-size:15px;outline:none}'+
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
}

function closeBox(){var o=el('vr-ov');if(o)o.classList.remove('on');document.body.style.overflow=''}

function openBox(v){
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
  var done=false;try{done=localStorage.getItem('vr:'+v.name)==='1'}catch(e){}
  var form;
  if(!W3F_KEY){
    form='<div class="vr-note">রেটিং দেওয়ার সুবিধা শীঘ্রই চালু হবে।</div>';
  }else if(done){
    form='<div class="vr-note">আপনি ইতিমধ্যে রেটিং দিয়েছেন। ধন্যবাদ!</div>';
  }else{
    var sb='';for(var i=1;i<=5;i++)sb+='<button type="button" data-s="'+i+'" aria-label="'+i+' তারা">\u2605</button>';
    form='<div class="vr-form"><h5>আপনার রেটিং দিন</h5><div class="vr-st" id="vr-st">'+sb+'</div>'+
      '<input id="vr-name" type="text" placeholder="আপনার নাম (ঐচ্ছিক)" maxlength="60">'+
      '<input id="vr-mail" type="email" placeholder="আপনার ইমেইল (আবশ্যক)" maxlength="100" autocomplete="email">'+
      '<input id="vr-bot" type="checkbox" style="display:none" tabindex="-1" autocomplete="off">'+
      '<button class="btn" id="vr-go" type="button" disabled><i class="fas fa-star"></i> রেটিং জমা দিন</button>'+
      '<div id="vr-msg" class="vr-msg"></div><div class="vr-hint">আপনার ইমেইল সাইটে কোথাও দেখানো হবে না। জমা দেওয়া রেটিং যাচাইয়ের পরে গড়ে যোগ হবে।</div></div>';
  }
  var box=el('vr-box');
  box.innerHTML='<button class="vr-x" type="button" aria-label="বন্ধ করুন">&times;</button>'+
    '<div class="vr-ph"><i class="fas fa-user"></i>'+im(v.photo,v.name)+'</div>'+
    '<div class="vr-body"><h3>'+esc(v.name)+'</h3><div id="vr-avg">'+badge(v.name)+'</div>'+rows+
    (typeof acts==='function'?acts(v,'বাড়ির ম্যাপ'):'')+form+'</div>';
  o.classList.add('on');document.body.style.overflow='hidden';

  var stBox=el('vr-st');
  if(stBox){
    var sel=0,btns=stBox.querySelectorAll('button'),go=el('vr-go');
    var msg=function(t,bad){var m=el('vr-msg');m.textContent=t;m.className='vr-msg'+(bad?' err':'')};
    var paint=function(n){btns.forEach(function(b){b.classList.toggle('on',+b.getAttribute('data-s')<=n)})};
    btns.forEach(function(b){
      b.onclick=function(){sel=+b.getAttribute('data-s');paint(sel);go.disabled=false;msg('')};
      b.onmouseenter=function(){paint(+b.getAttribute('data-s'))};
    });
    stBox.onmouseleave=function(){paint(sel)};
    go.onclick=function(){
      var mail=el('vr-mail').value.trim().toLowerCase(),nm=el('vr-name').value.trim();
      if(!sel){msg('প্রথমে তারা বেছে নিন।',1);return}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)){msg('সঠিক ইমেইল দিন, যেমন name@gmail.com',1);return}
      if(el('vr-bot').checked)return;
      go.disabled=true;msg('জমা হচ্ছে...');
      fetch('https://api.web3forms.com/submit',{
        method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({access_key:W3F_KEY,subject:'স্বেচ্ছাসেবক রেটিং: '+v.name,from_name:'শাহবাজপুর ওয়েবসাইট',volunteer:v.name,rating:sel,rater_name:nm,email:mail})
      }).then(function(r){return r.json()}).then(function(j){
        if(j&&j.success){
          try{localStorage.setItem('vr:'+v.name,'1')}catch(e){}
          var f=stBox.parentNode;f.innerHTML='<div class="vr-note">ধন্যবাদ! আপনার রেটিং জমা হয়েছে। যাচাইয়ের পরে গড়ে যোগ হবে।</div>';
        }else{go.disabled=false;msg('জমা দেওয়া যায়নি, আবার চেষ্টা করুন।',1)}
      }).catch(function(){go.disabled=false;msg('ইন্টারনেট সমস্যা, আবার চেষ্টা করুন।',1)});
    };
  }
}

function getJ(u,p){
  return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()}).catch(function(){
    return fetch(p,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json()})});
}
function loadRatings(){
  var p='data/reviews/ratings.json',b=Math.floor(Date.now()/20000);
  getJ((typeof RAW==='string'?RAW:'')+p+'?t='+b,p).then(function(j){
    if(j&&typeof j==='object'&&!Array.isArray(j)){RATINGS=j;refresh()}
  }).catch(function(){});
}

function init(){
  decorate();loadRatings();
  var app=el('app');
  if(app&&'MutationObserver' in window){new MutationObserver(decorate).observe(app,{childList:true,subtree:true})}
  else{setInterval(decorate,1500)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
