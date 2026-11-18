import content from './lesson-content.json';
import {createExplorer,joints} from './explorer.js';
import {fillIcons,icon} from './icons.js';

const {parts,questions}=content;
const findPart=id=>parts.find(p=>p.id===id);
const sequence=id=>String(parts.findIndex(p=>p.id===id)+1).padStart(2,'0');
const $=id=>document.getElementById(id);
const prompts={
  explore:'Explore the assembly one part at a time. Select a component to see how it works.',
  motion:'Move a joint and follow its effect through the arm, from the base to the fingertips.',
  quiz:'Identify the components on the model. Each question connects a part to its job.'
};
const choices=[
  ['base-drive','base','lower-link'],['shoulder','wrist-drive','base-drive'],
  ['lift','wrist-link','return'],['wrist-drive','upper-drive','gripper'],['lower-link','gripper','wrist-link']
];

export function startLesson(){
  fillIcons();
  const stage=$('stage'),panel=$('panel-body'),strip=$('part-index'),audio=$('voice'),still=$('still');
  let mode='explore',active=parts[0].id,isolated=false,labels=true,viewer=null;
  let question=0,attempts=[],answered=false,complete=false,quizMessage='',firstTry=0,audioToken=0;
  const jointValues=new Map(joints.map(j=>[j.id,j.initial]));
  const visited=new Set();
  try{
    const stored=JSON.parse(localStorage.getItem('kinetic-atlas.robotic-arm.explored.v1')||'[]');
    if(Array.isArray(stored))stored.filter(id=>findPart(id)).forEach(id=>visited.add(id));
  }catch{}
  function announce(message){$('announcement').textContent=message;}
  function record(id){
    visited.add(id);
    try{localStorage.setItem('kinetic-atlas.robotic-arm.explored.v1',JSON.stringify([...visited]));}catch{}
    $('progress-number').textContent=visited.size+' / '+parts.length;
    const bars=$('progress-bars');bars.setAttribute('aria-valuenow',visited.size);
    bars.innerHTML=parts.map(part=>'<span class="'+(visited.has(part.id)?'done':'')+'"></span>').join('');
  }
  function stopAudio(){audioToken++;audio.pause();audio.removeAttribute('src');audio.load();}
  function updateAudio(){
    const button=$('listen');if(!button)return;
    const playing=!audio.paused&&!audio.ended;
    button.classList.toggle('is-playing',playing);
    button.innerHTML=icon(playing?'pause':'speaker')+(playing?'Pause narration':audio.currentTime>0&&!audio.ended?'Resume narration':'Listen to part');
    button.setAttribute('aria-pressed',String(playing));
  }
  async function toggleAudio(){
    if(!audio.paused){audio.pause();return;}
    const token=++audioToken;
    if(!audio.getAttribute('src'))audio.src='assets/voice/'+active+'.wav';
    if(audio.ended)audio.currentTime=0;
    try{await audio.play();}catch{
      if(token===audioToken){$('audio-status').textContent='Audio could not play. The narration is transcribed in this panel.';updateAudio();}
    }
  }
  for(const event of ['playing','pause','ended'])audio.addEventListener(event,updateAudio);
  function updatePartButtons(){
    for(const b of strip.children)b.setAttribute('aria-pressed',String(mode==='explore'&&b.dataset.part===active));
  }
  function revealCard(id){
    const card=strip.querySelector('[data-part="'+id+'"]');if(!card)return;
    const a=card.getBoundingClientRect(),b=strip.getBoundingClientRect();
    if(a.left<b.left)strip.scrollBy({left:a.left-b.left,behavior:'instant'});
    else if(a.right>b.right)strip.scrollBy({left:a.right-b.right,behavior:'instant'});
  }
  function pick(id){
    if(mode==='quiz'){submit(id);return;}
    if(mode==='motion')setMode('explore');
    if(active!==id)stopAudio();active=id;record(id);
    viewer?.select(id);
    if(!viewer)showStill();
    inspector();updatePartButtons();revealCard(id);
    announce(findPart(id).name+' selected.');
  }
  function showStill(){
    still.src=isolated?'assets/parts/'+active+'.webp':'assets/parts/assembly.webp';
    still.alt=isolated?findPart(active).name:'Assembled robotic arm';still.hidden=false;
  }
  function toggleIsolation(){
    isolated=!isolated;if(viewer)viewer.isolate(isolated);else showStill();
    const b=$('isolate');b.setAttribute('aria-pressed',isolated);b.innerHTML=icon('isolate')+(isolated?'Show assembly':'Isolate part');
    $('hint').textContent=isolated?'Isolated component':viewer?'Drag to orbit':'Illustrated view';
    announce(isolated?findPart(active).name+' isolated.':'Full assembly shown.');
  }
  function panelHeading(label,count,symbol){
    $('panel-label').textContent=label;$('panel-count').textContent=count;$('panel-icon').innerHTML=icon(symbol);
  }
  function inspector(){
    const part=findPart(active),idx=parts.indexOf(part);
    panelHeading('Part inspector',sequence(active)+' / 10','scan');
    panel.innerHTML=`<div class="panel-kicker">${part.category}</div><h2>${part.name}</h2><p>${part.description}</p>
      <div class="detail-section"><h3>Look closer</h3><p>${part.detail}</p></div>
      <div class="tip"><div class="tip-heading">${icon('light')}Try it</div><p>${part.prompt}</p></div>
      <div class="inspector-bottom"><div class="listen-row"><button id="listen" class="audio-btn"></button><button id="isolate" class="small-button" aria-pressed="${isolated}">${icon('isolate')}${isolated?'Show assembly':'Isolate part'}</button></div><span id="audio-status" role="status"></span>
      <div class="part-nav"><button id="previous-part" ${idx===0?'disabled':''}>${icon('left')}Previous</button><button id="next-part">${idx===parts.length-1?'Open motion lab':'Next part'}${icon('right')}</button></div></div>`;
    $('listen').onclick=toggleAudio;updateAudio();$('isolate').onclick=toggleIsolation;
    $('previous-part').onclick=()=>{pick(parts[idx-1].id);$(idx===1?'next-part':'previous-part').focus({preventScroll:true});};
    $('next-part').onclick=()=>{
      if(idx===parts.length-1){setMode('motion');$('joint-base').focus({preventScroll:true});}
      else{pick(parts[idx+1].id);$('next-part').focus({preventScroll:true});}
    };
  }
  function motion(){
    panelHeading('Joint controls','6 controls','sliders');
    panel.innerHTML=`<div class="panel-kicker">Motion lab</div><h2>Move the arm</h2><p>${viewer?'Adjust one control at a time and follow the gripper.':'Live motion requires WebGL. Open this page in a browser with hardware acceleration to move the joints.'}</p>
      <div class="joint-list">${joints.map(j=>`<div class="joint"><label for="joint-${j.id}">${j.name}<output id="value-${j.id}" for="joint-${j.id}">${jointValues.get(j.id)}${j.unit}</output></label>
      <input id="joint-${j.id}" type="range" min="${j.min}" max="${j.max}" value="${jointValues.get(j.id)}" ${viewer?'':'disabled'}></div>`).join('')}</div>
      <div class="joint-footer"><p>Values apply to this model.</p><button class="small-button" id="reset-pose" ${viewer?'':'disabled'}>${icon('reset')}Reset pose</button></div>`;
    for(const j of joints){
      const input=$('joint-'+j.id);
      input.oninput=()=>{const v=Number(input.value);jointValues.set(j.id,v);$('value-'+j.id).value=v+j.unit;viewer?.joint(j.id,v);};
    }
    $('reset-pose').onclick=()=>{viewer?.resetPose();joints.forEach(j=>jointValues.set(j.id,j.initial));motion();$('reset-pose').focus();announce('Pose restored.');};
  }
  function submit(id){
    if(complete||answered||attempts.includes(id))return;
    const correct=id===questions[question].answer;attempts.push(id);
    if(correct){
      answered=true;if(attempts.length===1)firstTry++;
      quizMessage=questions[question].why;
    }else{
      quizMessage=findPart(id).name+' — '+findPart(id).description+' Try another part.';
    }
    renderQuiz();announce((correct?'Correct. ':'Try again. ')+quizMessage);
    if(correct)$('advance').focus();
  }
  function advance(){
    question++;attempts=[];answered=false;quizMessage='';
    complete=question===questions.length;renderQuiz();
    panel.querySelector('h2')?.focus();announce(complete?'Knowledge check complete.':questions[question].ask);
  }
  function renderQuiz(){
    panelHeading('Knowledge check',complete?'Complete':(question+1)+' / '+questions.length,'quiz');
    if(complete){
      panel.innerHTML=`<div class="panel-kicker">Results</div><h2 tabindex="-1">Check complete</h2><div class="quiz-score">${firstTry} / ${questions.length}</div>
        <p>Components identified on your first attempt. You located all five parts.</p><button class="small-button quiz-again" id="restart">${icon('reset')}Try again</button>`;
      $('restart').onclick=()=>{question=0;attempts=[];answered=false;firstTry=0;complete=false;quizMessage='';renderQuiz();panel.querySelector('h2').focus();};return;
    }
    const q=questions[question];
    panel.innerHTML=`<div class="panel-kicker">Identify the part</div><h2 class="quiz-question" tabindex="-1">${q.ask}</h2>
      <p>Pick it on the model or choose an answer.</p><div class="quiz-options">${choices[question].map(id=>`<button data-answer="${id}" ${answered||attempts.includes(id)?'disabled':''} class="${attempts.includes(id)?id===q.answer?'correct':'incorrect':''}">${findPart(id).name}</button>`).join('')}</div>
      <div class="quiz-feedback">${quizMessage?`<strong>${answered?'Correct':'Try again'}</strong>${quizMessage}`:''}</div>${answered?`<button id="advance" class="next-question">${question===questions.length-1?'View results':'Next question'} ${icon('right')}</button>`:''}`;
    panel.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>submit(b.dataset.answer));
    if(answered)$('advance').onclick=advance;
  }
  function setMode(next){
    if(mode!==next)stopAudio();
    mode=next;
    document.body.dataset.mode=mode;
    if(isolated&&mode!=='explore'){isolated=false;viewer?.isolate(false);if(!viewer)showStill();}
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    $('mode-intro').textContent=prompts[mode];
    $('select-hint').textContent=mode==='quiz'?'Select your answer':'Click a part to inspect';
    $('hint').textContent=isolated?'Isolated component':viewer?'Drag to orbit':'Illustrated view';
    viewer?.quiz(mode==='quiz');viewer?.select(mode==='explore'?active:null);
    if(mode==='explore'){inspector();record(active);}else if(mode==='motion')motion();else renderQuiz();
    updatePartButtons();
  }
  function cameraChanged(value){
    const select=$('orientation');
    if(value==='custom'&&!select.querySelector('[value="custom"]')){
      const option=new Option('Free orbit','custom');option.disabled=true;select.add(option);
    }
    select.value=value;
  }
  const cards=parts.map(part=>{
    const b=document.createElement('button');b.className='part-card';b.dataset.part=part.id;b.setAttribute('aria-label','Select '+part.name);
    b.innerHTML=`<img src="assets/parts/${part.id}.webp" alt=""><span><span class="part-number">${sequence(part.id)}</span>${part.name}</span>`;
    b.addEventListener('click',()=>pick(part.id));strip.append(b);return b;
  });
  function indexButtons(){
    $('index-prev').disabled=strip.scrollLeft<2;$('index-next').disabled=strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2;
  }
  strip.addEventListener('scroll',indexButtons,{passive:true});new ResizeObserver(indexButtons).observe(strip);
  for(const [id,d] of [['index-prev',-1],['index-next',1]])$(id).onclick=()=>strip.scrollBy({left:d*(cards[0].offsetWidth+10)*2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  try{
    viewer=createExplorer({canvas:$('model'),stage,overlay:$('markers'),onPick:pick,onViewChange:cameraChanged});
    if(matchMedia('(pointer: coarse)').matches)$('zoom-hint').textContent='Pinch to zoom';
    if(new URLSearchParams(location.search).has('illustrate'))window.atlasIllustrate=viewer.illustrate;
  }catch(error){
    console.error(error);$('model').hidden=true;$('markers').hidden=true;showStill();
    for(const id of ['orientation','labels','zoom-in','zoom-out','reset-camera'])$(id).disabled=true;
    $('zoom-hint').textContent='Select a component below';$('select-hint').textContent='Part illustrations';
  }
  $('orientation').onchange=e=>{if(e.target.value!=='custom')viewer?.view(e.target.value);};
  $('zoom-in').onclick=()=>viewer?.zoom(1.22);$('zoom-out').onclick=()=>viewer?.zoom(1/1.22);
  $('reset-camera').onclick=()=>viewer?.resetCamera();
  $('labels').onclick=()=>{labels=!labels;viewer?.labels(labels);$('labels').setAttribute('aria-pressed',String(labels));};
  const view=$('viewer');
  function expanded(on){view.classList.toggle('expanded',on);document.body.classList.toggle('has-expanded',on);$('expand').setAttribute('aria-label',on?'Exit expanded view':'Expand viewer');$('expand').title=on?'Exit expanded view':'Expand viewer';$('expand').innerHTML=icon(on?'shrink':'expand');}
  $('expand').onclick=async()=>{
    if(view.classList.contains('expanded')){if(document.fullscreenElement)await document.exitFullscreen();expanded(false);}
    else{try{await view.requestFullscreen();}catch{}expanded(true);}
  };
  document.addEventListener('fullscreenchange',()=>expanded(Boolean(document.fullscreenElement)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&view.classList.contains('expanded'))expanded(false);});
  const guide=$('guide');$('help').onclick=()=>guide.showModal();$('close-guide').onclick=()=>guide.close();
  guide.addEventListener('click',e=>{if(e.target===guide){const r=guide.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)guide.close();}});
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  setMode('explore');
}
