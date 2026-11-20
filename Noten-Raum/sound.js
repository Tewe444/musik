// Soundeffekte (Kenney, CC0 – siehe sounds/LICENSE.txt) und Stimmen für späteres Voice-Acting.
window.SFX=(function(){
  const FILES={
    pick:["impact_soft_medium_000"],throw:["cloth_1"],
    table:["impact_wood_medium_000","impact_wood_medium_001","impact_wood_medium_002"],
    stone:["impact_mining_000","impact_mining_001","impact_mining_002"],
    correct:["confirmation_002"],wrong:["error_006"],coin:["handle_coins"],buy:["handle_coins_2"],unlock:["maximize_006"],
    click:["click_002"],select:["select_002"],toggle:["toggle_002"],drop:["drop_002"],
    bookOpen:["book_open"],bookClose:["book_close"],bookFlip:["book_flip_1","book_flip_2"],
    sparkle:["glass_002"],boom:["explosion_crunch_000"],rumble:["low_frequency_explosion_000"],moon:["force_field_000"],fall:["space_engine_low_000"],
    step_concrete:["footstep_concrete_000","footstep_concrete_001","footstep_concrete_002","footstep_concrete_003"],
    step_grass:["footstep_grass_000","footstep_grass_001","footstep_grass_002"],
    step_snow:["footstep_snow_000","footstep_snow_001","footstep_snow_002"]
  };
  const base={},lastPlay={};
  for(const k in FILES)base[k]=FILES[k].map(f=>{const a=new Audio("sounds/"+f+".mp3");a.preload="auto";return a;});
  let playing=0;
  return {
    volume:.85,
    play(name,vol=1,rate=1){
      const list=base[name];if(!list||vol*this.volume<=.01)return null;
      const now=performance.now();
      if(lastPlay[name]&&now-lastPlay[name]<45)return null; // nicht 20× gleichzeitig
      if(playing>10)return null;
      lastPlay[name]=now;
      const a=list[Math.floor(Math.random()*list.length)].cloneNode();
      a.volume=Math.max(0,Math.min(1,vol*this.volume));
      try{a.preservesPitch=false;a.mozPreservesPitch=false;a.webkitPreservesPitch=false;}catch(e){}
      a.playbackRate=rate;playing++;
      const done=()=>{playing=Math.max(0,playing-1);a.onended=a.onerror=null;};
      a.onended=done;a.onerror=done;
      a.play().catch(done);
      return a;
    }
  };
})();

// Stimmen: Lege später MP3-Dateien nach voice/de/<id>.mp3 und voice/en/<id>.mp3.
// Welche IDs es gibt, steht in voice/TEXTE.md. Fehlt eine Datei, bleibt es einfach still.
window.VOICE=(function(){
  const missing=new Set();let current=null;
  return {
    lang:"de",enabled:true,
    play(id){
      if(!this.enabled)return;
      const key=this.lang+"/"+id;if(missing.has(key))return;
      this.stop();
      const a=new Audio("voice/"+key+".mp3");a.volume=1;current=a;
      a.onerror=()=>missing.add(key);
      a.play().catch(e=>{if(!e||e.name!=="NotAllowedError")missing.add(key);});
    },
    stop(){if(current){try{current.pause();}catch(e){}current=null;}}
  };
})();
