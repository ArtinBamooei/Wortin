(() => {
  "use strict";
  const root = document.getElementById("learning-media");
  if (!root) return;
  // Add future Aparat lessons here: {title, topic, duration, embedUrl, questions}.
  const listeningVideos = { A1: [], A2: [], B1: [] };
  const state={level:"A1",answers:{}};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const levels=["A1","A2","B1"];
  function render(){
    root.innerHTML=`
      <div class="media-intro"><div><span class="media-eyebrow">HÖREN · VERSTEHEN</span><h1>شنیداری آلمانی</h1><p>تمرین شنیدن آلمانی از سطح A1 تا B1؛ ویدیوها مستقیماً در همین صفحه پخش می‌شوند.</p></div><div class="media-orb" aria-hidden="true"><span>♫</span><i></i></div></div>
      <div class="media-levels" role="group" aria-label="سطح زبان">${levels.map(l=>`<button type="button" data-level="${l}" class="${state.level===l?"active":""}" aria-pressed="${state.level===l}"><strong>${l}</strong><span>${({A1:"مقدماتی",A2:"پایه",B1:"متوسط"})[l]}</span></button>`).join("")}</div>
      <div class="media-toolbar"><div><span class="media-eyebrow">HÖRTRAINING / ${state.level}</span><h2>ویدیوهای سطح ${state.level}</h2><p>ویدیو را ببین، دوباره گوش بده و به پرسش‌های درک مطلب پاسخ بده.</p></div></div>
      ${renderListening()}
      <div class="media-footnote"><span class="footnote-dot"></span><span>فقط محتوای شنیداری در این بخش نمایش داده می‌شود.</span></div>`;
    root.querySelectorAll("[data-level]").forEach(b=>b.addEventListener("click",()=>{state.level=b.dataset.level;render()}));
    root.querySelectorAll("[data-answer]").forEach(b=>b.addEventListener("click",()=>{state.answers[b.dataset.answer]=Number(b.dataset.option);render()}));
  }
  function renderListening(){
    const videos=listeningVideos[state.level].filter(v=>v&&typeof v.title==="string"&&typeof v.embedUrl==="string"&&isValidAparatEmbed(v.embedUrl));
    if(!videos.length)return `<div class="listening-empty"><div class="listening-visual"><div class="sound-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="play-disc">▶</div></div><span class="media-eyebrow">HÖREN / ${state.level}</span><h3>تمرین‌های شنیداری ${state.level}</h3><p>هنوز ویدیویی برای این سطح اضافه نشده است.</p><div class="listening-steps"><span><b>01</b> تماشای ویدیو</span><span><b>02</b> شنیدن دوباره</span><span><b>03</b> پاسخ به پرسش‌ها</span></div><div class="provider-note"><span class="provider-mark">A</span><div><strong>پخش ویدیو با آپارات</strong><small>پس از افزودن لینک معتبر آپارات، ویدیو در همین صفحه نمایش داده می‌شود.</small></div><span class="provider-status">آماده افزودن محتوا</span></div></div>`;
    return `<div class="listening-video-grid">${videos.map((v,i)=>`<article class="listening-video-card"><div class="video-frame"><iframe src="${esc(v.embedUrl)}" title="${esc(v.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><div class="listening-video-info"><span class="reading-level">${state.level}</span><span class="reading-time">${esc(v.duration||"شنیداری")}</span><h3>${esc(v.title)}</h3><p>${esc(v.topic||"تمرین شنیداری آلمانی")}</p>${Array.isArray(v.questions)?v.questions.map((q,qi)=>{const key=state.level+"-"+i+"-"+qi,answered=state.answers[key]!==undefined;return `<div class="lesson-question"><strong>${qi+1}. ${esc(q.q)}</strong><div class="lesson-options">${q.options.map((o,oi)=>`<button type="button" data-answer="${key}" data-option="${oi}" class="${answered&&oi===q.answer?"correct":answered&&state.answers[key]===oi?"incorrect":""}" ${answered?"disabled":""}>${esc(o)}</button>`).join("")}</div>${answered?`<small class="answer-feedback">${state.answers[key]===q.answer?"پاسخ درست است.":"پاسخ درست: "+esc(q.options[q.answer])}</small>`:""}</div>`}).join(""):""}</div></article>`).join("")}</div>`;
  }
  function isValidAparatEmbed(value){try{const u=new URL(value),p=u.pathname.split("/");return u.protocol==="https:"&&["aparat.com","www.aparat.com"].includes(u.hostname)&&p[1]==="video"&&p[2]==="video"&&p[3]==="embed"&&p[4]==="videohash"&&/^[A-Za-z0-9_-]+$/.test(p[5]||"")&&p.length===6}catch{return false}}
  
  render();
})();