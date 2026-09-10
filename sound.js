/* Lightweight synthesized effects: no downloads, music, or autoplay. */
const Sound = (() => {
  let context, master, muted = false;
  try { muted = localStorage.getItem('grand-circuit-muted') === 'true'; } catch {}
  const active = new Set();
  function unlock() {
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        master = context.createGain(); master.gain.value = muted ? 0 : .22;
        master.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Audio must never interrupt a turn. */ }
  }
  function tone(frequency, delay=0, duration=.12, volume=.35, type='sine', end=frequency) {
    const t=context.currentTime+delay;
    const oscillator=context.createOscillator(), envelope=context.createGain();
    oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,t);
    oscillator.frequency.exponentialRampToValueAtTime(end,t+duration);
    envelope.gain.setValueAtTime(0,t);
    envelope.gain.linearRampToValueAtTime(volume,t+.006);
    envelope.gain.exponentialRampToValueAtTime(.0001,t+duration);
    oscillator.connect(envelope); envelope.connect(master);
    active.add(oscillator);
    oscillator.onended=()=>{active.delete(oscillator); oscillator.disconnect(); envelope.disconnect();};
    oscillator.start(t); oscillator.stop(t+duration+.02);
  }
  function play(name) {
    if (muted || document.hidden || !context || context.state !== 'running') return;
    try {
      if(name==='roll') {
        [0,.06,.13,.23,.37,.54,.69,.84,.96].forEach((t,i)=>tone(260+i%3*110,t,.055,.3,'triangle',90));
      } else if(name==='step') tone(340,0,.045,.13,'sine',190);
      else if(name==='land') { tone(150,0,.1,.35,'triangle',65); tone(420,.025,.06,.1); }
      else if(name==='money') { tone(1047,0,.16,.22); tone(1568,.065,.2,.17); }
      else if(name==='pay') { tone(440,0,.09,.2); tone(330,.08,.13,.16); }
      else if(name==='buy') [523,659,784].forEach((f,i)=>tone(f,i*.075,.2,.23));
      else if(name==='card') { tone(650,0,.18,.18,'sine',1100); tone(1320,.12,.16,.13); }
      else if(name==='jail') { tone(220,0,.2,.22,'triangle',110); tone(110,.13,.2,.18); }
      else if(name==='win') [523,659,784,1047].forEach((f,i)=>tone(f,i*.13,.38,.25));
      else if(name==='lose') [330,262,196].forEach((f,i)=>tone(f,i*.13,.25,.18));
    } catch { /* Unsupported audio implementations fall back to silent play. */ }
  }
  const button=document.createElement('button');
  button.type='button'; button.className='btn sound-toggle';
  function update() {
    button.textContent=muted ? 'Sound: off' : 'Sound: on';
    button.setAttribute('aria-label', muted ? 'Enable sound effects' : 'Mute sound effects');
    button.setAttribute('aria-pressed', String(!muted));
  }
  button.addEventListener('click',()=>{
    muted=!muted; unlock();
    if(master) master.gain.setValueAtTime(muted?0:.22,context.currentTime);
    // Stop queued effects so they cannot reappear when sound is re-enabled.
    if(muted) for(const oscillator of active) { try {oscillator.stop();} catch {} }
    try {localStorage.setItem('grand-circuit-muted',String(muted));} catch {}
    update(); if(!muted) play('step');
  });
  update(); document.body.appendChild(button);
  document.addEventListener('pointerdown',unlock,{capture:true});
  document.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('visibilitychange',()=>{
    if(!context) return;
    if(document.hidden) {
      for(const oscillator of active) {try {oscillator.stop();} catch {}}
      context.suspend().catch(()=>{});
    }
  });
  return {play};
})();
