/* Visitor submission UI — keeps the existing site layout intact. */
(function(){
  var API = window.SUBMISSION_API || "";
  function el(tag, attrs, html){var n=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){n.setAttribute(k,attrs[k])});if(html!==undefined)n.innerHTML=html;return n}
  function init(){
    if(document.getElementById("visitor-submit-entry"))return;
    var nav=document.querySelector("#nav .container")||document.querySelector("#nav");
    var host=document.querySelector("header .container")||document.querySelector("header")||document.body;
    var button=el("button",{id:"visitor-submit-entry",type:"button",class:"btn"},"<i class='fas fa-paper-plane'></i> পোস্ট জমা দিন");
    button.style.cssText="margin:10px 8px;cursor:pointer";
    (nav||host).appendChild(button);
    var overlay=el("div",{id:"visitor-submit-modal","aria-hidden":"true"});
    overlay.innerHTML="<div class='vs-box' role='dialog' aria-modal='true' aria-labelledby='vs-title'><button type='button' class='vs-close' aria-label='বন্ধ করুন'>×</button><h3 id='vs-title'>পোস্ট জমা দিন</h3><p>আপনি কোন ধরনের পোস্ট জমা দিতে চান?</p><div class='vs-choices'><button type='button' data-kind='news'>সংবাদ জমা দিন</button><button type='button' data-kind='volunteer'>স্বেচ্ছাসেবক যুক্ত করুন</button></div><form id='vs-form' hidden enctype='multipart/form-data'><input type='hidden' name='kind'><label>আপনার নাম *<input name='submitter' required maxlength='100'></label><div id='vs-fields'></div><button class='vs-send' type='submit'>জমা দিন</button><p id='vs-status' role='status'></p></form></div>";
    document.body.appendChild(overlay);
    var style=el("style",{});style.textContent="#visitor-submit-modal{display:none;position:fixed;inset:0;z-index:5000;background:#000b;padding:16px;overflow:auto;align-items:center;justify-content:center}#visitor-submit-modal.on{display:flex}.vs-box{background:#fff;border-radius:14px;padding:22px;width:min(100%,560px);max-height:92vh;overflow:auto;color:#222;position:relative}.vs-box h3{margin:0 0 12px}.vs-close{float:right;border:0;border-radius:50%;width:34px;height:34px;background:#d32f2f;color:#fff;font-size:22px}.vs-box label{display:block;font-weight:600;margin:12px 0}.vs-box input,.vs-box textarea{display:block;width:100%;padding:11px;border:1px solid #ccc;border-radius:7px;margin-top:5px;font:inherit;box-sizing:border-box}.vs-box textarea{min-height:110px}.vs-choices{display:flex;gap:10px;flex-wrap:wrap}.vs-choices button,.vs-send{border:0;border-radius:8px;background:#d32f2f;color:white;padding:12px 16px;font:inherit;cursor:pointer}.vs-send{width:100%;margin-top:12px}.vs-box [hidden]{display:none!important}";
    document.head.appendChild(style);
    var form=overlay.querySelector("#vs-form"),fields=overlay.querySelector("#vs-fields"),status=overlay.querySelector("#vs-status");
    function close(){overlay.classList.remove("on");overlay.setAttribute("aria-hidden","true")}
    button.addEventListener("click",function(){overlay.classList.add("on");overlay.setAttribute("aria-hidden","false")});
    overlay.querySelector(".vs-close").addEventListener("click",close);
    overlay.addEventListener("click",function(e){if(e.target===overlay)close()});
    overlay.querySelectorAll("[data-kind]").forEach(function(b){b.addEventListener("click",function(){
      var kind=b.dataset.kind;form.elements.kind.value=kind;form.hidden=false;overlay.querySelector(".vs-choices").hidden=true;status.textContent="";
      fields.innerHTML=kind==="news"
       ? "<label>সংবাদের শিরোনাম *<input name='title' required maxlength='180'></label><label>বিস্তারিত *<textarea name='text' required maxlength='12000'></textarea></label><label>ছবি (ঐচ্ছিক)<input type='file' name='photo' accept='image/jpeg,image/png,image/webp'></label>"
       : "<label>স্বেচ্ছাসেবকের নাম *<input name='name' required maxlength='120'></label><label>ছবি *<input type='file' name='photo' accept='image/jpeg,image/png,image/webp' required></label><label>বাড়ি/পরিচিতি<input name='house' maxlength='120'></label><label>ঠিকানা<input name='address' maxlength='300'></label><label>সংক্ষিপ্ত পরিচিতি<textarea name='about' maxlength='3000'></textarea></label><label>মোবাইল<input name='phone' maxlength='40'></label><label>Facebook প্রোফাইল লিংক<input name='fb' type='url'></label><label>ম্যাপ লিংক<input name='map' type='url'></label>";
    })});
    form.addEventListener("submit",async function(e){
      e.preventDefault();status.textContent="জমা হচ্ছে…";
      if(!API){status.textContent="জমা দেওয়ার ব্যবস্থা এখনো চালু হয়নি। পরে আবার চেষ্টা করুন।";return}
      var data=new FormData(form);
      try{var res=await fetch(API.replace(/\/$/,"")+"/api/submit",{method:"POST",body:data});var out=await res.json();if(!res.ok)throw new Error(out.error||"জমা দেওয়া যায়নি");form.reset();form.hidden=true;fields.innerHTML="";overlay.querySelector(".vs-choices").hidden=false;status.textContent=out.message||"আপনার পোস্টটি জমা হয়েছে! অনুমোদনের অপেক্ষায় রয়েছে।"}
      catch(err){status.textContent=err.message||"সার্ভারে সমস্যা হয়েছে।"}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();