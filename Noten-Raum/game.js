const $=id=>document.getElementById(id);
const hasTouch=!!(
  (navigator.maxTouchPoints&&navigator.maxTouchPoints>0) ||
  ("ontouchstart" in window) ||
  (window.matchMedia&&(
    window.matchMedia("(pointer:coarse)").matches ||
    window.matchMedia("(any-pointer:coarse)").matches ||
    window.matchMedia("(hover:none)").matches
  ))
);
if(hasTouch)document.body.classList.add("touch-device");

// ---------- Spielstand, Modus, Raum-Designs ----------
let mode="menu"; // "menu" | "story" | "tutorial" | "game"
let roundToken=0,tutorialStep=0,tutorialCorrect=0;
const SAVE_KEY="nr3d_save_v1";
const SAVE_DEFAULT={coins:0,owned:[0],theme:0,tutorialDone:false,introSeen:false,started:false};
const save=Object.assign({},SAVE_DEFAULT);
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");if(s&&typeof s==="object"){Object.assign(save,s);if(s.started===undefined)save.started=!!(s.introSeen||s.tutorialDone||s.coins);}}catch(e){}
// Einstellungen bleiben auch bei "Neues Spiel" erhalten.
const SETTINGS_KEY="nr3d_settings_v1";
const settings={lang:(navigator.language||"de").toLowerCase().startsWith("de")?"de":"en",voice:true,fullscreen:true,music:2,sfx:2,afk:true};
// Lautstärke-Stufen für Musik und Soundeffekte: 0 = aus, 1 = leise, 2 = laut.
const VOL_LEVELS=[0,.45,1];
try{const s=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null");if(s&&typeof s==="object")Object.assign(settings,s);}catch(e){}
function persistSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(e){}}
I18N.set(settings.lang);VOICE.lang=I18N.lang;VOICE.enabled=settings.voice;
const tr=(k,v)=>I18N.t(k,v);
const roomName=i=>I18N.get("rooms")[i]||"";
if(!Array.isArray(save.owned)||!save.owned.includes(0))save.owned=[0].concat(Array.isArray(save.owned)?save.owned:[]);
if(!(save.theme>=0&&save.theme<6&&save.owned.includes(save.theme)))save.theme=0;
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}
const hex=n=>"#"+n.toString(16).padStart(6,"0");
// Raum-Designs. Index bleibt stabil (alte Spielstände). Die Räume sind bewusst teuer (100–750 Coins).
// sky: "moon" oder "sun" · particles: Art der schwebenden Teilchen · floorStyle: Bodenmuster
const THEMES=[
  {name:"Mondruine",price:0,bg:0x050509,fog:0x050509,fogD:.075,stone:0x45454c,floor:0xffffff,floorStyle:"ruin",amb:0x4a5578,ambI:.36,lamp:0xff9a3c,moonL:0x9db4f0,moon:0xdfe8ff,sky:"moon",particles:"dust",pColor:0xbfcfff},
  {name:"Sonnenuntergang",price:100,bg:0x3a1430,fog:0x6a2c3a,fogD:.05,stone:0x8a5a48,floor:0xffffff,floorStyle:"terracotta",amb:0xb06a60,ambI:.5,lamp:0xff7a3c,moonL:0xffa060,moon:0xff8a3c,sky:"sun",particles:"embers",pColor:0xffb060},
  {name:"Eiswelt",price:200,bg:0x0a1f3a,fog:0x1a4066,fogD:.055,stone:0x9fc4e0,floor:0xffffff,floorStyle:"ice",amb:0x7aa8d8,ambI:.55,lamp:0x9fd8ff,moonL:0xd0ecff,moon:0xf0fbff,sky:"moon",particles:"snow",pColor:0xffffff},
  {name:"Wald",price:350,bg:0x041008,fog:0x0b2a14,fogD:.065,stone:0x4a6a40,floor:0xffffff,floorStyle:"moss",amb:0x4f7a55,ambI:.42,lamp:0xffd27a,moonL:0xc0ffb0,moon:0xeaffd0,sky:"moon",particles:"fireflies",pColor:0xd8ff6a},
  {name:"Neon-Disco",price:500,bg:0x0c0016,fog:0x1d0033,fogD:.05,stone:0x3a1a5a,floor:0xffffff,floorStyle:"disco",amb:0x6a3a9a,ambI:.4,lamp:0xff3ad0,moonL:0x3affea,moon:0x6affff,sky:"none",particles:"sparkles",pColor:0xffffff},
  {name:"Unterwasser",price:750,bg:0x03203a,fog:0x0a3d5c,fogD:.07,stone:0x3f6f7a,floor:0xffffff,floorStyle:"seabed",amb:0x3a8ab0,ambI:.6,lamp:0x7ae0ff,moonL:0x9ae8ff,moon:0xcff6ff,sky:"none",particles:"bubbles",pColor:0xcdeeff}
];
let currentTheme=0;
const U=1.2,D=.9,H=.22,EPS=1e-6,TY=1.0,TZ=-4.5,X0=-3.4;
const VAL={4:{n:"Ganze",c:"#77777a"},2:{n:"Halbe",c:"#77777a"},1:{n:"Viertel",c:"#77777a"},.5:{n:"Achtel",c:"#77777a"},.25:{n:"Sechzehntel",c:"#77777a"}};
const fmt=n=>{const q=Math.round(n*4),w=Math.floor(q/4),r=q%4;return `${w||""}${["","¼","½","¾"][r]}`||"0"};
const bookPages=()=>I18N.get("book");

const stage=$("stage"),scene=new THREE.Scene();
// Cannon.js übernimmt die Starrkörper-Physik: Schwerkraft, Reibung,
// Drehimpuls, Kollisionen und echtes Stapeln der Steinblöcke.
const physicsWorld=new CANNON.World();
physicsWorld.gravity.set(0,-18,0);
physicsWorld.broadphase=new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.solver.iterations=14;
physicsWorld.allowSleep=true;
physicsWorld.defaultContactMaterial.friction=.82;
physicsWorld.defaultContactMaterial.restitution=.015;
const stonePhysicsMaterial=new CANNON.Material("stone");
const groundPhysicsMaterial=new CANNON.Material("ground");
physicsWorld.addContactMaterial(new CANNON.ContactMaterial(stonePhysicsMaterial,groundPhysicsMaterial,{friction:.92,restitution:.01}));
physicsWorld.addContactMaterial(new CANNON.ContactMaterial(stonePhysicsMaterial,stonePhysicsMaterial,{friction:.78,restitution:.015}));
function addStaticPhysicsBox(sx,sy,sz,x,y,z,material=groundPhysicsMaterial){
  const body=new CANNON.Body({mass:0,material});
  body.addShape(new CANNON.Box(new CANNON.Vec3(sx/2,sy/2,sz/2)));
  body.position.set(x,y,z);physicsWorld.addBody(body);return body;
}
const groundBody=new CANNON.Body({mass:0,material:groundPhysicsMaterial});
groundBody.addShape(new CANNON.Plane());groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);physicsWorld.addBody(groundBody);
// Unsichtbare Begrenzungen halten Steine im Raum.
addStaticPhysicsBox(.3,9,14,-6.85,4.5,0);addStaticPhysicsBox(.3,9,14,6.85,4.5,0);
addStaticPhysicsBox(14,9,.3,0,4.5,-6.85);addStaticPhysicsBox(14,9,.3,0,4.5,6.85);
scene.background=new THREE.Color(0x050509);scene.fog=new THREE.FogExp2(0x050509,.09);
const cam=new THREE.PerspectiveCamera(70,1,.05,60);cam.rotation.order="YXZ";scene.add(cam);
const renderer=new THREE.WebGLRenderer({antialias:true});stage.insertBefore(renderer.domElement,stage.firstChild);
const ambientLight=new THREE.AmbientLight(0x4a5578,.36);scene.add(ambientLight);
const lamp=new THREE.PointLight(0xff9a3c,.95,14);lamp.position.set(0,2.4,-3.2);scene.add(lamp);
const lantern=new THREE.PointLight(0xffc080,.62,10);lantern.position.set(0,-.2,-.3);cam.add(lantern);
const moonL=new THREE.DirectionalLight(0x9db4f0,.48);moonL.position.set(-10,20,-15);scene.add(moonL);

// ---------- Raum ----------
// Jeder Raum hat sein eigenes Bodenmuster (Canvas-Textur, kachelbar).
const floorTextures={};
function floorTexture(style){
  if(floorTextures[style])return floorTextures[style];
  const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");
  const cracks=(col,n)=>{x.strokeStyle=col;x.lineWidth=2;for(let i=0;i<n;i++){x.beginPath();let px=Math.random()*256,py=Math.random()*256;x.moveTo(px,py);for(let j=0;j<4;j++){px+=Math.random()*50-25;py+=Math.random()*50-25;x.lineTo(px,py)}x.stroke()}};
  const speckle=(n,fn)=>{for(let i=0;i<n;i++){x.fillStyle=fn();const s=1+Math.random()*3;x.fillRect(Math.random()*256,Math.random()*256,s,s);}};
  if(style==="terracotta"){
    for(let r=0;r<4;r++)for(let q=0;q<4;q++){const v=Math.random()*18;x.fillStyle=`rgb(${150+v},${78+v*.6},${52+v*.4})`;x.fillRect(q*64,r*64,64,64);}
    x.strokeStyle="#5a2e22";x.lineWidth=4;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,256);x.moveTo(0,i*64);x.lineTo(256,i*64);x.stroke();}
    speckle(400,()=>`rgba(60,25,15,${Math.random()*.25})`);
  }else if(style==="ice"){
    const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,"#bfe4ff");g.addColorStop(1,"#8cc6ee");x.fillStyle=g;x.fillRect(0,0,256,256);
    x.strokeStyle="rgba(255,255,255,.75)";x.lineWidth=3;for(let i=0;i<=2;i++){x.beginPath();x.moveTo(i*128,0);x.lineTo(i*128,256);x.moveTo(0,i*128);x.lineTo(256,i*128);x.stroke();}
    cracks("rgba(255,255,255,.55)",10);speckle(220,()=>`rgba(255,255,255,${Math.random()*.6})`);
  }else if(style==="moss"){
    x.fillStyle="#2f5a2a";x.fillRect(0,0,256,256);
    speckle(2600,()=>{const g=70+Math.random()*90;return `rgba(${g*.45},${g},${g*.35},.55)`});
    for(let i=0;i<9;i++){x.fillStyle=`rgba(90,80,70,${.25+Math.random()*.3})`;x.beginPath();x.ellipse(Math.random()*256,Math.random()*256,10+Math.random()*16,7+Math.random()*10,Math.random()*3,0,6.3);x.fill();}
  }else if(style==="disco"){
    const cols=["#ff3ad0","#3affea","#ffe23a","#7a3aff"];
    for(let r=0;r<4;r++)for(let q=0;q<4;q++){x.fillStyle=cols[(r*3+q)%4];x.fillRect(q*64+3,r*64+3,58,58);x.fillStyle="rgba(255,255,255,.18)";x.fillRect(q*64+8,r*64+8,48,14);}
    x.strokeStyle="#12001f";x.lineWidth=6;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,256);x.moveTo(0,i*64);x.lineTo(256,i*64);x.stroke();}
  }else if(style==="seabed"){
    x.fillStyle="#c9b07a";x.fillRect(0,0,256,256);
    x.strokeStyle="rgba(120,95,55,.35)";x.lineWidth=3;
    for(let i=0;i<14;i++){x.beginPath();const y0=i*19+Math.random()*6;x.moveTo(0,y0);for(let px=0;px<=256;px+=16)x.lineTo(px,y0+Math.sin(px/22+i)*5);x.stroke();}
    speckle(500,()=>`rgba(255,250,230,${Math.random()*.4})`);
  }else{
    x.fillStyle="#29292e";x.fillRect(0,0,256,256);x.fillStyle="#222227";x.fillRect(0,0,128,128);x.fillRect(128,128,128,128);
    cracks("rgba(0,0,0,.5)",14);
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(style==="disco"?4:7,style==="disco"?4:7);t.anisotropy=4;
  return floorTextures[style]=t;
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({map:floorTexture("ruin"),roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.userData.kind="floor";scene.add(floor);
const wallM=new THREE.MeshStandardMaterial({color:0xe9dcc3,side:THREE.DoubleSide});
[].forEach(([x,z,r])=>{
  const w=new THREE.Mesh(new THREE.PlaneGeometry(14,3.4),wallM);
  if(x===0)w.position.set(0,1.7,z);else w.position.set(x,1.7,0);w.rotation.y=r;scene.add(w)});
const ceil=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({color:0xf5f0e6}));
// Ruine: offene Decke, kaputte Mauern, Säulen, Schutt, Sternenhimmel
const PIL=[[-5.2,-1],[5.2,-1],[-5.2,3.5],[5.2,3.5]];
let ruinStoneMat=null,moonMesh=null,starField=null;
function buildRuin(){
  const stone=new THREE.MeshStandardMaterial({color:0x414147,roughness:1});ruinStoneMat=stone;
  for(let s=0;s<4;s++)for(let i=-7;i<7;i++){
    if(Math.random()<.18)continue;
    const h=Math.random()<.3?3.4:.8+Math.random()*2.2,b=new THREE.Mesh(new THREE.BoxGeometry(1,h,.6),stone),a=i+.5;
    if(s<2)b.position.set(a,h/2,s?7:-7);else{b.position.set(s===2?-7:7,h/2,a);b.rotation.y=Math.PI/2}
    scene.add(b)}
  PIL.forEach(p=>{const h=1.4+Math.random()*2,c=new THREE.Mesh(new THREE.CylinderGeometry(.34,.4,h,10),stone);c.position.set(p[0],h/2,p[1]);scene.add(c)});
  for(let i=0;i<22;i++){const s=.2+Math.random()*.5,b=new THREE.Mesh(new THREE.BoxGeometry(s,s*.7,s*1.2),stone),edge=Math.random()<.5;
    b.position.set(edge?(Math.random()<.5?-1:1)*(5.6+Math.random()*1.2):(Math.random()*2-1)*6.2,s*.35,edge?(Math.random()*2-1)*6.2:5.8+Math.random());
    b.rotation.set(Math.random(),Math.random()*3,Math.random()*.5);scene.add(b)}
  const sg=new THREE.BufferGeometry(),sp=[];
  for(let i=0;i<500;i++){const a=Math.random()*6.28,e=.2+Math.random()*1.2;sp.push(Math.cos(a)*Math.cos(e)*45,Math.sin(e)*45,Math.sin(a)*Math.cos(e)*45)}
  sg.setAttribute("position",new THREE.Float32BufferAttribute(sp,3));
  starField=new THREE.Points(sg,new THREE.PointsMaterial({size:.45,color:0xffffff,fog:false}));scene.add(starField);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.2,24,16),new THREE.MeshBasicMaterial({color:0xdfe8ff,fog:false}));moon.position.set(-22,26,-30);scene.add(moon);moonMesh=moon;
}
buildRuin();

// Schlichter Holztisch ohne Taktfeld, Linien oder Beschriftung
const wood=new THREE.MeshStandardMaterial({color:0x583719,roughness:.88});
const tabletop=new THREE.Mesh(new THREE.BoxGeometry(8,.12,2.4),wood);
tabletop.position.set(0,TY-.06,TZ);tabletop.userData.kind="table";scene.add(tabletop);
const gameTableBody=addStaticPhysicsBox(8,.12,2.4,0,TY-.06,TZ);
// Unsichtbare, federnde Wände hinter und neben dem Tisch: zu fest geworfene Steine
// prallen ab und fallen zurück auf die Tischplatte.
const bounceWallMaterial=new CANNON.Material("bounceWall");
physicsWorld.addContactMaterial(new CANNON.ContactMaterial(stonePhysicsMaterial,bounceWallMaterial,{friction:.05,restitution:.45}));
const tableWallBodies=[
  addStaticPhysicsBox(8.6,6,.3,0,TY-.05+3,TZ-1.2-.15,bounceWallMaterial),   // hinten
  addStaticPhysicsBox(.3,6,2.7,-4.15,TY-.05+3,TZ,bounceWallMaterial),      // links
  addStaticPhysicsBox(.3,6,2.7,4.15,TY-.05+3,TZ,bounceWallMaterial)        // rechts
];
[[-3.8,-1],[3.8,-1],[-3.8,1],[3.8,1]].forEach(([dx,dz])=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.2,TY-.12,.2),wood);l.position.set(dx,(TY-.12)/2,TZ+dz*1.0);scene.add(l)});

// Roter 3D-Prüfen-Knopf steht direkt auf der Tischplatte.
function checkLabelTexture(){
  const c=document.createElement("canvas");c.width=360;c.height=180;const x=c.getContext("2d");
  x.fillStyle="#a51f27";x.fillRect(0,0,360,180);x.strokeStyle="#f7e8d0";x.lineWidth=10;x.strokeRect(6,6,348,168);
  x.fillStyle="#fff";x.textAlign="center";x.font="bold 58px system-ui";x.fillText(tr("checkLabel"),180,112);
  return new THREE.CanvasTexture(c);
}
const checkLabelMat=new THREE.MeshStandardMaterial({map:checkLabelTexture(),color:0xffffff});
function refreshCheckLabel(){if(checkLabelMat.map)checkLabelMat.map.dispose();checkLabelMat.map=checkLabelTexture();checkLabelMat.needsUpdate=true;}
const checkButton=new THREE.Mesh(
  new THREE.BoxGeometry(1.18,.2,.82),
  [new THREE.MeshStandardMaterial({color:0x702027}),new THREE.MeshStandardMaterial({color:0x702027}),checkLabelMat,new THREE.MeshStandardMaterial({color:0x55151b}),new THREE.MeshStandardMaterial({color:0x702027}),new THREE.MeshStandardMaterial({color:0x702027})]
);
checkButton.position.set(3.15,TY+.1,TZ);checkButton.userData.kind="check";scene.add(checkButton);

// Eigener kleiner Lesetisch auf der gegenüberliegenden Raumseite.
// Der große Spieltisch mit den Noten und dem PRÜFEN-Knopf bleibt am anderen Ende.
// Lesetisch und Shop-Tisch stehen nebeneinander und sind zusammen mittig im Raum.
const BOOK_TABLE_W=3.4,SHOP_W=3.8,TABLE_GAP=.8;
const TABLES_LEFT=-(BOOK_TABLE_W+TABLE_GAP+SHOP_W)/2;
const BOOK_TABLE_X=TABLES_LEFT+BOOK_TABLE_W/2,BOOK_TABLE_Z=5.15,BOOK_TABLE_Y=1.0;
const SHOP_X=TABLES_LEFT+BOOK_TABLE_W+TABLE_GAP+SHOP_W/2;
const isTablesArea=(x,z,pad=0)=>Math.abs(x)<-TABLES_LEFT+pad&&z>4.05-pad&&z<6.25+pad;
const bookTableWood=new THREE.MeshStandardMaterial({color:0x634326,roughness:.9});
const bookTableTop=new THREE.Mesh(new THREE.BoxGeometry(BOOK_TABLE_W,.14,2.15),bookTableWood);
bookTableTop.position.set(BOOK_TABLE_X,BOOK_TABLE_Y-.07,BOOK_TABLE_Z);
scene.add(bookTableTop);
addStaticPhysicsBox(BOOK_TABLE_W,.14,2.15,BOOK_TABLE_X,BOOK_TABLE_Y-.07,BOOK_TABLE_Z);
for(const [dx,dz] of [[-1.5,-.82],[1.5,-.82],[-1.5,.82],[1.5,.82]]){
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,BOOK_TABLE_Y-.14,.2),bookTableWood);
  leg.position.set(BOOK_TABLE_X+dx,(BOOK_TABLE_Y-.14)/2,BOOK_TABLE_Z+dz);
  scene.add(leg);
}
// Das Buch liegt auf diesem separaten Tisch; zum Lesen fährt die Kamera
// nah und senkrecht über die Seiten.
const BOOK_X=BOOK_TABLE_X,BOOK_Z=BOOK_TABLE_Z,BOOK_SURFACE=BOOK_TABLE_Y+.185;
const TABLE_NOTE_Z=TZ+.68;
const bookGroup=new THREE.Group();bookGroup.position.set(BOOK_X,BOOK_TABLE_Y,BOOK_Z);
// The book was facing the wrong way round. Turn the complete book 180 degrees
// on the tabletop; its page hit zones are remapped to match the visible sides.
bookGroup.rotation.y=Math.PI;
scene.add(bookGroup);
const bookCoverMat=new THREE.MeshStandardMaterial({color:0x48251c,roughness:.92});
const bookCover=new THREE.Mesh(new THREE.BoxGeometry(2.18,.14,1.38),bookCoverMat);
bookCover.position.set(0,.075,0);bookGroup.add(bookCover);
const pageEdge=new THREE.Mesh(new THREE.BoxGeometry(2.08,.035,1.28),new THREE.MeshStandardMaterial({color:0xbba982,roughness:1}));
pageEdge.position.set(0,.16,0);bookGroup.add(pageEdge);
const bookSpine=new THREE.Mesh(new THREE.BoxGeometry(.10,.025,1.27),new THREE.MeshStandardMaterial({color:0x30170f,roughness:1}));
bookSpine.position.set(0,.185,0);bookGroup.add(bookSpine);
function makeBookPageTexture(index){
  const c=document.createElement("canvas");c.width=800;c.height=1100;
  const x=c.getContext("2d"),page=bookPages()[index];
  x.fillStyle="#f0e3c7";x.fillRect(0,0,800,1100);
  x.fillStyle="#e8d7b6";x.fillRect(20,20,760,1060);
  x.strokeStyle="#a88c60";x.lineWidth=5;x.strokeRect(24,24,752,1052);
  x.textAlign="center";x.fillStyle="#442f20";x.font="bold 48px Georgia";x.fillText(page.title,400,112);
  x.strokeStyle="#b59a70";x.lineWidth=2;x.beginPath();x.moveTo(88,150);x.lineTo(712,150);x.stroke();
  if(page.credits){
    let cy=280;
    for(const [line,size] of I18N.get("bookCredits")){x.fillStyle="#766047";x.font=`bold ${size}px Georgia`;x.fillText(line,400,cy);cy+=size+34;}
    x.fillStyle="#362317";x.font="bold 72px Georgia";x.fillText("Tewe444",400,cy+80);
    x.font="38px Georgia";x.fillText("Waldorfschule Rostock",400,cy+150);
  }else if(index===1){
    // Notenwerte im Buch: Notenkopf und Hals/Fähnchen stehen direkt neben dem Namen.
    const rows=[4,2,1,.5,.25].map((len,i)=>({len,name:I18N.get("noteRows")[i][0],value:I18N.get("noteRows")[i][1]}));
    rows.forEach((row,i)=>{
      const cy=235+i*158;
      x.strokeStyle="rgba(120,95,62,.48)";x.lineWidth=2;
      for(let j=0;j<5;j++){x.beginPath();x.moveTo(75,cy-25+j*13);x.lineTo(235,cy-25+j*13);x.stroke();}
      x.save();x.translate(157,cy-1);x.rotate(-.34);
      x.beginPath();x.ellipse(0,0,27,18,0,0,Math.PI*2);
      x.fillStyle="#34271c";x.strokeStyle="#34271c";x.lineWidth=7;
      if(row.len===4||row.len===2)x.stroke();else x.fill();
      x.restore();
      if(row.len!==4){
        x.strokeStyle="#34271c";x.lineWidth=8;x.lineCap="round";
        x.beginPath();x.moveTo(181,cy-7);x.lineTo(181,cy-91);x.stroke();
        const flags=row.len===.25?2:(row.len===.5?1:0);
        for(let f=0;f<flags;f++){
          const fy=cy-88+f*25;x.beginPath();x.moveTo(181,fy);x.lineTo(232,fy);x.stroke();
        }
      }
      x.textAlign="left";x.fillStyle="#34271c";x.font="bold 31px Georgia";x.fillText(row.name,285,cy-1);
      x.font="26px Georgia";x.fillStyle="#69543c";x.fillText(row.value,285,cy+43);
    });
  }else{
    x.textAlign="left";x.fillStyle="#34271c";x.font="32px Georgia";
    const paragraphs=page.text.split("\n");let y=225;
    for(const para of paragraphs){
      if(!para.trim()){y+=22;continue;}
      const words=para.split(/\s+/);let line="";
      for(const word of words){
        const test=line?line+" "+word:word;
        if(x.measureText(test).width>625){x.fillText(line,88,y);line=word;y+=48;}
        else line=test;
      }
      if(line){x.fillText(line,88,y);y+=58;}
    }
  }
  x.textAlign="center";x.fillStyle="#8a7353";x.font="21px Georgia";
  x.fillText(tr("bookHint"),400,1048);
  return new THREE.CanvasTexture(c);
}
const bookLeftMat=new THREE.MeshStandardMaterial({map:makeBookPageTexture(0),roughness:1,side:THREE.DoubleSide});
const bookRightMat=new THREE.MeshStandardMaterial({map:makeBookPageTexture(1),roughness:1,side:THREE.DoubleSide});
const bookLeftPage=new THREE.Mesh(new THREE.PlaneGeometry(.98,1.23),bookLeftMat);
const bookRightPage=new THREE.Mesh(new THREE.PlaneGeometry(.98,1.23),bookRightMat);
for(const [mesh,x] of [[bookLeftPage,-.55],[bookRightPage,.55]]){
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.185,0);mesh.userData.kind="book";
  // Die Buchgruppe ist um 180 Grad gedreht: lokales +X liegt auf dem Bildschirm rechts.
  mesh.userData.side=x>0?"right":"left";bookGroup.add(mesh);
}
let bookSpread=0,bookMode=false,cameraAnim=null,bookFlipAnim=null;
function setBookSpread(spread){
  bookSpread=Math.max(0,Math.min(bookPages().length-2,spread));
  for(const [mat,index] of [[bookLeftMat,bookSpread],[bookRightMat,bookSpread+1]]){
    if(mat.map)mat.map.dispose();mat.map=makeBookPageTexture(index);mat.needsUpdate=true;
  }
}
const bookFlipMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
function turnBook(side){
  if(bookFlipAnim)return;
  const nextSpread=side==="right"?bookSpread+2:bookSpread-2;
  if(nextSpread<0||nextSpread+1>=bookPages().length)return;
  // The hinge is at the inner edge. The physical book is rotated 180 degrees,
  // so the screen-right leaf is local +X and the screen-left leaf local -X.
  const hingeX=side==="right"?.06:-.06;
  const localX=side==="right"?.49:-.49;
  const pivot=new THREE.Group();pivot.position.set(hingeX,.19,0);bookGroup.add(pivot);
  const page=new THREE.Mesh(new THREE.PlaneGeometry(.98,1.23),bookFlipMat);
  page.rotation.x=-Math.PI/2;page.position.set(localX,0,0);pivot.add(page);
  const startIndex=side==="right"?bookSpread+1:bookSpread;
  const nextIndex=side==="right"?bookSpread+2:bookSpread-1;
  if(bookFlipMat.map)bookFlipMat.map.dispose();
  bookFlipMat.map=makeBookPageTexture(startIndex);bookFlipMat.needsUpdate=true;
  bookFlipAnim={pivot,page,side,nextSpread,nextIndex,t:0,duration:.62,swapped:false,direction:side==="right"?Math.PI:-Math.PI};
  SFX.play("bookFlip",.8);
}
function openBook(){
  if(bookMode)return;
  bookMode=true;document.body.classList.add("book-open");setBookSpread(0);SFX.play("bookOpen",.9);
  const backButton=$("bookBack");if(backButton)backButton.hidden=false;
  if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
  // Directly above the open pages, with the camera's -Z axis aimed at the book.
  // Use a Camera (not a generic Object3D): Object3D.lookAt points its +Z axis
  // at the target, which made the old view point away from the pages.
  const targetPos=new THREE.Vector3(BOOK_X,BOOK_SURFACE+1.75,BOOK_Z);
  const rig=new THREE.PerspectiveCamera();
  rig.position.copy(targetPos);
  rig.up.set(0,0,1); // screen top follows the book page heading; fixes the 180-degree upside-down view
  rig.lookAt(new THREE.Vector3(BOOK_X,BOOK_SURFACE,BOOK_Z));
  resize();
  cameraAnim={fromPos:cam.position.clone(),fromQuat:cam.quaternion.clone(),toPos:targetPos,toQuat:rig.quaternion.clone(),t:0,duration:.8};
}
function closeBook(){
  if(!bookMode)return;
  bookMode=false;document.body.classList.remove("book-open");SFX.play("bookClose",.8);
  const backButton=$("bookBack");if(backButton)backButton.hidden=true;
  cam.up.set(0,1,0);resize();
  const targetPos=new THREE.Vector3(P.x,P.y+PLAYER_EYE,P.z);
  const euler=new THREE.Euler(pitch,yaw,0,"YXZ"),targetQuat=new THREE.Quaternion().setFromEuler(euler);
  cameraAnim={fromPos:cam.position.clone(),fromQuat:cam.quaternion.clone(),toPos:targetPos,toQuat:targetQuat,t:0,duration:.65};
}

// ---------- Blender-Modelle (models.js enthält das GLB als Base64) ----------
const MODELS={};
let modelsReady=false;const onModelsReady=[];
function whenModels(fn){if(modelsReady)fn();else onModelsReady.push(fn);}
function cloneModel(name){const m=MODELS[name];return m?m.clone():null;}
(function loadModels(){
  try{
    if(!window.NR_MODELS_GLB||!THREE.GLTFLoader)throw new Error("Modelle oder GLTFLoader fehlen");
    const bin=atob(window.NR_MODELS_GLB),buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(buf.buffer,"",gltf=>{
      gltf.scene.traverse(o=>{
        if(o.isMesh){
          // Emissive Blender-Materialien sollen auch im Nebel leuchten.
          const ms=Array.isArray(o.material)?o.material:[o.material];
          ms.forEach(m=>{if(m.emissive&&m.emissive.getHex()!==0){m.emissiveIntensity=1.2;m.fog=false;}
          // Ohne Umgebungs-Spiegelung wirken Metalle fast schwarz: Spiegel (Discokugel) und Gold aufhellen.
          if(m.name==="Spiegel"){m.metalness=.25;m.roughness=.3;m.emissive.set(0x4a5060);m.flatShading=true;m.needsUpdate=true;}
          else if(m.metalness>.8){m.metalness=.45;m.roughness=Math.max(.3,m.roughness);m.emissive.set(0x3a2a00);}});
        }
      });
      gltf.scene.children.slice().forEach(o=>{o.position.set(0,0,0);MODELS[o.name]=o;});
      modelsReady=true;onModelsReady.splice(0).forEach(fn=>{try{fn();}catch(e){console.error(e);}});
    },err=>console.warn("GLB konnte nicht geladen werden",err));
  }catch(e){console.warn(e.message);}
})();

// ---------- Raum-Designs: Deko, Himmel, Teilchen ----------
const themeDecor=THEMES.map(()=>{const g=new THREE.Group();g.visible=false;scene.add(g);return g;});
const animatedDecor=[]; // {obj,theme,fn}
function placeDecor(theme,name,x,z,{s=1,ry=Math.random()*6.28,y=0,anim=null}={}){
  const o=cloneModel(name);if(!o)return null;
  o.position.set(x,y,z);o.rotation.y=ry;o.scale.setScalar(s);themeDecor[theme].add(o);
  if(anim)animatedDecor.push({obj:o,theme,fn:anim,base:o.position.clone(),seed:Math.random()*100});
  return o;
}
// Positionen außerhalb der Ruinenmauern (sichtbar durch die Lücken und darüber).
function ring(n,r0,r1,fn){for(let i=0;i<n;i++){const a=i/n*Math.PI*2+Math.random()*.25,r=r0+Math.random()*(r1-r0);fn(Math.cos(a)*r,Math.sin(a)*r,i);}}
const CORNERS=[[-6.1,-6.1],[6.1,-6.1],[-6.1,6.1],[6.1,6.1]];
whenModels(()=>{
  // 0 Mondruine: Felsen und alte Säulen draußen
  ring(10,8,13,(x,z)=>placeDecor(0,Math.random()<.5?"deco_rock":"deco_column",x,z,{s:.8+Math.random()*.8}));
  // 1 Sonnenuntergang: Palmen draußen, Laternen in den Ecken
  ring(14,8,13,(x,z)=>placeDecor(1,"deco_palm",x,z,{s:.9+Math.random()*.6}));
  CORNERS.forEach(([x,z])=>placeDecor(1,"deco_lantern",x,z,{anim:(o,t,d)=>{o.rotation.z=Math.sin(t*1.3+d.seed)*.04;}}));
  ring(6,8,11,(x,z)=>placeDecor(1,"deco_rock",x,z,{s:.7}));
  // 2 Eiswelt: Kristalle und ein Schneemann
  ring(16,7.8,12,(x,z)=>placeDecor(2,"deco_crystal",x,z,{s:.9+Math.random()*1.1}));
  CORNERS.slice(0,2).forEach(([x,z])=>placeDecor(2,"deco_crystal",x,z,{s:.6}));
  placeDecor(2,"deco_snowman",-6.0,6.0,{ry:Math.PI*.75});
  // 3 Wald: dichter Tannenring, Pilze in den Ecken
  ring(26,8,15,(x,z)=>placeDecor(3,"deco_pine",x,z,{s:.8+Math.random()*.9}));
  CORNERS.forEach(([x,z])=>placeDecor(3,"deco_mushroom",x,z,{s:.8+Math.random()*.5}));
  // 4 Neon-Disco: Discokugel, Boxen in den Ecken
  placeDecor(4,"deco_discoball",0,.5,{y:5.2,anim:(o,t)=>{o.rotation.y=t*.6;}});
  CORNERS.forEach(([x,z])=>placeDecor(4,"deco_speaker",x,z,{ry:Math.atan2(-x,-z),anim:(o,t,d)=>{const k=1+Math.max(0,Math.sin(t*8.5+d.seed))*.04;o.scale.set(k,k,k);}}));
  // 5 Unterwasser: Korallen, Seetang, Fische
  ring(12,7.8,12,(x,z)=>placeDecor(5,"deco_coral",x,z,{s:.8+Math.random()*.6}));
  ring(14,7.6,11,(x,z)=>placeDecor(5,"deco_seaweed",x,z,{s:1+Math.random()*.8,anim:(o,t,d)=>{o.rotation.x=Math.sin(t*.9+d.seed)*.08;o.rotation.z=Math.cos(t*.7+d.seed)*.08;}}));
  CORNERS.slice(2).forEach(([x,z])=>placeDecor(5,"deco_seaweed",x,z,{s:.7}));
  for(let i=0;i<7;i++){
    const r=7.5+Math.random()*5,h=2.5+Math.random()*3,sp=.12+Math.random()*.12,dir=Math.random()<.5?1:-1;
    placeDecor(5,"deco_fish",0,0,{s:.6+Math.random()*.5,anim:(o,t,d)=>{const a=d.seed+t*sp*dir;o.position.set(Math.cos(a)*r,h+Math.sin(t+d.seed)*.3,Math.sin(a)*r);o.rotation.y=-a-(dir>0?0:Math.PI);}});
  }
  applyTheme(currentTheme);
});
// Sonne für den Sonnenuntergang (statt Mond)
const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(5,32,16),new THREE.MeshBasicMaterial({color:0xff8a3c,fog:false}));
sunMesh.position.set(0,4,-48);sunMesh.visible=false;scene.add(sunMesh);
function glowSprite(color,size){
  const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.25,"rgba(255,255,255,.55)");g.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),color,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  s.scale.set(size,size,1);return s;
}
const sunGlow=glowSprite(0xff7a3c,26);sunGlow.position.copy(sunMesh.position);sunGlow.visible=false;scene.add(sunGlow);
// Disco-Scheinwerfer
const discoSpots=[0xff3ad0,0x3affea,0xffe23a].map((c,i)=>{const s=new THREE.SpotLight(c,0,18,.35,.5,1);s.position.set(0,5,0);scene.add(s);scene.add(s.target);return s;});
// Unterwasser-Lichtstrahlen
const rayMat=new THREE.MeshBasicMaterial({color:0x9ae8ff,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false});
const seaRays=new THREE.Group();seaRays.visible=false;scene.add(seaRays);
for(let i=0;i<7;i++){const r=new THREE.Mesh(new THREE.ConeGeometry(1.2+Math.random(),14,12,1,true),rayMat);r.position.set(-5+i*1.7,6,-3+Math.random()*7);r.rotation.z=.25;seaRays.add(r);}
// Schwebende Teilchen (Staub, Schnee, Glühwürmchen …)
const PARTICLE_N=260;
const partGeo=new THREE.BufferGeometry(),partPos=new Float32Array(PARTICLE_N*3),partSeed=new Float32Array(PARTICLE_N);
for(let i=0;i<PARTICLE_N;i++){partPos[i*3]=(Math.random()*2-1)*7;partPos[i*3+1]=Math.random()*6;partPos[i*3+2]=(Math.random()*2-1)*7;partSeed[i]=Math.random()*100;}
partGeo.setAttribute("position",new THREE.BufferAttribute(partPos,3));
const partDot=(()=>{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.35,"rgba(255,255,255,.8)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const partMat=new THREE.PointsMaterial({size:.06,map:partDot,color:0xffffff,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending});
const particles=new THREE.Points(partGeo,partMat);particles.frustumCulled=false;scene.add(particles);
function updateParticles(dt,now){
  const t=THEMES[currentTheme],kind=t.particles,s=now/1000;
  for(let i=0;i<PARTICLE_N;i++){
    const k=i*3,sd=partSeed[i];
    if(kind==="snow"){partPos[k+1]-=dt*(.5+(sd%1)*.5);partPos[k]+=Math.sin(s+sd)*dt*.3;}
    else if(kind==="embers"){partPos[k+1]+=dt*(.25+(sd%1)*.35);partPos[k]+=Math.sin(s*1.5+sd)*dt*.2;}
    else if(kind==="bubbles"){partPos[k+1]+=dt*(.6+(sd%1)*.6);partPos[k]+=Math.sin(s*3+sd)*dt*.15;}
    else if(kind==="fireflies"){partPos[k]+=Math.sin(s*.7+sd)*dt*.4;partPos[k+1]+=Math.sin(s*.9+sd*2)*dt*.25;partPos[k+2]+=Math.cos(s*.6+sd)*dt*.4;}
    else{partPos[k]+=Math.sin(s*.2+sd)*dt*.05;partPos[k+1]+=Math.sin(s*.3+sd)*dt*.03;}
    if(partPos[k+1]<0)partPos[k+1]+=6;if(partPos[k+1]>6)partPos[k+1]-=6;
    if(partPos[k]>7)partPos[k]-=14;if(partPos[k]<-7)partPos[k]+=14;
    if(partPos[k+2]>7)partPos[k+2]-=14;if(partPos[k+2]<-7)partPos[k+2]+=14;
  }
  partGeo.attributes.position.needsUpdate=true;
  if(kind==="fireflies")partMat.opacity=.55+Math.sin(s*3)*.35;
  if(kind==="sparkles")partMat.color.setHSL((s*.2)%1,1,.7);
  for(const d of animatedDecor)if(d.theme===currentTheme)d.fn(d.obj,s,d);
  if(t.sky==="none"&&currentTheme===4){
    discoSpots.forEach((sp,i)=>{const a=s*(.7+i*.25)+i*2.1;sp.target.position.set(Math.cos(a)*4,0,Math.sin(a)*4);});
    floor.material.emissiveIntensity=.22+Math.max(0,Math.sin(s*8.5))*.2;
  }
  if(currentTheme===5)seaRays.children.forEach((r,i)=>{r.material.opacity=.05+Math.sin(s*.6+i)*.025;});
}

// ---------- Raum-Designs anwenden ----------
function applyTheme(i){
  const t=THEMES[i]||THEMES[0];
  currentTheme=THEMES[i]?i:0;
  setThemeMusic(currentTheme);
  scene.background.set(t.bg);scene.fog.color.set(t.fog);scene.fog.density=t.fogD;
  if(ruinStoneMat)ruinStoneMat.color.set(t.stone);
  floor.material.map=floorTexture(t.floorStyle);floor.material.color.set(t.floor);
  floor.material.emissive=floor.material.emissive||new THREE.Color();
  if(t.floorStyle==="disco"){floor.material.emissive.set(0xffffff);floor.material.emissiveMap=floor.material.map;}
  else{floor.material.emissive.set(0x000000);floor.material.emissiveMap=null;}
  floor.material.needsUpdate=true;
  ambientLight.color.set(t.amb);ambientLight.intensity=t.ambI;lamp.color.set(t.lamp);moonL.color.set(t.moonL);
  if(moonMesh){moonMesh.material.color.set(t.moon);moonMesh.visible=t.sky==="moon";}
  sunMesh.visible=sunGlow.visible=t.sky==="sun";
  if(starField)starField.visible=t.sky!=="none"||currentTheme===4;
  themeDecor.forEach((g,k)=>g.visible=k===currentTheme);
  discoSpots.forEach(s=>s.intensity=currentTheme===4?2.2:0);
  seaRays.visible=currentTheme===5;
  partMat.color.set(t.pColor);partMat.opacity=.8;
  partMat.size=t.particles==="snow"?.14:t.particles==="bubbles"?.15:t.particles==="fireflies"?.16:.08;
}

// ---------- Shop neben dem Buch ----------
const SHOP_Z=5.15,SHOP_Y=1.0;
const shopWood=new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:.9});
const shopTop=new THREE.Mesh(new THREE.BoxGeometry(SHOP_W,.14,2.15),shopWood);
shopTop.position.set(SHOP_X,SHOP_Y-.07,SHOP_Z);scene.add(shopTop);
addStaticPhysicsBox(SHOP_W,.14,2.15,SHOP_X,SHOP_Y-.07,SHOP_Z);
for(const [dx,dz] of [[-1.7,-.82],[1.7,-.82],[-1.7,.82],[1.7,.82]]){
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,SHOP_Y-.14,.2),shopWood);
  leg.position.set(SHOP_X+dx,(SHOP_Y-.14)/2,SHOP_Z+dz);scene.add(leg);
}
// Schild hinter dem Tisch
function shopSignTexture(){
  const c=document.createElement("canvas");c.width=512;c.height=140;const x=c.getContext("2d");
  x.fillStyle="#3b2814";x.fillRect(0,0,512,140);x.strokeStyle="#d9b25a";x.lineWidth=8;x.strokeRect(6,6,500,128);
  x.fillStyle="#ffd43b";x.textAlign="center";x.font="bold 58px Georgia";x.fillText("SHOP",256,68);
  x.fillStyle="#f1e3c2";x.font="30px Georgia";x.fillText(tr("shopSign"),256,112);
  return new THREE.CanvasTexture(c);
}
const shopSignMat=new THREE.MeshStandardMaterial({map:shopSignTexture(),roughness:.9});
function refreshShopSign(){if(shopSignMat.map)shopSignMat.map.dispose();shopSignMat.map=shopSignTexture();shopSignMat.needsUpdate=true;}
{
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.6),shopSignMat);
  sign.position.set(SHOP_X,SHOP_Y+1.15,SHOP_Z+.95);sign.rotation.y=Math.PI;scene.add(sign);
  for(const dx of [-1.0,1.0]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1.15,.08),shopWood);
    post.position.set(SHOP_X+dx,SHOP_Y+.575,SHOP_Z+.95);scene.add(post);
  }
}
// Jeder Raum ist eine kleine 3D-Figur (aus Blender) mit Preisschild darüber.
function shopLabelTexture(i){
  const t=THEMES[i],c=document.createElement("canvas");c.width=320;c.height=150;const x=c.getContext("2d");
  const owned=save.owned.includes(i),active=save.theme===i;
  x.fillStyle=active?"rgba(24,78,40,.92)":owned?"rgba(24,52,82,.92)":"rgba(40,26,12,.92)";
  x.beginPath();x.roundRect?x.roundRect(4,4,312,142,26):x.rect(4,4,312,142);x.fill();
  x.lineWidth=6;x.strokeStyle=active?"#7dff9a":owned?"#8cc8ff":"#ffd43b";x.stroke();
  x.textAlign="center";x.fillStyle="#fff";
  const name=roomName(i);
  let fs=40;x.font=`bold ${fs}px Georgia`;while(x.measureText(name).width>290&&fs>18){fs--;x.font=`bold ${fs}px Georgia`;}
  x.fillText(name,160,62);
  x.font="bold 44px system-ui,sans-serif";
  x.fillStyle=active?"#9dffb0":owned?"#bfe0ff":"#ffd43b";
  x.fillText(active?tr("shopActive"):owned?tr("shopSelect"):(t.price?"🪙 "+t.price:tr("shopFree")),160,122);
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=4;return tex;
}
const shopItems=[];
const activeRing=new THREE.Mesh(new THREE.TorusGeometry(.36,.025,8,40),new THREE.MeshBasicMaterial({color:0x7dff9a,fog:false}));
activeRing.rotation.x=Math.PI/2;scene.add(activeRing);
THEMES.forEach((t,i)=>{
  const g=new THREE.Group();
  const row=i%2; // zwei versetzte Reihen
  g.position.set(SHOP_X+(i-(THEMES.length-1)/2)*.58,SHOP_Y,SHOP_Z+(row?.38:-.38));
  g.userData={kind:"shop",idx:i};
  // Unsichtbare Klickfläche, damit die Figur leicht zu treffen ist.
  const hit=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.7,12),new THREE.MeshBasicMaterial({visible:false}));
  hit.position.y=.35;g.add(hit);
  const holder=new THREE.Group();holder.scale.setScalar(.6);g.add(holder);
  const placeholder=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.12,20),new THREE.MeshStandardMaterial({color:t.stone}));
  placeholder.position.y=.06;holder.add(placeholder);
  const labelMat=new THREE.SpriteMaterial({map:shopLabelTexture(i),transparent:true,fog:false,depthWrite:false});
  const label=new THREE.Sprite(labelMat);label.scale.set(.6,.28,1);label.position.y=row?1.0:.78;label.raycast=()=>{};g.add(label);
  g.userData.labelMat=labelMat;g.userData.holder=holder;
  scene.add(g);shopItems.push(g);
});
whenModels(()=>shopItems.forEach(g=>{
  const m=cloneModel("mini_"+g.userData.idx);if(!m)return;
  g.userData.holder.clear();g.userData.holder.add(m);
}));
function refreshShop(){
  shopItems.forEach(g=>{
    const mat=g.userData.labelMat;if(mat.map)mat.map.dispose();
    mat.map=shopLabelTexture(g.userData.idx);mat.needsUpdate=true;
  });
  const a=shopItems[save.theme]||shopItems[0];
  activeRing.position.set(a.position.x,SHOP_Y+.012,a.position.z);
}
refreshShop();
function updateShop(dt,now){
  shopItems.forEach(g=>{
    const i=g.userData.idx,active=i===save.theme,owned=save.owned.includes(i);
    g.userData.holder.rotation.y+=dt*(active?.9:owned?.4:.25);
    g.userData.holder.position.y=active?.04+Math.sin(now/400)*.03:0;
  });
  activeRing.scale.setScalar(1+Math.sin(now/300)*.05);
}
function useShopItem(i){
  const th=THEMES[i];if(!th)return;
  const room=roomName(i);
  if(mode!=="game"){wrongSound();showToast(tr("shopLocked"));return;}
  if(save.owned.includes(i)){
    if(save.theme===i){SFX.play("click");showToast(tr("alreadyActive",{room}));return;}
    save.theme=i;applyTheme(i);persist();refreshShop();SFX.play("select");showToast(tr("selected",{room}));
  }else if(save.coins>=th.price){
    save.coins-=th.price;save.owned.push(i);save.theme=i;applyTheme(i);persist();updateCoinHud();refreshShop();
    SFX.play("buy");setTimeout(()=>SFX.play("unlock",.8),180);showToast(tr("bought",{room}));
  }else{
    wrongSound();showToast(tr("tooPoor",{room,price:th.price,coins:save.coins}));
  }
}

// ---------- Steingraue Notenblöcke mit Notensymbol ----------
const BLOCK_W=U-.06, BLOCK_D=D, BLOCK_H=H;
const stoneCanvas=document.createElement("canvas");stoneCanvas.width=stoneCanvas.height=256;
const stoneCtx=stoneCanvas.getContext("2d");
function paintStone(ctx){
  ctx.fillStyle="#77777a";ctx.fillRect(0,0,256,256);
  for(let i=0;i<1900;i++){
    const v=75+Math.random()*85;ctx.fillStyle=`rgba(${v},${v},${v+2},${.08+Math.random()*.2})`;
    const s=.5+Math.random()*5;ctx.fillRect(Math.random()*256,Math.random()*256,s,s*.7);
  }
  for(let i=0;i<22;i++){
    const x=Math.random()*256,y=Math.random()*256;ctx.strokeStyle="rgba(28,29,31,.2)";ctx.lineWidth=1+Math.random()*2;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(Math.random()-.5)*35,y+(Math.random()-.5)*28);ctx.lineTo(x+(Math.random()-.5)*55,y+(Math.random()-.5)*48);ctx.stroke();
  }
}
paintStone(stoneCtx);
const stoneSideTexture=new THREE.CanvasTexture(stoneCanvas);stoneSideTexture.wrapS=stoneSideTexture.wrapT=THREE.RepeatWrapping;
function noteTopTexture(len){
  const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");paintStone(x);
  // A slightly darker inset gives the note a carved/painted stone-plaque look.
  x.fillStyle="rgba(15,16,18,.20)";x.fillRect(9,9,238,238);
  x.strokeStyle="rgba(238,235,221,.88)";x.fillStyle="rgba(238,235,221,.95)";x.lineWidth=11;
  x.save();x.translate(108,154);x.rotate(-.34);x.beginPath();x.ellipse(0,0,39,25,0,0,Math.PI*2);
  if(len===4||len===2)x.stroke();else x.fill();x.restore();
  if(len!==4){
    x.lineWidth=11;x.lineCap="round";x.beginPath();x.moveTo(143,145);x.lineTo(143,43);x.stroke();
    const flags=len===.25?2:(len===.5?1:0);
    for(let i=0;i<flags;i++){
      const fy=48+i*28;x.lineWidth=9;x.beginPath();x.moveTo(143,fy);x.lineTo(205,fy);x.stroke();
    }
  }
  // Fine engraved border.
  x.strokeStyle="rgba(235,232,218,.35)";x.lineWidth=3;x.strokeRect(13,13,230,230);
  const tex=new THREE.CanvasTexture(c);tex.anisotropy=4;return tex;
}
const stoneSideMat=new THREE.MeshStandardMaterial({map:stoneSideTexture,color:0xb8b8b8,roughness:1,metalness:0});
const noteTopMaterials=new Map();
function makeNote(len){
  if(!noteTopMaterials.has(len))noteTopMaterials.set(len,new THREE.MeshStandardMaterial({map:noteTopTexture(len),color:0xffffff,roughness:1,metalness:0}));
  const topMat=noteTopMaterials.get(len);
  return new THREE.Mesh(new THREE.BoxGeometry(BLOCK_W,BLOCK_H,BLOCK_D),[
    stoneSideMat,stoneSideMat,topMat,stoneSideMat,stoneSideMat,stoneSideMat
  ]);
}
let floorNotes=[],tableNotes=[],held=null,locked=false,fx=[];
const tsum=()=>tableNotes.filter(n=>!n.fall).reduce((s,n)=>s+n.len,0);
const TOTAL_NOTE_COUNT=30,MAX_TABLE_NOTES=5;
const NOTE_TYPES=[4,2,1,.5,.25];
// Exponentiell gewichtet: jede kürzere Note ist doppelt so häufig wie die längere.
// Sechzehntel 16/31 ≈ 52 % · Achtel 26 % · Viertel 13 % · Halbe 6 % · Ganze 3 %
const NOTE_WEIGHTS=[[.25,16],[.5,8],[1,4],[2,2],[4,1]];
const NOTE_WEIGHT_SUM=NOTE_WEIGHTS.reduce((s,w)=>s+w[1],0);
function randomNoteValue(){
  let r=Math.random()*NOTE_WEIGHT_SUM;
  for(const [len,w] of NOTE_WEIGHTS){r-=w;if(r<0)return len;}
  return .25;
}
// Gibt es unter diesen Noten eine Auswahl aus höchstens 5 Steinen, die genau 4 Schläge ergibt?
function canMakeFour(lens){
  const cnt={1:0,2:0,4:0,8:0,16:0};lens.forEach(l=>cnt[Math.round(l*4)]++);
  const types=[16,8,4,2,1];
  const go=(ti,rem,slots)=>{
    if(rem===0)return true;if(ti>=types.length||slots===0)return false;
    const u=types[ti];
    for(let k=Math.min(cnt[u],slots,Math.floor(rem/u));k>=0;k--)if(go(ti+1,rem-k*u,slots-k))return true;
    return false;
  };
  return go(0,16,MAX_TABLE_NOTES);
}
function handMode(m,on){
  // Materialien sind zwischen allen Steinen geteilt -> für die Hand Kopien benutzen,
  // sonst würden ALLE Steine ohne Tiefentest gezeichnet.
  if(on){
    if(!m.userData.origMat){
      m.userData.origMat=m.material;
      m.material=m.material.map(x=>{const c=x.clone();c.depthTest=false;return c;});
    }
    m.renderOrder=10;
  }else{
    if(m.userData.origMat){m.material.forEach(x=>x.dispose&&x.dispose());m.material=m.userData.origMat;delete m.userData.origMat;}
    m.renderOrder=0;
  }
}
function chooseDropSpot(nearPlayer=false){
  // Lesetisch und Shop bleiben frei, damit Buch und Figuren nicht verdeckt werden.
  const isBookTableArea=(x,z)=>isTablesArea(x,z,.35)||PIL.some(p=>Math.hypot(x-p[0],z-p[1])<.7);
  for(let attempt=0;attempt<50;attempt++){
    let x,z;
    if(nearPlayer){
      // Tutorial: gut sichtbar vor dem Spieler
      const a=yaw+(Math.random()-.5)*1.1,d=1.6+Math.random()*1.6;
      x=THREE.MathUtils.clamp(P.x-Math.sin(a)*d,-5.5,5.5);z=THREE.MathUtils.clamp(P.z-Math.cos(a)*d,-2.7,5.8);
    }else if(floorNotes.length&&Math.random()<.38){
      // Häufig fallen neue Steine in die Nähe vorhandener Steine, damit natürliche Stapel entstehen.
      const base=floorNotes[Math.floor(Math.random()*floorNotes.length)];
      x=THREE.MathUtils.clamp(base.mesh.position.x+(Math.random()-.5)*.75,-5.55,5.55);
      z=THREE.MathUtils.clamp(base.mesh.position.z+(Math.random()-.5)*.75,-2.8,5.85);
    }else{
      x=(Math.random()*11)-5.5;z=(Math.random()*8.5)-2.7;
    }
    if(!isBookTableArea(x,z))return [x,z];
  }
  return [-3.0,2.0];
}
// Rotes X erscheint nur nach einer falschen Prüfung direkt über dem Prüfknopf.
// Die Vorderseite dreht sich jederzeit zum Spieler, damit das Zeichen sichtbar bleibt.
const wrongCheckMarkers=[];
function showWrongCheckX(){
  const group=new THREE.Group();
  const material=new THREE.MeshBasicMaterial({color:0xff3535,transparent:true,opacity:1,depthWrite:false,depthTest:false});
  const geometry=new THREE.BoxGeometry(.13,.82,.10);
  const a=new THREE.Mesh(geometry,material),b=new THREE.Mesh(geometry,material);
  a.rotation.z=Math.PI/4;b.rotation.z=-Math.PI/4;
  a.renderOrder=b.renderOrder=30;
  group.add(a,b);
  group.position.set(checkButton.position.x,checkButton.position.y+.82,checkButton.position.z);
  group.renderOrder=30;
  group.rotation.y=Math.atan2(P.x-group.position.x,P.z-group.position.z);
  scene.add(group);
  wrongCheckMarkers.push({group,material,geometry,t:0,duration:2.5});
}

// Aufprall: Holz auf Tischen, Stein auf dem Boden. Lauter bei schnellem Aufprall, leiser in der Ferne.
// Tischplatten sind flache, statische Boxen (halbe Höhe < 0.2).
function attachImpactSound(n,body){
  body.addEventListener("collide",ev=>{
    if(mode==="menu"||mode==="story")return;
    const now=performance.now();if(n.lastHit&&now-n.lastHit<140)return;
    let v=0;try{v=Math.abs(ev.contact.getImpactVelocityAlongNormal());}catch(e){}
    if(v<1.1)return;n.lastHit=now;
    const p=body.position,dist=Math.hypot(p.x-cam.position.x,p.y-cam.position.y,p.z-cam.position.z);
    const vol=Math.min(1,v/8)/(1+dist*.22);
    const sh=ev.body&&ev.body.shapes[0],wood=ev.body&&ev.body.mass===0&&sh&&sh.halfExtents&&sh.halfExtents.y<.2;
    SFX.play(wood?"table":"stone",vol,.9+Math.random()*.2);
  });
}
function spawn(len,x,z,ry=0,fall=true){
  const m=makeNote(len);
  const y=fall?11+Math.random()*12:BLOCK_H/2;
  // Zufällige Lage in allen Achsen; die Physik richtet den Block auf ebenem Boden
  // von selbst flach aus. Auf schrägen Stapeln kann er kippen oder abrutschen.
  const yaw=Math.random()*Math.PI*2;
  const tilt=Math.random()<.3?.65:.34;
  const rx=(Math.random()-.5)*tilt,rz=(Math.random()-.5)*tilt;
  m.position.set(x,y,z);m.rotation.set(rx,yaw,rz);
  const body=new CANNON.Body({mass:.72,material:stonePhysicsMaterial,linearDamping:.16,angularDamping:.52});
  body.addShape(new CANNON.Box(new CANNON.Vec3(BLOCK_W/2,BLOCK_H/2,BLOCK_D/2)));
  body.position.set(x,y,z);body.quaternion.setFromEuler(rx,yaw,rz);
  body.velocity.set((Math.random()-.5)*.65,0,(Math.random()-.5)*.65);
  body.angularVelocity.set((Math.random()-.5)*1.9,(Math.random()-.5)*1.6,(Math.random()-.5)*1.9);
  body.allowSleep=true;body.sleepSpeedLimit=.13;body.sleepTimeLimit=.85;
  physicsWorld.addBody(body);
  scene.add(m);
  const n={len,mesh:m,body,t:new THREE.Vector3(x,y,z),fall:true};
  attachImpactSound(n,body);
  m.userData={kind:"note",ref:n};
  return n;
}
function activeNoteCount(){return floorNotes.length+tableNotes.length+(held?1:0);}
function allNoteLens(){return floorNotes.concat(tableNotes).map(n=>n.len).concat(held?[held.len]:[]);}
function removeNote(n,animated=true){
  floorNotes=floorNotes.filter(x=>x!==n);tableNotes=tableNotes.filter(x=>x!==n);
  if(n.body){physicsWorld.removeBody(n.body);n.body=null;}
  if(!animated){scene.remove(n.mesh);return;}
  // Kleines "Puff": Stein schrumpft und steigt leicht auf.
  fx.push({t:0,update(dt){this.t+=dt;const k=Math.max(0,1-this.t/.45);n.mesh.scale.setScalar(k);n.mesh.position.y+=dt*.8;if(k<=0){scene.remove(n.mesh);return false;}return true;}});
}
// Füllt den Raum wieder auf genau 30 Steine auf. Neue Steine fallen vom Himmel.
// required: Notenwerte, die (fürs Tutorial) sicher auf dem Boden liegen sollen.
function refillNotes(required=[]){
  const have=floorNotes.map(n=>n.len).concat(held?[held.len]:[]);
  const need=[];
  for(const len of required){const i=have.indexOf(len);if(i>=0)have.splice(i,1);else need.push(len);}
  // Notfalls weit entfernte, nicht benötigte Steine entfernen, damit es 30 bleiben.
  let overflow=activeNoteCount()+need.length-TOTAL_NOTE_COUNT;
  if(overflow>0){
    const keep=required.slice();
    const removable=floorNotes.filter(n=>{const i=keep.indexOf(n.len);if(i>=0){keep.splice(i,1);return false;}return true;})
      .sort((a,b)=>b.mesh.position.distanceToSquared(cam.position)-a.mesh.position.distanceToSquared(cam.position));
    for(const n of removable){if(overflow<=0)break;removeNote(n);overflow--;}
  }
  for(const len of need){const [x,z]=chooseDropSpot(true);floorNotes.push(spawn(len,x,z,0,true));}
  const count=TOTAL_NOTE_COUNT-activeNoteCount();
  if(count>0){
    const existing=allNoteLens();let list;
    for(let tries=0;tries<40;tries++){list=Array.from({length:count},randomNoteValue);if(canMakeFour(existing.concat(list)))break;}
    if(!canMakeFour(existing.concat(list))){list[0]=2;if(count>1)list[1]=1;if(count>2)list[2]=1;}
    for(const len of list){const [x,z]=chooseDropSpot();floorNotes.push(spawn(len,x,z,0,true));}
  }
  updateFloorCount();
}
function noteHalfExtents(n){
  const m=n.mesh;m.updateMatrix();const e=m.matrix.elements;
  const hx=BLOCK_W/2,hy=BLOCK_H/2,hz=BLOCK_D/2;
  return {x:Math.abs(e[0])*hx+Math.abs(e[4])*hy+Math.abs(e[8])*hz,
          y:Math.abs(e[1])*hx+Math.abs(e[5])*hy+Math.abs(e[9])*hz,
          z:Math.abs(e[2])*hx+Math.abs(e[6])*hy+Math.abs(e[10])*hz};
}
function syncPhysicsNotes(){
  for(const n of floorNotes.concat(tableNotes)){
    if(!n.body)continue;
    const b=n.body;
    n.mesh.position.set(b.position.x,b.position.y,b.position.z);
    n.mesh.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
    const calm=b.sleepState===CANNON.Body.SLEEPING||(b.velocity.lengthSquared()<.02&&b.angularVelocity.lengthSquared()<.08);
    n.fall=!calm;
  }
  // Gelandete Steine werden danach sortiert, wo sie wirklich liegen (Tisch oder Boden).
  for(const n of floorNotes.slice()){
    if(n.fall||!n.body)continue;
    if(onTable(n)){floorNotes=floorNotes.filter(x=>x!==n);tableNotes.push(n);}
  }
  for(const n of tableNotes.slice()){
    if(n.fall||!n.body)continue;
    if(!onTable(n)){tableNotes=tableNotes.filter(x=>x!==n);floorNotes.push(n);}
  }
}
function onTable(n){
  const p=n.body.position;
  return p.y>TY+.02&&Math.abs(p.x)<4.05&&Math.abs(p.z-TZ)<1.25;
}
function layoutTable(){tableNotes.forEach((n,i)=>{n.t.set(X0+i*U+U/2,TY+H/2+.01,TABLE_NOTE_Z)});}
function msg(t,k){$("msg").textContent=t;$("msg").className="hud "+(k||"")}
let feedbackTimer=null;
function showFeedback(text,kind="bad"){
  const el=$("feedback");if(!el)return;
  el.textContent=text;el.className="feedback "+kind;el.style.display="block";
  if(feedbackTimer)clearTimeout(feedbackTimer);
  feedbackTimer=setTimeout(()=>{el.style.display="none";el.className="feedback";},3200);
}
function updateFloorCount(){$("floorCount").textContent=`Steine aktiv: ${activeNoteCount()}/${TOTAL_NOTE_COUNT}`;}
function showHold(){
  const h=$("hold");
  if(h)h.textContent=held?`In der Hand: ${VAL[held.len].n} (${fmt(held.len)} ${held.len===1?"Schlag":"Schläge"})`:"";
  const a=$("actionTouch");
  if(a){a.textContent=held?tr("throw"):tr("take");a.classList.toggle("holding",!!held);}
}

// Kompletter Neustart (Spielstart): alle Steine weg, 30 neue fallen vom Himmel.
function newRound(required=[]){
  roundToken++;
  floorNotes.forEach(n=>{if(n.body)physicsWorld.removeBody(n.body);scene.remove(n.mesh);});
  tableNotes.forEach(n=>{if(n.body)physicsWorld.removeBody(n.body);scene.remove(n.mesh);});
  if(held){cam.remove(held.mesh);held=null}
  floorNotes=[];tableNotes=[];locked=false;
  refillNotes(required);
  layoutTable();showHold();
}
// Nach einer richtigen Lösung: nur die Steine auf dem Tisch verschwinden,
// alle anderen bleiben liegen. Danach fallen neue Steine bis wieder 30 da sind.
function clearTableAndRefill(required=[]){
  tableNotes.slice().forEach(n=>removeNote(n));
  locked=false;
  refillNotes(required);showHold();
}

// ---------- Audio ----------
let ac;
// Weicher Marimba-Ton: jede Notenart hat ihre eigene Tonhöhe (Ganze tief … Sechzehntel hoch).
const NOTE_FREQ={4:261.63,2:329.63,1:392,.5:523.25,.25:659.25};
function tone(len,when,vol=.16){
  try{
    ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume();
    const f=NOTE_FREQ[len]||392,t0=ac.currentTime+when,d=.45+Math.min(1.1,len*.3);
    for(const [mul,amp,len2] of [[1,1,1],[4,.22,.3],[9.8,.05,.12]]){
      const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=f*mul;
      g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(Math.max(.0002,vol*amp*VOL_LEVELS[settings.sfx]),t0+.006);g.gain.exponentialRampToValueAtTime(.0001,t0+d*len2);
      o.connect(g).connect(ac.destination);o.start(t0);o.stop(t0+d*len2+.05);
    }
  }catch(e){}
}
function ding(){SFX.play("correct",.9);}
function wrongSound(){SFX.play("wrong",.75);}

// ---------- Interaktion ----------
function pickUp(n){
  const wasOnFloor=floorNotes.includes(n);
  const wasOnTable=tableNotes.includes(n);
  if(wasOnFloor)floorNotes=floorNotes.filter(x=>x!==n);
  if(wasOnTable)tableNotes=tableNotes.filter(x=>x!==n);
  if(n.body)physicsWorld.removeBody(n.body);
  scene.remove(n.mesh);n.target=null;held=n;cam.add(n.mesh);
  n.mesh.position.set(.55,-.45,-1.1);n.mesh.rotation.set(1.1,-.3,0);n.mesh.scale.set(.6,.6,.6);handMode(n.mesh,true);
  showHold();SFX.play("pick",.8);tone(n.len,.02,.07);
}
const _tmpRay=new THREE.Raycaster();
function freeTableSlot(nearX){
  const occupied=tableNotes.filter(n=>!n.fall&&n.body).map(n=>n.body.position.x);
  const flying=tableNotes.filter(n=>n.fall&&n.target).map(n=>n.target.x);
  const taken=occupied.concat(flying);
  const slots=[-2.75,-1.5,-.25,1.0,2.25].filter(x=>taken.every(t=>Math.abs(t-x)>1.2));
  if(!slots.length)return -2.75+Math.min(4,tableNotes.length)*1.25;
  if(nearX==null)return slots[0];
  return slots.reduce((a,b)=>Math.abs(b-nearX)<Math.abs(a-nearX)?b:a);
}
function throwHeld(targetKind,point){
  if(!held)return false;
  // Während der kurzen Pause nach einer richtigen Lösung wird der Tisch gleich geleert – jetzt nicht werfen.
  if(locked)return false;
  const n=held,m=n.mesh;
  cam.updateMatrixWorld(true);
  const start=new THREE.Vector3();m.getWorldPosition(start);
  const worldQuat=new THREE.Quaternion();m.getWorldQuaternion(worldQuat);
  const viewDir=new THREE.Vector3();cam.getWorldDirection(viewDir);

  // Ohne Zielpunkt (E / Rechtsklick / Werfen-Knopf): dorthin werfen, wohin das Fadenkreuz zeigt.
  if(!point){
    _tmpRay.setFromCamera(new THREE.Vector2(0,0),cam);
    const hit=_tmpRay.intersectObjects([floor,tabletop],false)[0];
    if(hit){point=hit.point.clone();if(hit.object===tabletop)targetKind="table";}
  }
  if(targetKind==="table"&&tableNotes.length>=MAX_TABLE_NOTES){
    showToast(tr("tableFull"));wrongSound();
    return false;
  }

  // Zielpunkt bestimmen
  const target=new THREE.Vector3();
  if(targetKind==="table"){
    target.set(freeTableSlot(point?point.x:null),TY+H/2+.04,TABLE_NOTE_Z);
  }else if(point&&Number.isFinite(point.x)&&Number.isFinite(point.z)){
    target.set(point.x,Math.max(H/2+.04,point.y+H/2+.04),point.z);
  }else{
    target.copy(start).addScaledVector(viewDir,7);
  }
  target.x=THREE.MathUtils.clamp(target.x,-6.2,6.2);
  target.z=THREE.MathUtils.clamp(target.z,-6.2,6.2);
  target.y=Math.max(H/2+.04,target.y);

  // Ballistische Flugbahn: Geschwindigkeit so berechnen, dass der Stein wirklich am Ziel ankommt.
  const g=Math.abs(physicsWorld.gravity.y);
  const dxz=Math.hypot(target.x-start.x,target.z-start.z);
  const T=THREE.MathUtils.clamp(.55+dxz*.075,.6,1.35);
  const vx=(target.x-start.x)/T,vz=(target.z-start.z)/T;
  const vy=(target.y-start.y+.5*g*T*T)/T;

  cam.remove(m);scene.add(m);
  handMode(m,false);
  m.scale.set(1,1,1);m.position.copy(start);
  const q=worldQuat.clone();
  if(targetKind==="table"){q.setFromEuler(new THREE.Euler(0,0,0));} // flach und ausgerichtet landen
  m.quaternion.copy(q);

  const body=new CANNON.Body({mass:.72,material:stonePhysicsMaterial,linearDamping:.01,angularDamping:.35});
  body.addShape(new CANNON.Box(new CANNON.Vec3(BLOCK_W/2,BLOCK_H/2,BLOCK_D/2)));
  body.position.set(start.x,start.y,start.z);
  body.quaternion.set(q.x,q.y,q.z,q.w);
  body.velocity.set(vx,vy,vz);
  if(targetKind==="table")body.angularVelocity.set(0,0,0);
  else body.angularVelocity.set((Math.random()-.5)*4,(Math.random()-.5)*3,(Math.random()-.5)*4);
  body.allowSleep=true;body.sleepSpeedLimit=.12;body.sleepTimeLimit=.7;
  // Beim ersten Aufprall wird die Waagerecht-Geschwindigkeit stark gebremst: kein Wegrutschen.
  // Wichtig: Listener NICHT während des Ereignisses entfernen (Cannon.js stürzt sonst ab) – nur ein Merker.
  let firstHitDone=false;
  const onHit=ev=>{
    if(firstHitDone)return;
    if(ev&&ev.body&&tableWallBodies.includes(ev.body))return; // Abprallen von der Wand nicht bremsen
    firstHitDone=true;
    body.velocity.x*=.3;body.velocity.z*=.3;body.linearDamping=.16;
    if(targetKind==="table")body.angularVelocity.scale(.2,body.angularVelocity);
  };
  body.addEventListener("collide",onHit);
  attachImpactSound(n,body);
  n.body=body;n.fall=true;n.target=targetKind==="table"?target.clone():null;
  held=null;
  physicsWorld.addBody(body);
  body.aabbNeedsUpdate=true;body.wakeUp();
  if(targetKind==="table")tableNotes.push(n);else floorNotes.push(n);
  showHold();
  SFX.play("throw",.55,1.1);
  msg("");
  return true;
}

function check(){
  if(locked)return;
  if(tableNotes.some(n=>n.fall))return; // erst prüfen, wenn alles ruhig liegt
  const s=tsum();
  if(!tableNotes.length||Math.abs(s-4)>=EPS){
    // Falsch: nur Ton und rotes X über dem Knopf – kein Text oben in der Mitte.
    wrongSound();showWrongCheckX();
    return;
  }
  locked=true;ding();
  let p=0;tableNotes.forEach(n=>{tone(n.len,.4+p*.5);p+=n.len});
  // Belohnung: so viele Coins wie Noten auf dem Tisch – nur im echten Spiel, nicht im Tutorial.
  // Angezeigt NUR über dem PRÜFEN-Knopf (Münze bzw. grüner Haken im Tutorial).
  const gain=mode==="game"?tableNotes.length:0;
  if(gain){save.coins+=gain;persist();updateCoinHud();setTimeout(()=>SFX.play("coin",.8),350);}
  showCoinAtButton(gain);
  const token=roundToken;
  setTimeout(()=>{
    if(token!==roundToken)return;
    if(mode==="tutorial")finishTutorialTask();
    else clearTableAndRefill();
  },2600);
}
// Goldene Münze mit "+N" steigt drehend über dem PRÜFEN-Knopf auf.
function coinFaceTexture(text,green=false){
  const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  const g=x.createRadialGradient(50,44,8,64,64,64);
  if(green){g.addColorStop(0,"#d8ffe0");g.addColorStop(.6,"#4fd06a");g.addColorStop(1,"#1f7a34");}
  else{g.addColorStop(0,"#fff3b0");g.addColorStop(.6,"#ffd43b");g.addColorStop(1,"#b8860b");}
  x.fillStyle=g;x.beginPath();x.arc(64,64,62,0,6.3);x.fill();
  x.lineWidth=6;x.strokeStyle=green?"#1f6a2e":"#a8740a";x.beginPath();x.arc(64,64,50,0,6.3);x.stroke();
  x.fillStyle=green?"#0f4a1c":"#8a5a00";x.font="bold 54px system-ui,sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText(text,64,68);
  return new THREE.CanvasTexture(c);
}
function showCoinAtButton(gain){
  const group=new THREE.Group();
  group.position.set(checkButton.position.x,checkButton.position.y+.3,checkButton.position.z);
  const ok=gain<=0; // Tutorial: grüner Haken statt Münze
  const face=new THREE.MeshStandardMaterial({map:coinFaceTexture(ok?"✔":"+"+gain,ok),metalness:.4,roughness:.35,emissive:ok?0x0a3a14:0x664d00});
  const rim=new THREE.MeshStandardMaterial({color:ok?0x3aa852:0xd9a93a,metalness:.5,roughness:.3,emissive:ok?0x0a3a14:0x443300});
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.06,32),[rim,face,face]);
  coin.rotation.x=Math.PI/2;group.add(coin);
  const glow=glowSprite(ok?0x69db7c:0xffd43b,1.6);group.add(glow);
  scene.add(group);
  fx.push({t:0,update(dt){
    this.t+=dt;const t=this.t;
    group.position.y=checkButton.position.y+.3+Math.min(1,t*1.4)*.9+Math.max(0,t-1.4)*.6;
    group.rotation.y=Math.atan2(P.x-group.position.x,P.z-group.position.z)+Math.sin(t*9)*Math.max(0,1-t)*1.2;
    const s=t<.25?t/.25:1;group.scale.setScalar(s);
    const fade=t>1.9?Math.max(0,1-(t-1.9)/.5):1;
    face.opacity=rim.opacity=fade;face.transparent=rim.transparent=fade<1;glow.material.opacity=fade*.8;
    if(t>2.4){scene.remove(group);coin.geometry.dispose();face.map.dispose();face.dispose();rim.dispose();return false;}
    return true;
  }});
}
const rc=new THREE.Raycaster();
const bookBackButton=$("bookBack");
if(bookBackButton)bookBackButton.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();closeBook();});
function interact(cx,cy){
  if(mode==="menu"||mode==="story"||tutDoneShown)return;
  if(bookMode){
    if(bookFlipAnim)return;
    const r=renderer.domElement.getBoundingClientRect();
    rc.setFromCamera(new THREE.Vector2((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height)*2+1),cam);
    const hit=rc.intersectObjects([bookLeftPage,bookRightPage],false)[0];
    if(hit){turnBook(hit.object.userData.side);return;}
    return;
  }
  if(locked)return;
  const r=renderer.domElement.getBoundingClientRect();
  // Bei Pointer Lock immer die Bildschirmmitte als Ziel verwenden. Manche
  // Browser liefern für clientX/clientY im Pointer-Lock-Modus nur 0/0.
  const lockedMouse=document.pointerLockElement===renderer.domElement;
  const px=lockedMouse?r.left+r.width/2:cx;
  const py=lockedMouse?r.top+r.height/2:cy;
  rc.setFromCamera(new THREE.Vector2((px-r.left)/r.width*2-1,-((py-r.top)/r.height)*2+1),cam);
  const objs=[floor,tabletop,checkButton,bookLeftPage,bookRightPage,...shopItems,...floorNotes.filter(n=>!n.fall).map(n=>n.mesh),...tableNotes.filter(n=>!n.fall).map(n=>n.mesh)];
  const h=rc.intersectObjects(objs,true)[0];
  let obj=h?.object;
  while(obj&&!obj.userData.kind&&obj.parent)obj=obj.parent;
  const k=obj?.userData.kind;

  // Werfen hat Vorrang vor der Distanzprüfung: selbst ein weiter entfernter
  // Boden-Treffer oder ein Klick ins Leere löst zuverlässig einen Wurf aus.
  if(held){
    if(k==="check")return throwHeld("table",h.point);
    const intoTable=k==="table"||(k==="note"&&tableNotes.includes(obj.userData.ref));
    return throwHeld(intoTable?"table":"floor",h?.point||null);
  }
  if(!h)return;
  // Der Tisch steht am anderen Ende des Raumes; normale Spielreichweite.
  if(h.distance>24)return msg("Zu weit weg – lauf näher heran.");
  if(k==="check")return check();
  if(k==="shop")return useShopItem(obj.userData.idx);
  if(k==="book")return openBook();
  if(k==="note"){
    if(obj.userData.ref.fall)return msg("Warte kurz, bis der Steinblock gelandet ist.");
    return pickUp(obj.userData.ref);
  }
}

// Hintergrundmusik ohne Anzeige. Fünf feste Slots: songs/1.mp3 bis songs/5.mp3.
// Fehlt eine Datei, wird sie übersprungen und ein anderer vorhandener Titel versucht.
const music=$("music"),folderInput=$("musicFolderInput"),filesInput=$("musicFilesInput");
// Eigene Musik pro Raum (Index wie in THEMES). Alle anderen Räume spielen die normalen Lieder.
const DEFAULT_MUSIC=["songs/1.mp3","songs/2.mp3"];
const THEME_MUSIC={4:["songs/disco_1.mp3","songs/disco_2.mp3"],5:["songs/unterwasser_1.mp3"]};
const tracksFor=list=>list.map(src=>({name:src.split("/").pop(),src,key:src,blob:false}));
let musicTracks=tracksFor(DEFAULT_MUSIC),musicPlaylist="default";
let activeTrack=-1,musicStarted=false,userPaused=false,gapTimer=null,trackAttempt=0,afkOn=false;
const failedMusicTracks=new Set();
function chooseRandomTrack(){
  let options=musicTracks.map((_,i)=>i).filter(i=>!failedMusicTracks.has(i)&&i!==activeTrack);
  if(!options.length)options=musicTracks.map((_,i)=>i).filter(i=>!failedMusicTracks.has(i));
  return options.length?options[Math.floor(Math.random()*options.length)]:-1;
}
function setThemeMusic(themeIndex){
  if(musicTracks.some(t=>t.blob))return; // selbst gewählte Musik (M/N) hat Vorrang
  const key=THEME_MUSIC[themeIndex]?"theme"+themeIndex:"default";
  if(key===musicPlaylist)return;
  const wasPlaying=musicStarted||!!gapTimer;
  musicPlaylist=key;musicTracks=tracksFor(THEME_MUSIC[themeIndex]||DEFAULT_MUSIC);
  failedMusicTracks.clear();activeTrack=-1;trackAttempt++;musicStarted=false;
  if(gapTimer){clearTimeout(gapTimer);gapTimer=null;}
  music.pause();music.removeAttribute("src");music.load();
  if(wasPlaying)startRandomTrack();
}
function startRandomTrack(){
  if(userPaused||afkOn)return;
  if(gapTimer){clearTimeout(gapTimer);gapTimer=null;}
  const index=chooseRandomTrack();
  if(index<0){musicStarted=false;return;}
  activeTrack=index;musicStarted=false;
  const attempt=++trackAttempt;
  music.pause();music.src=musicTracks[index].src;music.load();
  const promise=music.play();
  if(promise&&promise.then){
    promise.then(()=>{if(attempt===trackAttempt)musicStarted=true;})
      .catch(err=>{
        if(attempt!==trackAttempt)return;
        // Autoplay restrictions are not evidence of a missing file. Retry on first interaction.
        if(err&&err.name==="NotAllowedError")return;
        markTrackMissing(index,attempt);
      });
  }
}
function markTrackMissing(index,attempt=trackAttempt){
  if(attempt!==trackAttempt||failedMusicTracks.has(index))return;
  failedMusicTracks.add(index);musicStarted=false;
  if(!userPaused&&chooseRandomTrack()!==-1)setTimeout(startRandomTrack,80);
}
function scheduleNextTrack(){
  musicStarted=false;if(userPaused)return;
  if(gapTimer)clearTimeout(gapTimer);
  // Normale Lieder: 10–15 Sekunden Stille. Raum-Musik läuft fast ohne Pause weiter.
  const pauseMs=musicPlaylist==="default"?10000+Math.floor(Math.random()*5001):1200;
  gapTimer=setTimeout(()=>{gapTimer=null;if(!userPaused)startRandomTrack();},pauseMs);
}
function replaceMusicFiles(fileList){
  const files=Array.from(fileList||[]).filter(f=>/\.mp3$/i.test(f.name)||f.type==="audio/mpeg");
  if(!files.length)return;
  // Prefer explicit names 1.mp3 … 5.mp3. Otherwise fill slots alphabetically.
  const slots=Array(5).fill(null),unnumbered=[];
  for(const file of files){
    const match=file.name.match(/^([1-5])\.mp3$/i);
    if(match)slots[Number(match[1])-1]=file;else unnumbered.push(file);
  }
  unnumbered.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  for(const file of unnumbered){const index=slots.findIndex(v=>v===null);if(index<0)break;slots[index]=file;}
  // Revoke previously chosen local files, then rebuild exactly five slots.
  for(const track of musicTracks){if(track.blob)URL.revokeObjectURL(track.src);}
  musicTracks=slots.map((file,i)=>file?({name:file.name,src:URL.createObjectURL(file),key:`local-${i}-${file.name}-${file.size}`,blob:true}):({name:`${i+1}.mp3`,src:`songs/${i+1}.mp3`,key:`slot-${i+1}`,blob:false}));
  failedMusicTracks.clear();activeTrack=-1;trackAttempt++;music.pause();music.removeAttribute("src");music.load();musicStarted=false;
  if(gapTimer){clearTimeout(gapTimer);gapTimer=null;}
  if(!userPaused)startRandomTrack();
}
async function chooseMusicFolder(){
  if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
  if(window.showDirectoryPicker){
    try{
      const dir=await window.showDirectoryPicker({mode:"read"}),files=[];
      async function collectMp3(folder){
        for await(const [name,handle] of folder.entries()){
          if(handle.kind==="file"&&/\.mp3$/i.test(name))files.push(await handle.getFile());
          else if(handle.kind==="directory")await collectMp3(handle);
        }
      }
      await collectMp3(dir);replaceMusicFiles(files);return;
    }catch(err){if(err&&err.name==="AbortError")return;}
  }
  folderInput.click();
}
function applyAudioSettings(){
  for(const k of ["music","sfx"])if(![0,1,2].includes(settings[k]))settings[k]=2;
  SFX.volume=.85*VOL_LEVELS[settings.sfx];
  music.volume=.32*VOL_LEVELS[settings.music];
  if(settings.music===0){userPaused=true;music.pause();if(gapTimer){clearTimeout(gapTimer);gapTimer=null;}}
  else if(userPaused){userPaused=false;if(music.src&&!music.ended)music.play().then(()=>musicStarted=true).catch(()=>{});else startRandomTrack();}
}
applyAudioSettings();
music.addEventListener("ended",scheduleNextTrack);
music.addEventListener("error",()=>{if(activeTrack>=0)markTrackMissing(activeTrack,trackAttempt);});
folderInput.addEventListener("change",()=>{replaceMusicFiles(folderInput.files);folderInput.value="";});
filesInput.addEventListener("change",()=>{replaceMusicFiles(filesInput.files);filesInput.value="";});
function tryAutoplay(){
  if(userPaused||musicStarted||gapTimer)return;
  if(!music.src)startRandomTrack();
  else music.play().then(()=>musicStarted=true).catch(()=>{});
}
document.addEventListener("pointerdown",tryAutoplay,{capture:true});
document.addEventListener("keydown",e=>{
  if(e.code==="KeyM"&&!bookMode){e.preventDefault();chooseMusicFolder();}
  if(e.code==="KeyN"&&!bookMode){e.preventDefault();if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();filesInput.click();}
  if(e.code==="Escape"&&bookMode){e.preventDefault();closeBook();}
},{capture:true});
tryAutoplay();

// Bildschirmschoner: nach 10 Minuten ohne Eingabe laufen die Videos in zufälliger Reihenfolge,
// eins nach dem anderen. Jeder Klick, jede Taste oder Berührung beendet sie sofort.
// Zum Testen: index.html?afk=5 startet die Videos schon nach 5 Sekunden.
const AFK_MS=(Number(new URLSearchParams(location.search).get("afk"))||600)*1000;
const AFK_VIDEOS=["videos/1.mp4","videos/2.mp4","videos/3.mp4","videos/4.mp4","videos/5.mp4","videos/6.mp4"];
const afkEl=$("afk"),afkVideo=$("afkVideo");
let lastInput=performance.now(),afkQueue=[],afkLast="",afkMusicWasOn=false,afkFails=0;
function nextAfkVideo(){
  if(!afkQueue.length){
    afkQueue=AFK_VIDEOS.slice();
    for(let i=afkQueue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[afkQueue[i],afkQueue[j]]=[afkQueue[j],afkQueue[i]];}
    if(afkQueue.length>1&&afkQueue[0]===afkLast)afkQueue.push(afkQueue.shift()); // nicht dasselbe Video zweimal
  }
  afkLast=afkQueue.shift();
  afkVideo.src=afkLast;afkVideo.muted=false;
  afkVideo.play().catch(()=>{afkVideo.muted=true;afkVideo.play().catch(()=>{});});
}
function startAfk(){
  if(afkOn)return;
  afkOn=true;afkFails=0;afkMusicWasOn=!music.paused;music.pause();
  if(document.pointerLockElement)document.exitPointerLock();
  for(const k in key)key[k]=0;
  afkEl.classList.add("on");nextAfkVideo();
}
function stopAfk(){
  afkOn=false;afkEl.classList.remove("on");
  afkVideo.pause();afkVideo.removeAttribute("src");afkVideo.load();
  if(afkMusicWasOn&&!userPaused)music.play().catch(()=>{});
  else if(!gapTimer&&!musicStarted)startRandomTrack();
  lastInput=performance.now();
}
afkVideo.addEventListener("ended",()=>{if(afkOn)nextAfkVideo();});
afkVideo.addEventListener("playing",()=>{afkFails=0;});
afkVideo.addEventListener("error",()=>{if(!afkOn)return;if(++afkFails<=AFK_VIDEOS.length)nextAfkVideo();else stopAfk();});
function afkInput(e){
  lastInput=performance.now();
  if(afkOn&&e.type!=="pointermove"){e.preventDefault();e.stopPropagation();stopAfk();}
}
for(const ev of ["pointerdown","keydown","touchstart","wheel","pointermove"])
  window.addEventListener(ev,afkInput,{capture:true,passive:false});
setInterval(()=>{if(settings.afk&&!afkOn&&mode!=="story"&&performance.now()-lastInput>=AFK_MS)startAfk();},1000);

// Steuerung: Maus/Tastatur und vollständige Touch-/Stiftbedienung.
let yaw=Math.PI,pitch=-.58,down=null,moved=0,gestureDX=0,gestureDY=0;
const key={f:0,b:0,l:0,r:0,sl:0,sr:0,j:0};
let touchAxisX=0,touchAxisY=0;
const isDesktop=!!(window.matchMedia&&window.matchMedia("(pointer:fine)").matches);
const map={KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",ArrowLeft:"l",ArrowRight:"r",KeyA:"sl",KeyD:"sr",Space:"j"};
addEventListener("keydown",e=>{
  if(e.code==="KeyE"&&!bookMode&&held){e.preventDefault();throwHeld("floor",null);return;}
  if(map[e.code]&&!bookMode){key[map[e.code]]=1;e.preventDefault();}
});
addEventListener("keyup",e=>{if(map[e.code])key[map[e.code]]=0});

// Minecraft-Bedrock-artiger Analog-Joystick für Touchgeräte:
// feste Position, große Touchfläche, Totzone, Finger darf aus dem Ring wandern,
// ganz nach vorne schieben = Sprinten (Knopf leuchtet gold).
const joystickZone=$("joystickZone"),joystickBase=$("joystickBase"),joystickKnob=$("joystickKnob"),jumpTouch=$("jumpTouch"),actionTouch=$("actionTouch");
let joystickPointer=null,touchSprint=false;
const JOY_DEAD=.14;
function updateJoystick(e){
  if(!joystickBase||!joystickKnob)return;
  const r=joystickBase.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const max=(r.width-joystickKnob.offsetWidth)/2+4;
  let dx=e.clientX-cx,dy=e.clientY-cy;const d=Math.hypot(dx,dy);
  const m=Math.min(1,d/max);
  const nx=d>0?dx/d:0,ny=d>0?dy/d:0;
  const eff=m<JOY_DEAD?0:(m-JOY_DEAD)/(1-JOY_DEAD);
  touchAxisX=nx*eff;touchAxisY=ny*eff;
  touchSprint=m>.93&&ny<-.5;
  joystickBase.classList.toggle("sprint",touchSprint);
  const kd=Math.min(d,max);
  joystickKnob.style.transform=`translate(${nx*kd}px,${ny*kd}px)`;
}
function resetJoystick(){
  joystickPointer=null;touchAxisX=touchAxisY=0;touchSprint=false;
  if(joystickBase)joystickBase.classList.remove("sprint");
  if(joystickKnob)joystickKnob.style.transform="translate(0,0)";
}
if(joystickZone){
  joystickZone.addEventListener("pointerdown",e=>{
    if(joystickPointer!==null)return;
    e.preventDefault();e.stopPropagation();
    joystickPointer=e.pointerId;joystickZone.setPointerCapture?.(e.pointerId);updateJoystick(e);
  });
  joystickZone.addEventListener("pointermove",e=>{if(e.pointerId===joystickPointer){e.preventDefault();e.stopPropagation();updateJoystick(e);}});
  ["pointerup","pointercancel"].forEach(ev=>joystickZone.addEventListener(ev,e=>{if(e.pointerId===joystickPointer){e.stopPropagation();resetJoystick();}}));
  joystickZone.addEventListener("lostpointercapture",e=>{if(e.pointerId===joystickPointer)resetJoystick();});
}
if(jumpTouch){
  jumpTouch.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();key.j=1;jumpTouch.setPointerCapture?.(e.pointerId);});
  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>jumpTouch.addEventListener(ev,e=>{e.stopPropagation();key.j=0;}));
  jumpTouch.addEventListener("contextmenu",e=>e.preventDefault());
}
// Aktionsknopf: nimmt den Stein im Fadenkreuz auf bzw. wirft den gehaltenen Stein dorthin.
if(actionTouch){
  actionTouch.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();
    if(bookMode||cameraAnim)return;
    if(held)throwHeld("floor",null);
    else interact(stage.clientWidth/2,stage.clientHeight/2);
  });
  actionTouch.addEventListener("contextmenu",e=>e.preventDefault());
}
stage.addEventListener("contextmenu",e=>e.preventDefault());
stage.addEventListener("pointerdown",e=>{
  if(e.target.closest&&e.target.closest("#touchControls,#bookBack,#menuBtn,#menuScreen,#tutorial,#story,#tutDone"))return;
  if(mode==="menu"||mode==="story"||tutDoneShown)return;
  const touchLike=e.pointerType==="touch"||e.pointerType==="pen"||!isDesktop;
  if(!touchLike&&e.button===2){
    e.preventDefault();
    if(held&&!bookMode)throwHeld("floor",null);
    return;
  }
  if(bookMode){
    if(!touchLike){if(e.button===0)interact(e.clientX,e.clientY);return;}
    down={x:e.clientX,y:e.clientY,id:e.pointerId,book:true};moved=0;gestureDX=gestureDY=0;
    stage.setPointerCapture?.(e.pointerId);e.preventDefault();return;
  }
  if(!touchLike){
    if(e.button!==0)return;
    if(document.pointerLockElement!==renderer.domElement){
      // Verhalten wie in der stabilen PC-Version vor der Touch-Umstellung:
      // Mausklick führt die Aktion sofort aus und fordert parallel Pointer Lock an.
      if(!bookMode&&renderer.domElement.requestPointerLock&&!pointerLockFailed){
        try{
          const lockResult=renderer.domElement.requestPointerLock();
          if(lockResult&&typeof lockResult.catch==="function")lockResult.catch(()=>{pointerLockFailed=true;});
        }catch(err){pointerLockFailed=true;}
      }
      interact(e.clientX,e.clientY);
    }else{
      interact(stage.clientWidth/2,stage.clientHeight/2);
    }
    return;
  }else{
    down={x:e.clientX,y:e.clientY,id:e.pointerId,book:false};moved=0;gestureDX=gestureDY=0;
    stage.setPointerCapture?.(e.pointerId);e.preventDefault();
  }
});
// Pointer Lock liefert auf dem PC mousemove mit movementX/Y, nicht pointermove.
document.addEventListener("mousemove",e=>{
  if(document.pointerLockElement!==renderer.domElement||bookMode||cameraAnim||mode==="menu"||mode==="story")return;
  yaw-=(e.movementX||0)*.0026;
  pitch=Math.max(-1.25,Math.min(1.15,pitch-(e.movementY||0)*.0026));
});
let pointerLockFailed=false;
document.addEventListener("pointerlockerror",()=>{pointerLockFailed=true;});
stage.addEventListener("pointermove",e=>{
  if(!down||down.id!==e.pointerId)return;
  const dx=e.clientX-down.x,dy=e.clientY-down.y;
  gestureDX+=dx;gestureDY+=dy;moved+=Math.abs(dx)+Math.abs(dy);
  if(!down.book){yaw-=dx*.006;pitch=Math.max(-1.25,Math.min(1.15,pitch-dy*.006));}
  down.x=e.clientX;down.y=e.clientY;
  if(e.pointerType!=="mouse")e.preventDefault();
});
stage.addEventListener("pointerup",e=>{
  if(!down||down.id!==e.pointerId)return;
  const was=down;down=null;
  if(was.book){
    if(moved>24&&Math.abs(gestureDX)>Math.abs(gestureDY)*1.15){
      turnBook(gestureDX<0?"right":"left");
    }else if(moved<12){interact(e.clientX,e.clientY);}
    e.preventDefault();return;
  }
  if(moved<9)interact(e.clientX,e.clientY);
});
stage.addEventListener("pointercancel",e=>{if(down&&down.id===e.pointerId)down=null;});
document.addEventListener("pointerlockchange",()=>{});
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;
  renderer.setSize(w,h);cam.aspect=w/h;
  cam.fov=bookMode?(w<h?98:58):(w<h?80:70);
  cam.updateProjectionMatrix();
  try{storyCam.aspect=w/h;storyCam.fov=w<h?75:55;storyCam.updateProjectionMatrix();}catch(e){}
}
addEventListener("resize",resize);

const P=new THREE.Vector3(0,0,0); // Start between both tables.
let playerVy=0,grounded=true,last=performance.now();
const PLAYER_RADIUS=.30,PLAYER_EYE=2.0;
function blockTopAt(x,z){
  let top=0;
  for(const n of floorNotes){
    if(n.fall)continue;
    const h=noteHalfExtents(n);
    if(Math.abs(x-n.mesh.position.x)<h.x+PLAYER_RADIUS*.35&&Math.abs(z-n.mesh.position.z)<h.z+PLAYER_RADIUS*.35)
      top=Math.max(top,n.mesh.position.y+h.y);
  }
  return top;
}
function blocked(x,z,feetY){
  const roomObstacle=(Math.abs(x)<4.5&&z<-3.0&&z>-6.2)||
    isTablesArea(x,z,.3)||
    PIL.some(p=>Math.hypot(x-p[0],z-p[1])<.8);
  const noteObstacle=floorNotes.some(n=>!n.fall&&(()=>{
    const h=noteHalfExtents(n),top=n.mesh.position.y+h.y;
    const overlaps=Math.abs(x-n.mesh.position.x)<h.x+PLAYER_RADIUS&&Math.abs(z-n.mesh.position.z)<h.z+PLAYER_RADIUS;
    return overlaps&&feetY<top-.035;
  })());
  return roomObstacle||noteObstacle;
}
// ---------- HUD: Coins, Toast ----------
function updateCoinHud(){const el=$("coins");if(el)el.textContent="🪙 "+save.coins;}
let toastTimer=null;
function showToast(text){
  if(!text)return;
  const el=$("toast");if(!el)return;
  el.textContent=text;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);
}

// ---------- Tutorial (einfach, ohne Zahlen, ohne Zeitdruck) ----------
// Jede Aufgabe zeigt nur, WELCHE Blöcke man nehmen soll – als Bild, nicht als Zahl.
const TUTORIAL_TASKS=[[4],[2,2],[2,1,1],[1,1,1,.5,.5],[2,1,.5,.25,.25]];
const noteIconCache={};
function noteIcon(len){
  if(!noteIconCache[len]){const tex=noteTopTexture(len);noteIconCache[len]=tex.image.toDataURL();tex.dispose();}
  return noteIconCache[len];
}
const tutMarker=new THREE.Mesh(new THREE.ConeGeometry(.17,.42,14),new THREE.MeshBasicMaterial({color:0xffd43b,depthTest:false,transparent:true,fog:false}));
tutMarker.rotation.x=Math.PI;tutMarker.renderOrder=40;tutMarker.visible=false;scene.add(tutMarker);
function tutorialState(){
  const req=TUTORIAL_TASKS[Math.min(tutorialStep,TUTORIAL_TASKS.length-1)];
  const settled=tableNotes.filter(n=>!n.fall);
  const pool=settled.slice(),done=req.map(len=>{const i=pool.findIndex(n=>n.len===len);if(i<0)return false;pool.splice(i,1);return true;});
  const missing=req.filter((_,i)=>!done[i]);
  return {req,done,missing,extras:pool,rolling:tableNotes.some(n=>n.fall)};
}
function nearestFloorNote(lens){
  let best=null,bd=1e9;
  for(const n of floorNotes){if(n.fall||!lens.includes(n.len))continue;const d=n.mesh.position.distanceToSquared(cam.position);if(d<bd){bd=d;best=n;}}
  return best;
}
function iconsHtml(req,done){
  // Gleiche Blöcke zusammenfassen: "so einen Block [..]" bzw. "solche Blöcke [..][..]"
  const groups=[];
  req.forEach((len,i)=>{let g=groups.find(g=>g.len===len);if(!g)groups.push(g={len,items:[]});g.items.push(done[i]);});
  return groups.map(g=>{
    const imgs=g.items.map(d=>`<span class="tutIcon${d?" done":""}"><img src="${noteIcon(g.len)}" alt="">${d?"<b>✔</b>":""}</span>`).join("");
    return `${g.items.length>1?tr("manyBlocks"):tr("oneBlock")} ${imgs}`;
  }).join(tr("and"));
}
let lastTutHtml="",lastTutVoice="";
// Stimme: spielt voice/<sprache>/<id>.mp3, sobald sich die Anweisung ändert (falls vorhanden).
function tutVoice(id){if(id&&id!==lastTutVoice){lastTutVoice=id;VOICE.play(id);}}
function updateTutorialUI(now){
  const panel=$("tutorial");
  if(mode!=="tutorial"){tutMarker.visible=false;return;}
  const st=tutorialState();
  const dots=TUTORIAL_TASKS.map((_,i)=>`<i class="${i<tutorialStep?"on":i===tutorialStep?"now":""}"></i>`).join("");
  let text,pos=null,voice=null;
  const sumIsFour=!st.rolling&&tableNotes.length>0&&Math.abs(tsum()-4)<EPS;
  if(tutorialStep>=TUTORIAL_TASKS.length){text=tr("tutDoneTitle")+" 🎉";}
  else if(locked){text=tr("tutSuper");}
  else if(held){
    const needed=st.missing.includes(held.len);
    text=needed?`${tr("tutThrow")}<div class="tutIcons">${iconsHtml(st.req,st.done)}</div>`:tr("tutWrongHeld");
    voice=needed?"tut_throw":"tut_wrong";
    if(needed)pos=new THREE.Vector3(0,TY+.95,TABLE_NOTE_Z);
  }else if(st.rolling){text=tr("tutWait");}
  else if(!st.missing.length||sumIsFour){
    // Genau 4 Schläge auf dem Tisch (auch mit anderen Noten) = richtig, also prüfen lassen.
    text=tr("tutCheck");voice="tut_check";
    pos=new THREE.Vector3(checkButton.position.x,TY+.8,checkButton.position.z);
  }else if(st.extras.length){
    text=tr("tutExtra");voice="tut_extra";
    pos=st.extras[0].mesh.position.clone().add(new THREE.Vector3(0,.8,0));
  }else{
    text=tr("tutTake",{icons:iconsHtml(st.req,st.done),pron:st.req.length>1?tr("pronMany"):tr("pronOne")});
    voice="tut_task_"+(tutorialStep+1);
    const n=nearestFloorNote(st.missing);if(n)pos=n.mesh.position.clone().add(new THREE.Vector3(0,.8,0));
  }
  if(voice&&!tutDoneShown)tutVoice(voice);
  const help=tutorialStep<2&&!locked?`<div class="tutHelp">${hasTouch?tr("tutHelpTouch"):tr("tutHelpDesktop")}</div>`:"";
  const html=`<div class="tutDots">${dots}</div><div class="tutText">${text}</div>${help}`;
  if(panel&&html!==lastTutHtml){lastTutHtml=html;panel.innerHTML=html;}
  tutMarker.visible=!!pos&&!bookMode;
  if(pos){tutMarker.position.copy(pos);tutMarker.position.y+=Math.sin(now/180)*.08;}
}
let tutDoneShown=false;
function finishTutorialTask(){
  tutorialStep++;lastTutVoice="";
  if(tutorialStep>=TUTORIAL_TASKS.length){
    save.tutorialDone=true;persist();
    clearTableAndRefill();
    showTutorialDone();
  }else clearTableAndRefill(TUTORIAL_TASKS[tutorialStep]);
}
// Großes "Tutorial geschafft!"-Fenster. Erst mit dem Knopf geht es ins Spiel.
function showTutorialDone(){
  tutDoneShown=true;
  if(document.pointerLockElement)document.exitPointerLock();
  resetJoystick();for(const k in key)key[k]=0;
  $("tutDoneTitle").textContent=tr("tutDoneTitle");
  $("tutDoneText").textContent=tr("tutDoneText");
  $("tutDoneBtn").textContent=tr("tutDoneBtn");
  document.body.classList.add("tut-done");
  SFX.play("unlock",.9);setTimeout(()=>SFX.play("correct",.7),250);
  VOICE.play("tut_done");
}
function closeTutorialDone(){
  if(!tutDoneShown)return;
  tutDoneShown=false;document.body.classList.remove("tut-done");
  VOICE.stop();SFX.play("click");
  setMode("game");updateCoinHud();
}

function gameTick(now,dt){
  updateTutorialUI(now);
}

// ---------- Story: Der zu saubere Mond ----------
const storyScene=new THREE.Scene();storyScene.background=new THREE.Color(0x000004);
const storyCam=new THREE.PerspectiveCamera(55,1,.05,400);
storyScene.add(new THREE.AmbientLight(0x334466,.35));
const storySun=new THREE.DirectionalLight(0xffffff,1.1);storySun.position.set(-8,3,6);storyScene.add(storySun);
const storyMoonLight=new THREE.PointLight(0xdfe8ff,0,40);storyScene.add(storyMoonLight);
{
  const g=new THREE.BufferGeometry(),p=[];
  for(let i=0;i<1800;i++){const v=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(120+Math.random()*80);p.push(v.x,v.y,v.z);}
  g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));
  storyScene.add(new THREE.Points(g,new THREE.PointsMaterial({size:.6,color:0xffffff,sizeAttenuation:true})));
}
// Die Erde aus ~1000 Bruchstücken (Ikosaeder, Stufe 6 = 980 Dreiecke, jedes ein Keil).
const EARTH_R=2;
const earthUniforms={uExplode:{value:0},uGlow:{value:0},uCrack:{value:0}};
const earthMesh=(function(){
  const base=new THREE.IcosahedronGeometry(EARTH_R,6);
  const src=base.attributes.position;
  const pos=[],col=[],cen=[],rnd=[];
  const land=d=>Math.sin(d.x*3.1+1.3)*Math.cos(d.y*2.7-.4)+Math.sin(d.z*3.7+d.x*1.4)*.8+Math.cos(d.y*5.3+d.z*2.1)*.35;
  const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3();
  for(let i=0;i<src.count;i+=3){
    A.fromBufferAttribute(src,i);B.fromBufferAttribute(src,i+1);C.fromBufferAttribute(src,i+2);
    const ctr=A.clone().add(B).add(C).multiplyScalar(1/3),d=ctr.clone().normalize();
    const inner=k=>k.clone().multiplyScalar(.62);
    const a2=inner(A),b2=inner(B),c2=inner(C);
    let top;
    if(Math.abs(d.y)>.86)top=new THREE.Color(0xf4f8ff);
    else if(land(d)>.35)top=new THREE.Color().setHSL(.27+Math.random()*.06,.55,.32+Math.random()*.08);
    else if(land(d)>.22)top=new THREE.Color(0xc8b070);
    else top=new THREE.Color().setHSL(.58+Math.random()*.02,.7,.36+Math.random()*.05);
    const rock=new THREE.Color().setHSL(.05+Math.random()*.03,.8,.35+Math.random()*.1);
    const tris=[[A,B,C,top],[c2,b2,a2,rock],[A,a2,B,rock],[B,a2,b2,rock],[B,b2,C,rock],[C,b2,c2,rock],[C,c2,A,rock],[A,c2,a2,rock]];
    const r=[Math.random(),Math.random(),Math.random()];
    for(const [p1,p2,p3,c] of tris){
      for(const p of [p1,p2,p3]){pos.push(p.x,p.y,p.z);col.push(c.r,c.g,c.b);cen.push(ctr.x,ctr.y,ctr.z);rnd.push(r[0],r[1],r[2]);}
    }
  }
  base.dispose();
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setAttribute("aCenter",new THREE.Float32BufferAttribute(cen,3));
  g.setAttribute("aRand",new THREE.Float32BufferAttribute(rnd,3));
  g.computeVertexNormals();
  const m=new THREE.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,earthUniforms);
    sh.vertexShader="uniform float uExplode;uniform float uCrack;attribute vec3 aCenter;attribute vec3 aRand;\n"+
      "vec3 rotAx(vec3 v,vec3 k,float a){return v*cos(a)+cross(k,v)*sin(a)+k*dot(k,v)*(1.0-cos(a));}\n"+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>",
      "vec3 transformed=vec3(position);\n"+
      "vec3 dir=normalize(aCenter);\n"+
      "vec3 axis=normalize(aRand-0.5+vec3(0.001));\n"+
      "float e=uExplode;\n"+
      "transformed=aCenter+rotAx(transformed-aCenter,axis,e*(aRand.z-0.5)*9.0);\n"+
      "transformed+=dir*uCrack*(0.03+aRand.x*0.05);\n"+
      "transformed+=(dir*(1.0+aRand.x*1.6)+(aRand-0.5)*0.9)*e*(2.5+aRand.y*5.0);");
    sh.fragmentShader="uniform float uGlow;\n"+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,0.97,0.9)*uGlow;");
  };
  const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;return mesh;
})();
storyScene.add(earthMesh);
const earthCore=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R*.6,32,16),new THREE.MeshBasicMaterial({color:0xff5a1a}));
storyScene.add(earthCore);
const earthAtmo=glowSprite(0x6ab0ff,EARTH_R*3.2);earthAtmo.material.opacity=.35;storyScene.add(earthAtmo);
// Der Mond: blank geputzt, mit leichten Kratern.
const storyMoon=(function(){
  const c=document.createElement("canvas");c.width=512;c.height=256;const x=c.getContext("2d");
  x.fillStyle="#e9eef8";x.fillRect(0,0,512,256);
  for(let i=0;i<60;i++){const r=4+Math.random()*18;x.fillStyle=`rgba(150,160,185,${.15+Math.random()*.25})`;x.beginPath();x.arc(Math.random()*512,Math.random()*256,r,0,6.3);x.fill();}
  const m=new THREE.Mesh(new THREE.SphereGeometry(.75,40,24),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),roughness:.25,metalness:.1,emissive:0xffffff,emissiveIntensity:0}));
  m.position.set(6.2,2.1,-4);return m;
})();
storyScene.add(storyMoon);storyMoonLight.position.copy(storyMoon.position);
const moonHalo=glowSprite(0xdfe8ff,3);moonHalo.position.copy(storyMoon.position);storyScene.add(moonHalo);
const moonSparkle=(function(){
  const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,"#fff");g.addColorStop(1,"rgba(255,255,255,0)");
  x.fillStyle=g;x.fillRect(60,0,8,128);x.fillRect(0,60,128,8);x.beginPath();x.arc(64,64,10,0,6.3);x.fill();
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));
  s.position.copy(storyMoon.position).add(new THREE.Vector3(-.35,.35,.6));s.scale.set(1.2,1.2,1);return s;
})();
storyScene.add(moonSparkle);
// Lichtstrahl vom Mond zur Erde
const beamMat=new THREE.MeshBasicMaterial({color:0xf2f6ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const beam=(function(){
  const from=storyMoon.position,len=from.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.55,1.6,len,24,1,true),beamMat);
  m.position.copy(from).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),from.clone().normalize().negate());
  return m;
})();
storyScene.add(beam);
// Fallende Trümmer-Funken für die Fall-Szene
const FALL_N=400;
const fallGeo=new THREE.BufferGeometry(),fallPos=new Float32Array(FALL_N*3);
fallGeo.setAttribute("position",new THREE.BufferAttribute(fallPos,3));
const fallStreaks=new THREE.Points(fallGeo,new THREE.PointsMaterial({size:.12,color:0xffc890,transparent:true,opacity:0,depthWrite:false}));
fallStreaks.frustumCulled=false;storyScene.add(fallStreaks);
function resetFallStreaks(){for(let i=0;i<FALL_N;i++){fallPos[i*3]=(Math.random()-.5)*10;fallPos[i*3+1]=(Math.random()-.5)*16;fallPos[i*3+2]=(Math.random()-.5)*10;}fallGeo.attributes.position.needsUpdate=true;}
resetFallStreaks();

// Zeitplan der Geschichte (Sekunden). Text kommt aus lang.js, Stimme aus voice/<sprache>/story_N.mp3.
const STORY=[{t:0},{t:4},{t:9},{t:14},{t:18},{t:23},{t:28},{t:33},{t:38.5,end:true}];
// Soundeffekte in der Geschichte
const STORY_SFX=[{t:4.6,name:"sparkle",vol:.7},{t:10,name:"moon",vol:.55},{t:15,name:"rumble",vol:.8},{t:17.9,name:"boom",vol:1},{t:18.3,name:"rumble",vol:.9},{t:23,name:"fall",vol:.55}];
let storyT=0,storyLine=-1,storyDone=null,storySfxDone=new Set(),storySounds=[];
const smooth=(a,b,t)=>{const x=Math.min(1,Math.max(0,(t-a)/(b-a)));return x*x*(3-2*x);};
function startStory(onDone){
  storyT=0;storyLine=-1;storyDone=onDone||null;storySfxDone=new Set();storySounds=[];
  earthUniforms.uExplode.value=0;earthUniforms.uGlow.value=0;earthUniforms.uCrack.value=0;
  resetFallStreaks();
  setMode("story");
  const cap=$("storyCaption");if(cap){cap.textContent="";cap.classList.remove("show");}
}
function endStory(){
  if(mode!=="story")return;
  VOICE.stop();storySounds.forEach(a=>{try{a.pause();}catch(e){}});storySounds=[];
  save.introSeen=true;persist();
  const done=storyDone;storyDone=null;
  if(done)done();else setMode("menu");
}
function skipStoryLine(){
  const next=STORY.find(s=>s.t>storyT+.05);
  if(next){
    // übersprungene Effekte nicht nachträglich abspielen
    STORY_SFX.forEach((c,i)=>{if(c.t<next.t)storySfxDone.add(i);});
    storyT=next.t;
  }
}
function updateStory(dt){
  storyT+=dt;const t=storyT;
  // Untertitel
  let idx=-1;for(let i=0;i<STORY.length;i++)if(t>=STORY[i].t)idx=i;
  if(idx!==storyLine){
    storyLine=idx;const line=STORY[idx];
    if(line&&line.end){endStory();return;}
    const cap=$("storyCaption");
    if(cap&&line){cap.classList.remove("show");void cap.offsetWidth;cap.textContent=I18N.get("story")[idx]||"";cap.classList.add("show");}
    if(line)VOICE.play("story_"+(idx+1));
  }
  STORY_SFX.forEach((c,i)=>{if(t>=c.t&&!storySfxDone.has(i)){storySfxDone.add(i);const a=SFX.play(c.name,c.vol);if(a)storySounds.push(a);}});
  // Mond wird immer heller
  const shine=smooth(4,8,t)*.35+smooth(9,14,t)*.65;
  storyMoon.material.emissiveIntensity=shine*1.2;
  moonHalo.scale.setScalar(3+shine*14);moonHalo.material.opacity=.5+shine*.5;
  storyMoonLight.intensity=shine*4;
  moonSparkle.material.opacity=smooth(4.5,5.5,t)*(1-smooth(8,9,t))*(.6+Math.sin(t*7)*.4);
  moonSparkle.material.rotation=t*.8;
  beamMat.opacity=smooth(10,14,t)*.55*(1-smooth(18,19,t));
  // Erde glüht, bekommt Risse und zerbricht
  earthUniforms.uGlow.value=smooth(12,17.6,t)*.9*(1-smooth(18,20,t));
  earthUniforms.uCrack.value=smooth(15,17.8,t)*(1+Math.sin(t*40)*.15);
  const ex=Math.max(0,t-18);
  earthUniforms.uExplode.value=ex>0?Math.pow(ex,.75)*.55:0;
  earthCore.visible=t<19.5;earthCore.scale.setScalar(1+smooth(16,18,t)*.05);
  earthAtmo.material.opacity=.35*(1-smooth(17.5,18.5,t));
  earthMesh.rotation.y=t*.06;
  // Kamera
  const shake=t>16.5&&t<21?(t<18?.35:1-smooth(18,21,t))*.14:0;
  if(t<23){
    const k=smooth(0,22,t);
    storyCam.position.set(-1.2+k*.8+(Math.random()-.5)*shake,.6+(Math.random()-.5)*shake,9.5-k*1.5);
    storyCam.lookAt(1.6-k*1.2,.4,-1);
  }else{
    // Hinein in die Trümmer: die Kamera fällt nach unten.
    const f=t-23;
    storyCam.position.set(Math.sin(f*.8)*.4,-f*1.8,6.5-f*.6);
    storyCam.lookAt(Math.sin(f*.8)*.4,-f*1.8-6,6.5-f*.6-3);
    storyCam.rotateZ(Math.sin(f*1.3)*.15+f*.05);
    for(let i=0;i<FALL_N;i++){
      fallPos[i*3+1]+=dt*14;
      if(fallPos[i*3+1]>8)fallPos[i*3+1]-=16;
    }
    fallGeo.attributes.position.needsUpdate=true;
    fallStreaks.position.copy(storyCam.position);
  }
  fallStreaks.material.opacity=smooth(23,24,t)*(1-smooth(27,28,t));
  // Blitz beim Zerbrechen, Abblenden am Ende der Fall-Szene
  const fade=$("storyFade");
  if(fade){
    const flash=smooth(17.7,18,t)*(1-smooth(18,19.2,t));
    const black=smooth(26.5,28,t);
    fade.style.background=black>0?"#000":"#fff";
    fade.style.opacity=black>0?black*.92:flash;
  }
}

// ---------- Hauptmenü ----------
function resetView(){P.set(0,0,-1);playerVy=0;yaw=0;pitch=-.35;}
function showMenuPanel(name){
  for(const id of ["menuMain","menuConfirm","menuChoose"])$(id).hidden=id!==name;
}
function updateMenu(){
  $("btnContinue").hidden=!save.started;
  const info=$("menuInfo");
  if(info)info.textContent=save.started?tr("menuInfoSave",{coins:save.coins,room:roomName(save.theme)}):tr("menuInfoNew");
  const onOff=v=>v?tr("on"):tr("off"),level=v=>[tr("off"),tr("quiet"),tr("loud")][v];
  $("btnLang").textContent=I18N.lang==="de"?"Deutsch":"English";
  $("btnMusic").textContent=tr("music")+": "+level(settings.music);
  $("btnSfx").textContent=tr("sounds")+": "+level(settings.sfx);
  $("btnVoice").textContent=tr("voice")+": "+onOff(settings.voice);
  $("btnAfk").textContent=tr("afkVideos")+": "+onOff(settings.afk);
  $("btnFull").textContent=tr("fullscreen")+": "+onOff(settings.fullscreen);
}
// Alle sichtbaren Texte in der gewählten Sprache neu setzen.
function applyLanguage(){
  I18N.set(settings.lang);VOICE.lang=I18N.lang;
  document.querySelectorAll("[data-t]").forEach(el=>{el.innerHTML=tr(el.dataset.t);});
  $("confirmText").textContent=tr("confirmNew",{coins:save.coins});
  refreshShop();refreshShopSign();refreshCheckLabel();showHold();
  if(bookMode)setBookSpread(bookSpread);else setBookSpread(0);
  lastTutHtml="";updateMenu();
}
function setMode(m){
  mode=m;
  document.body.classList.remove("mode-menu","mode-tutorial","mode-game","mode-story");
  document.body.classList.add("mode-"+m);
  if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
  tutMarker.visible=false;lastTutHtml="";
  if(m!=="story"){const fade=$("storyFade");if(fade)fade.style.opacity=0;}
  if(m!=="tutorial"&&tutDoneShown){tutDoneShown=false;document.body.classList.remove("tut-done");}
  if(m==="menu"){
    VOICE.stop();
    resetJoystick();for(const k in key)key[k]=0;
    if(bookMode)closeBook();
    showMenuPanel("menuMain");updateMenu();
  }
  resize();
}
// Automatisches Vollbild (nur nach einem Klick/Tipp erlaubt).
function goFullscreen(){
  if(!settings.fullscreen)return;
  const el=document.documentElement;
  if(document.fullscreenElement||document.webkitFullscreenElement)return;
  try{const r=(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el,{navigationUI:"hide"});if(r&&r.catch)r.catch(()=>{});}catch(e){}
}
function resetSave(){
  Object.assign(save,JSON.parse(JSON.stringify(SAVE_DEFAULT)));persist();
  applyTheme(0);refreshShop();updateCoinHud();
}
function startTutorial(){
  save.started=true;persist();
  tutorialStep=0;tutorialCorrect=0;lastTutHtml="";lastTutVoice="";resetView();setMode("tutorial");newRound(TUTORIAL_TASKS[0]);updateCoinHud();
}
function startGame(){resetView();setMode("game");newRound();updateCoinHud();}
function continueGame(){if(!save.tutorialDone)startTutorial();else startGame();}
const click=fn=>e=>{SFX.play("click",.8);fn(e);};
$("btnContinue").addEventListener("click",click(()=>{goFullscreen();continueGame();}));
$("btnNew").addEventListener("click",click(()=>{
  if(save.started){$("confirmText").textContent=tr("confirmNew",{coins:save.coins});showMenuPanel("menuConfirm");}
  else showMenuPanel("menuChoose");
}));
$("btnYes").addEventListener("click",click(()=>{resetSave();showMenuPanel("menuChoose");}));
$("btnNo").addEventListener("click",click(()=>showMenuPanel("menuMain")));
// Neues Spiel: Geschichte ansehen oder gleich selbst spielen – danach immer das Tutorial.
$("btnWatch").addEventListener("click",click(()=>{goFullscreen();save.started=true;persist();startStory(startTutorial);}));
$("btnPlayNow").addEventListener("click",click(()=>{goFullscreen();save.introSeen=true;startTutorial();}));
$("btnStory").addEventListener("click",click(()=>{goFullscreen();startStory(()=>setMode("menu"));}));
$("btnTutorial").addEventListener("click",click(()=>{goFullscreen();startTutorial();}));
$("btnLang").addEventListener("click",click(()=>{settings.lang=I18N.lang==="de"?"en":"de";persistSettings();applyLanguage();}));
$("btnVoice").addEventListener("click",click(()=>{settings.voice=!settings.voice;VOICE.enabled=settings.voice;if(!settings.voice)VOICE.stop();persistSettings();updateMenu();}));
// Musik/Sounds: laut → leise → aus → laut
$("btnMusic").addEventListener("click",click(()=>{settings.music=(settings.music+2)%3;persistSettings();applyAudioSettings();updateMenu();}));
$("btnSfx").addEventListener("click",click(()=>{settings.sfx=(settings.sfx+2)%3;persistSettings();applyAudioSettings();updateMenu();}));
$("btnAfk").addEventListener("click",click(()=>{settings.afk=!settings.afk;lastInput=performance.now();persistSettings();updateMenu();}));
$("btnFull").addEventListener("click",click(()=>{
  settings.fullscreen=!settings.fullscreen;persistSettings();updateMenu();
  if(settings.fullscreen)goFullscreen();
  else if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
}));
$("menuBtn").addEventListener("click",click(()=>setMode("menu")));
$("tutDoneBtn").addEventListener("click",e=>{e.stopPropagation();closeTutorialDone();});
$("storySkip").addEventListener("click",e=>{e.stopPropagation();SFX.play("click",.8);endStory();});
$("story").addEventListener("pointerdown",e=>{if(e.target.id!=="storySkip")skipStoryLine();});

// Schritte: Geräusch passt zum Boden des Raums.
let stepDist=0,wasGrounded=true;
function stepSound(){return currentTheme===3?"step_grass":(currentTheme===2||currentTheme===5)?"step_snow":"step_concrete";}

(function loop(now){requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(mode==="story"){
    updateStory(dt);
    physicsWorld.step(1/60,dt,5);syncPhysicsNotes();
    if(mode==="story"){renderer.render(storyScene,storyCam);return;}
  }
  if(!bookMode&&!cameraAnim){
    const menuIdle=mode==="menu";
    if(menuIdle)yaw+=dt*.06;else yaw+=(key.l-key.r)*1.8*dt;
    if(key.j&&grounded&&!menuIdle){playerVy=7.1;grounded=false;}
    playerVy-=19*dt;P.y+=playerVy*dt;
    let mv=(key.f-key.b)-touchAxisY,st=(key.sr-key.sl)+touchAxisX;
    if(menuIdle){mv=0;st=0;}
    const moveLen=Math.hypot(mv,st);if(moveLen>1){mv/=moveLen;st/=moveLen;}
    const sp=3.2*dt*(touchSprint?1.55:1);
    const nx=P.x+(-Math.sin(yaw)*mv+Math.cos(yaw)*st)*sp,nz=P.z+(-Math.cos(yaw)*mv-Math.sin(yaw)*st)*sp;
    const cx=Math.max(-6.5,Math.min(6.5,nx)),cz=Math.max(-6.5,Math.min(6.5,nz));
    const ox=P.x,oz=P.z;
    if(!blocked(cx,P.z,P.y))P.x=cx;if(!blocked(P.x,cz,P.y))P.z=cz;
    const supportY=blockTopAt(P.x,P.z),fallSpeed=-playerVy;
    if(P.y<=supportY&&playerVy<=0){P.y=supportY;playerVy=0;grounded=true;}else grounded=false;
    if(!menuIdle){
      if(grounded&&!wasGrounded&&fallSpeed>3)SFX.play(stepSound(),.55,.85);
      if(grounded){stepDist+=Math.hypot(P.x-ox,P.z-oz);if(stepDist>(touchSprint?.85:.7)){stepDist=0;SFX.play(stepSound(),.32,.92+Math.random()*.16);}}
    }
    wasGrounded=grounded;
    cam.position.set(P.x,P.y+PLAYER_EYE,P.z);cam.up.set(0,1,0);cam.rotation.set(pitch,yaw,0);
  }
  if(cameraAnim){
    cameraAnim.t=Math.min(1,cameraAnim.t+dt/cameraAnim.duration);
    const eased=cameraAnim.t<.5?2*cameraAnim.t*cameraAnim.t:1-Math.pow(-2*cameraAnim.t+2,2)/2;
    cam.position.lerpVectors(cameraAnim.fromPos,cameraAnim.toPos,eased);
    cam.quaternion.slerpQuaternions(cameraAnim.fromQuat,cameraAnim.toQuat,eased);
    if(cameraAnim.t>=1){cam.position.copy(cameraAnim.toPos);cam.quaternion.copy(cameraAnim.toQuat);cameraAnim=null;}
  }
  if(bookFlipAnim){
    const a=bookFlipAnim;
    a.t=Math.min(1,a.t+dt/a.duration);
    const eased=a.t*a.t*(3-2*a.t);
    a.pivot.rotation.z=a.direction*eased;
    if(!a.swapped&&a.t>=.5){
      if(bookFlipMat.map)bookFlipMat.map.dispose();
      bookFlipMat.map=makeBookPageTexture(a.nextIndex);bookFlipMat.needsUpdate=true;a.swapped=true;
    }
    if(a.t>=1){
      setBookSpread(a.nextSpread);
      bookGroup.remove(a.pivot);
      a.page.geometry.dispose();
      bookFlipAnim=null;
    }
  }
  lamp.intensity=.95+Math.sin(now/90)*.12+Math.sin(now/37)*.08;
  if(currentTheme===4)lamp.color.setHSL((now/5000)%1,.9,.55);
  gameTick(now,dt);
  updateParticles(dt,now);updateShop(dt,now);

  physicsWorld.step(1/60,dt,5);
  syncPhysicsNotes();
  for(let i=fx.length-1;i>=0;i--){if(!fx[i].update(dt))fx.splice(i,1);}
  for(let i=wrongCheckMarkers.length-1;i>=0;i--){
    const marker=wrongCheckMarkers[i];marker.t+=dt;
    marker.group.rotation.y=Math.atan2(P.x-marker.group.position.x,P.z-marker.group.position.z);
    marker.material.opacity=Math.max(0,1-marker.t/marker.duration);
    marker.group.scale.setScalar(1+marker.t*.14);
    if(marker.t>=marker.duration){
      scene.remove(marker.group);marker.geometry.dispose();marker.material.dispose();wrongCheckMarkers.splice(i,1);
    }
  }
  renderer.render(scene,cam);
})(last);

resize();newRound();applyTheme(save.theme);updateCoinHud();
// Beim Öffnen kommt das Menü: Weiterspielen (Spielstand) oder Neues Spiel (Geschichte/Tutorial).
applyLanguage();setMode("menu");
