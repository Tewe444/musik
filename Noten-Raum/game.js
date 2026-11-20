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
let mode="menu"; // "menu" | "tutorial" | "game"
const ROUND_LIMIT=90,FAST_TIME=45; // ruhiger Zeitdruck: 90 s pro Runde, unter 45 s = Bonus-Coin
let roundToken=0,roundTime=0,tutorialCorrect=0,tutFlash=0;
const SAVE_KEY="nr3d_save_v1";
const save={coins:0,owned:[0],theme:0,tutorialDone:false};
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");if(s&&typeof s==="object")Object.assign(save,s);}catch(e){}
if(!Array.isArray(save.owned)||!save.owned.includes(0))save.owned=[0].concat(Array.isArray(save.owned)?save.owned:[]);
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}
const hex=n=>"#"+n.toString(16).padStart(6,"0");
const THEMES=[
  {name:"Mondruine",price:0,bg:0x050509,fog:0x050509,stone:0x414147,floor:0xffffff,amb:0x4a5578,lamp:0xff9a3c,moonL:0x9db4f0,moon:0xdfe8ff},
  {name:"Sonnenuntergang",price:3,bg:0x2b1226,fog:0x4a2230,stone:0x7a5244,floor:0xffd9b0,amb:0x8a5a60,lamp:0xff7a3c,moonL:0xff9a5a,moon:0xffb347},
  {name:"Eiswelt",price:5,bg:0x0a1a30,fog:0x12304f,stone:0x8fb4d0,floor:0xbfe0ff,amb:0x5a7ea8,lamp:0x9fd8ff,moonL:0xbfe4ff,moon:0xf0fbff},
  {name:"Wald",price:6,bg:0x05120a,fog:0x0a2814,stone:0x3b5a36,floor:0xa8d49a,amb:0x3f6a4a,lamp:0xcfff8a,moonL:0xb8ffb0,moon:0xeaffd0},
  {name:"Neon-Disco",price:8,bg:0x12001f,fog:0x1d0033,stone:0x4a2070,floor:0xc08aff,amb:0x6a3a9a,lamp:0xff3ad0,moonL:0x3affea,moon:0x6affff}
];
let currentTheme=0;
const U=1.2,D=.9,H=.22,EPS=1e-6,TY=1.0,TZ=-4.5,X0=-3.4;
const VAL={4:{n:"Ganze",c:"#77777a"},2:{n:"Halbe",c:"#77777a"},1:{n:"Viertel",c:"#77777a"},.5:{n:"Achtel",c:"#77777a"},.25:{n:"Sechzehntel",c:"#77777a"}};
const fmt=n=>{const q=Math.round(n*4),w=Math.floor(q/4),r=q%4;return `${w||""}${["","¼","½","¾"][r]}`||"0"};
const BOOK_PAGES=[
  {title:"Das Spiel",text:"Vom Himmel fallen steinfarbene Notenblöcke. Es sind immer genau 15 Steine im Spiel.\n\nNimm Noten auf und wirf sie auf den Tisch. Zusammen sollen sie genau vier Schläge ergeben. Danach drückst du den roten PRÜFEN-Knopf."},
  {title:"Die Notenwerte",text:""},
  {title:"So spielst du",text:"Wirf bis zu fünf Noten auf den Tisch. Liegen sie ruhig, zählen sie.\n\nZu wenig oder zu viel? Klicke eine Note auf dem Tisch an, nimm sie wieder auf und tausche sie aus."},
  {title:"So prüfst du",text:"1. Lege Noten auf den Tisch.\n2. Zähle die Schläge zusammen.\n3. Genau 4? Dann drücke den roten PRÜFEN-Knopf.\n\nRichtig = du bekommst Coins. Falsch = ein rotes X erscheint über dem Knopf. Dann tauschst du Noten und prüfst noch einmal."},
  {title:"Steuerung",text:"PC: W, A, S, D laufen · Maus umschauen · Leertaste springen. Klick: Stein nehmen oder werfen. Rechtsklick oder E: nach vorne werfen.\n\nHandy: Joystick links laufen (ganz nach vorne = rennen) · Pfeil springen · Bildschirm ziehen = umschauen · Knopf „Nehmen/Werfen“ oder Tippen."},
  {title:"Coins und Zeit",text:"Das Tutorial hat 5 Aufgaben. Hast du 5 richtig, startet das Spiel.\n\nIm Spiel siehst du oben rechts deine Coins. Pro Runde hast du 90 Sekunden. Unter 45 Sekunden gibt es 2 Coins. Läuft die Zeit ab, beginnt einfach eine neue Runde."},
  {title:"Der Shop",text:"Neben dem Buch steht der Shop. Dort liegen Raum-Designs auf dem Tisch.\n\nZiele auf ein Design und klicke/tippe: Mit genug Coins kaufst du es und dein Raum sieht sofort anders aus. Gekaufte Designs kannst du jederzeit wieder auswählen."},
  {title:"Credits",credits:true}
];

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
function checker(){
  const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");
  x.fillStyle="#29292e";x.fillRect(0,0,256,256);x.fillStyle="#222227";x.fillRect(0,0,128,128);x.fillRect(128,128,128,128);x.strokeStyle="rgba(0,0,0,.5)";x.lineWidth=2;for(let i=0;i<14;i++){x.beginPath();let px=Math.random()*256,py=Math.random()*256;x.moveTo(px,py);for(let j=0;j<4;j++){px+=Math.random()*50-25;py+=Math.random()*50-25;x.lineTo(px,py)}x.stroke()}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,7);return t;
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({map:checker()}));
floor.rotation.x=-Math.PI/2;floor.userData.kind="floor";scene.add(floor);
const wallM=new THREE.MeshStandardMaterial({color:0xe9dcc3,side:THREE.DoubleSide});
[].forEach(([x,z,r])=>{
  const w=new THREE.Mesh(new THREE.PlaneGeometry(14,3.4),wallM);
  if(x===0)w.position.set(0,1.7,z);else w.position.set(x,1.7,0);w.rotation.y=r;scene.add(w)});
const ceil=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({color:0xf5f0e6}));
// Ruine: offene Decke, kaputte Mauern, Säulen, Schutt, Sternenhimmel
const PIL=[[-5.2,-1],[5.2,-1],[-5.2,3.5],[5.2,3.5]];
let ruinStoneMat=null,moonMesh=null;
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
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({size:.45,color:0xffffff,fog:false})));
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.2,24,16),new THREE.MeshBasicMaterial({color:0xdfe8ff,fog:false}));moon.position.set(-22,26,-30);scene.add(moon);moonMesh=moon;
}
buildRuin();

// Schlichter Holztisch ohne Taktfeld, Linien oder Beschriftung
const wood=new THREE.MeshStandardMaterial({color:0x583719,roughness:.88});
const tabletop=new THREE.Mesh(new THREE.BoxGeometry(8,.12,2.4),wood);
tabletop.position.set(0,TY-.06,TZ);tabletop.userData.kind="table";scene.add(tabletop);
addStaticPhysicsBox(8,.12,2.4,0,TY-.06,TZ);
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
  x.fillStyle="#fff";x.textAlign="center";x.font="bold 58px system-ui";x.fillText("PRÜFEN",180,112);
  return new THREE.CanvasTexture(c);
}
const checkButton=new THREE.Mesh(
  new THREE.BoxGeometry(1.18,.2,.82),
  [new THREE.MeshStandardMaterial({color:0x702027}),new THREE.MeshStandardMaterial({color:0x702027}),new THREE.MeshStandardMaterial({map:checkLabelTexture(),color:0xffffff}),new THREE.MeshStandardMaterial({color:0x55151b}),new THREE.MeshStandardMaterial({color:0x702027}),new THREE.MeshStandardMaterial({color:0x702027})]
);
checkButton.position.set(3.15,TY+.1,TZ);checkButton.userData.kind="check";scene.add(checkButton);

// Eigener kleiner Lesetisch auf der gegenüberliegenden Raumseite.
// Der große Spieltisch mit den Noten und dem PRÜFEN-Knopf bleibt am anderen Ende.
const BOOK_TABLE_X=0,BOOK_TABLE_Z=5.15,BOOK_TABLE_Y=1.0;
const bookTableWood=new THREE.MeshStandardMaterial({color:0x634326,roughness:.9});
const bookTableTop=new THREE.Mesh(new THREE.BoxGeometry(3.6,.14,2.15),bookTableWood);
bookTableTop.position.set(BOOK_TABLE_X,BOOK_TABLE_Y-.07,BOOK_TABLE_Z);
scene.add(bookTableTop);
addStaticPhysicsBox(3.6,.14,2.15,BOOK_TABLE_X,BOOK_TABLE_Y-.07,BOOK_TABLE_Z);
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
  const x=c.getContext("2d"),page=BOOK_PAGES[index];
  x.fillStyle="#f0e3c7";x.fillRect(0,0,800,1100);
  x.fillStyle="#e8d7b6";x.fillRect(20,20,760,1060);
  x.strokeStyle="#a88c60";x.lineWidth=5;x.strokeRect(24,24,752,1052);
  x.textAlign="center";x.fillStyle="#442f20";x.font="bold 48px Georgia";x.fillText(page.title,400,112);
  x.strokeStyle="#b59a70";x.lineWidth=2;x.beginPath();x.moveTo(88,150);x.lineTo(712,150);x.stroke();
  if(page.credits){
    x.fillStyle="#766047";x.font="bold 40px Georgia";x.fillText("Code: ChatGPT & Claude",400,420);
    x.fillText("Musik: Gemini",400,500);
    x.fillStyle="#362317";x.font="bold 72px Georgia";x.fillText("Tewe444",400,660);
    x.font="38px Georgia";x.fillText("Waldorfschule Rostock",400,735);
  }else if(index===1){
    // Notenwerte im Buch: Notenkopf und Hals/Fähnchen stehen direkt neben dem Namen.
    const rows=[
      {len:4,name:"Ganze Note",value:"4 Schläge"},
      {len:2,name:"Halbe Note",value:"2 Schläge"},
      {len:1,name:"Viertelnote",value:"1 Schlag"},
      {len:.5,name:"Achtelnote",value:"½ Schlag"},
      {len:.25,name:"Sechzehntelnote",value:"¼ Schlag"}
    ];
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
  x.fillText("Zum Blättern auf die linke oder rechte Seite klicken",400,1048);
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
  bookSpread=Math.max(0,Math.min(BOOK_PAGES.length-2,spread));
  for(const [mat,index] of [[bookLeftMat,bookSpread],[bookRightMat,bookSpread+1]]){
    if(mat.map)mat.map.dispose();mat.map=makeBookPageTexture(index);mat.needsUpdate=true;
  }
}
const bookFlipMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
function turnBook(side){
  if(bookFlipAnim)return;
  const nextSpread=side==="right"?bookSpread+2:bookSpread-2;
  if(nextSpread<0||nextSpread+1>=BOOK_PAGES.length)return;
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
}
function openBook(){
  if(bookMode)return;
  bookMode=true;document.body.classList.add("book-open");setBookSpread(0);
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
  bookMode=false;document.body.classList.remove("book-open");
  const backButton=$("bookBack");if(backButton)backButton.hidden=true;
  cam.up.set(0,1,0);resize();
  const targetPos=new THREE.Vector3(P.x,P.y+PLAYER_EYE,P.z);
  const euler=new THREE.Euler(pitch,yaw,0,"YXZ"),targetQuat=new THREE.Quaternion().setFromEuler(euler);
  cameraAnim={fromPos:cam.position.clone(),fromQuat:cam.quaternion.clone(),toPos:targetPos,toQuat:targetQuat,t:0,duration:.65};
}

// ---------- Tutorial-Hilfe: Wert-Schilder über den Steinen ----------
const labelMats={};
function labelMat(len){
  if(labelMats[len])return labelMats[len];
  const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");
  x.fillStyle="rgba(20,20,24,.75)";x.beginPath();x.arc(64,64,56,0,6.2832);x.fill();
  x.lineWidth=6;x.strokeStyle="#ffd43b";x.stroke();
  x.fillStyle="#ffd43b";x.font="bold 70px system-ui,sans-serif";x.textAlign="center";x.textBaseline="middle";
  x.fillText({4:"4",2:"2",1:"1",.5:"½",.25:"¼"}[len]||"?",64,70);
  labelMats[len]=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,fog:false});
  return labelMats[len];
}

// ---------- Raum-Designs anwenden ----------
function applyTheme(i){
  const t=THEMES[i]||THEMES[0];
  scene.background.set(t.bg);scene.fog.color.set(t.fog);
  if(ruinStoneMat)ruinStoneMat.color.set(t.stone);
  floor.material.color.set(t.floor);
  ambientLight.color.set(t.amb);lamp.color.set(t.lamp);moonL.color.set(t.moonL);
  if(moonMesh)moonMesh.material.color.set(t.moon);
  currentTheme=THEMES[i]?i:0;
}

// ---------- Shop neben dem Buch ----------
const SHOP_X=4.25,SHOP_Z=5.15,SHOP_Y=1.0,SHOP_W=3.7;
const shopWood=new THREE.MeshStandardMaterial({color:0x6b4a2a,roughness:.9});
const shopTop=new THREE.Mesh(new THREE.BoxGeometry(SHOP_W,.14,2.15),shopWood);
shopTop.position.set(SHOP_X,SHOP_Y-.07,SHOP_Z);scene.add(shopTop);
addStaticPhysicsBox(SHOP_W,.14,2.15,SHOP_X,SHOP_Y-.07,SHOP_Z);
for(const [dx,dz] of [[-1.65,-.82],[1.65,-.82],[-1.65,.82],[1.65,.82]]){
  const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,SHOP_Y-.14,.2),shopWood);
  leg.position.set(SHOP_X+dx,(SHOP_Y-.14)/2,SHOP_Z+dz);scene.add(leg);
}
// Schild hinter dem Tisch
{
  const c=document.createElement("canvas");c.width=512;c.height=140;const x=c.getContext("2d");
  x.fillStyle="#3b2814";x.fillRect(0,0,512,140);x.strokeStyle="#d9b25a";x.lineWidth=8;x.strokeRect(6,6,500,128);
  x.fillStyle="#ffd43b";x.textAlign="center";x.font="bold 58px Georgia";x.fillText("SHOP",256,68);
  x.fillStyle="#f1e3c2";x.font="30px Georgia";x.fillText("Raum-Designs",256,112);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.6),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),roughness:.9}));
  sign.position.set(SHOP_X,SHOP_Y+1.15,SHOP_Z+.95);sign.rotation.y=Math.PI;scene.add(sign);
  for(const dx of [-1.0,1.0]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1.15,.08),shopWood);
    post.position.set(SHOP_X+dx,SHOP_Y+.575,SHOP_Z+.95);scene.add(post);
  }
}
function shopTexture(i){
  const t=THEMES[i],c=document.createElement("canvas");c.width=256;c.height=368;const x=c.getContext("2d");
  x.fillStyle="#efe3c8";x.fillRect(0,0,256,368);
  x.strokeStyle="#a88c60";x.lineWidth=6;x.strokeRect(5,5,246,358);
  const g=x.createLinearGradient(0,18,0,200);g.addColorStop(0,hex(t.bg));g.addColorStop(1,hex(t.fog));
  x.fillStyle=g;x.fillRect(18,18,220,190);
  x.fillStyle=hex(t.moon);x.beginPath();x.arc(185,62,24,0,6.2832);x.fill();
  x.fillStyle=hex(t.stone);
  [[26,150,26,40],[58,128,26,62],[90,160,26,30],[150,140,26,50],[186,155,26,35],[214,120,20,70]].forEach(r=>x.fillRect(r[0],r[1],r[2],r[3]));
  x.fillStyle=hex(t.floor===0xffffff?0x3a3a42:t.floor);x.fillRect(18,190,220,18);
  x.fillStyle="#34271c";x.textAlign="center";
  let fs=32;x.font=`bold ${fs}px Georgia`;
  while(x.measureText(t.name).width>226&&fs>14){fs--;x.font=`bold ${fs}px Georgia`;}
  x.fillText(t.name,128,252);
  let status,col;
  if(save.theme===i){status="✔ Aktiv";col="#2f8f46";}
  else if(save.owned.includes(i)){status="Gehört dir";col="#2f6f9f";}
  else{status="🪙 "+t.price;col="#a06a00";}
  x.fillStyle=col;x.font="bold 40px Georgia";x.fillText(status,128,312);
  x.fillStyle="#7a6648";x.font="20px Georgia";x.fillText(save.owned.includes(i)?"anklicken = wählen":"anklicken = kaufen",128,346);
  return new THREE.CanvasTexture(c);
}
const shopItems=[];
THEMES.forEach((t,i)=>{
  const mat=new THREE.MeshStandardMaterial({map:shopTexture(i),roughness:.9});
  const side=new THREE.MeshStandardMaterial({color:0xe8dcc0,roughness:.9});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.62,.05,.9),[side,side,mat,side,side,side]);
  mesh.position.set(SHOP_X+(i-2)*.72,SHOP_Y+.025,SHOP_Z);
  mesh.rotation.y=Math.PI; // Bild liest sich vom Laufweg aus richtig herum
  mesh.userData={kind:"shop",idx:i,mat};
  scene.add(mesh);shopItems.push(mesh);
});
function refreshShop(){
  shopItems.forEach(m=>{
    const mat=m.userData.mat;if(mat.map)mat.map.dispose();
    mat.map=shopTexture(m.userData.idx);mat.needsUpdate=true;
  });
}
function useShopItem(i){
  const t=THEMES[i];if(!t)return;
  if(mode!=="game"){showToast("Der Shop ist nach dem Tutorial offen.");return;}
  if(save.owned.includes(i)){
    if(save.theme===i){showToast(`„${t.name}“ ist schon aktiv.`);return;}
    save.theme=i;applyTheme(i);persist();refreshShop();showToast(`Design „${t.name}“ ausgewählt.`);
  }else if(save.coins>=t.price){
    save.coins-=t.price;save.owned.push(i);save.theme=i;applyTheme(i);persist();updateCoinHud();refreshShop();
    ding();showToast(`Gekauft: „${t.name}“!`);
  }else{
    wrongSound();showToast(`Zu wenig Coins – „${t.name}“ kostet ${t.price} 🪙 (du hast ${save.coins}).`);
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
const TOTAL_NOTE_COUNT=15;
const NOTE_TYPES=[4,2,1,.5,.25];
const randomNoteValue=()=>NOTE_TYPES[Math.floor(Math.random()*NOTE_TYPES.length)];
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
function chooseDropSpot(){
  // Der Lesetisch bleibt frei, damit das Buch nicht von Steinblöcken verdeckt wird.
  const isBookTableArea=(x,z)=>(Math.abs(x)<2.05&&z>4.0&&z<6.3)||(x>2.0&&x<6.5&&z>4.0&&z<6.3);
  // Häufig fallen neue Steine in die Nähe vorhandener Steine, damit natürliche Stapel entstehen.
  for(let attempt=0;attempt<50;attempt++){
    let x,z;
    if(floorNotes.length&&Math.random()<.38){
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
  m.userData={kind:"note",ref:n};
  {const sp=new THREE.Sprite(labelMat(len));sp.scale.set(.42,.42,1);sp.position.set(0,.42,0);sp.visible=false;sp.raycast=()=>{};m.add(sp);n.label=sp;}
  return n;
}
function activeNoteCount(){return floorNotes.length+tableNotes.length+(held?1:0);}
function ensureFloorNotes(){
  // Es gibt genau 15 aktive Steine insgesamt. Ein gehaltener oder auf dem
  // Tisch liegender Stein wird mitgezählt und daher nicht doppelt ersetzt.
  while(!locked&&activeNoteCount()<TOTAL_NOTE_COUNT){
    const [x,z]=chooseDropSpot();
    floorNotes.push(spawn(randomNoteValue(),x,z,0,true));
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
  if(a){a.textContent=held?"Werfen":"Nehmen";a.classList.toggle("holding",!!held);}
}

function newRound(){
  roundToken++;roundTime=0;
  floorNotes.forEach(n=>{if(n.body)physicsWorld.removeBody(n.body);scene.remove(n.mesh);});
  tableNotes.forEach(n=>{if(n.body)physicsWorld.removeBody(n.body);scene.remove(n.mesh);});
  if(held){cam.remove(held.mesh);held=null}
  floorNotes=[];tableNotes=[];locked=false;
  // Jede der fünf Notenarten wird bei jedem Spawn mit exakt 20 % Chance gewählt.
  for(let i=0;i<TOTAL_NOTE_COUNT;i++){
    const [x,z]=chooseDropSpot();
    floorNotes.push(spawn(randomNoteValue(),x,z,0,true));
  }
  updateFloorCount();layoutTable();showHold();
}

// ---------- Audio ----------
let ac;
function tone(len,when){
  ac=ac||new (window.AudioContext||window.webkitAudioContext)();
  const t=ac.currentTime+when,d=Math.max(.15,len*.45),o=ac.createOscillator(),g=ac.createGain();
  o.type="triangle";o.frequency.value=392;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.3,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+.05);
}
function ding(){ac=ac||new (window.AudioContext||window.webkitAudioContext)();[0,.12].forEach((w,i)=>{
  const t=ac.currentTime+w,o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.value=i?1568:1175;
  g.gain.setValueAtTime(.25,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.55)})}
function wrongSound(){
  try{
    ac=ac||new (window.AudioContext||window.webkitAudioContext)();
    if(ac.state==="suspended")ac.resume();
    const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(125,t+.16);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.035,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+.24);
    o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.26);
  }catch(e){}
}

// ---------- Interaktion ----------
function pickUp(n){
  const wasOnFloor=floorNotes.includes(n);
  const wasOnTable=tableNotes.includes(n);
  if(wasOnFloor)floorNotes=floorNotes.filter(x=>x!==n);
  if(wasOnTable)tableNotes=tableNotes.filter(x=>x!==n);
  if(n.body)physicsWorld.removeBody(n.body);
  scene.remove(n.mesh);n.target=null;held=n;cam.add(n.mesh);
  n.mesh.position.set(.55,-.45,-1.1);n.mesh.rotation.set(1.1,-.3,0);n.mesh.scale.set(.6,.6,.6);handMode(n.mesh,true);
  ensureFloorNotes();showHold();tone(n.len,0);
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
  if(targetKind==="table"&&tableNotes.length>=5){
    msg("Auf dem Tisch sind schon fünf Noten.","bad");
    showFeedback("Auf dem Tisch liegen schon fünf Noten.","bad");
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
  const onHit=ev=>{
    if(ev&&ev.body&&tableWallBodies.includes(ev.body))return; // Abprallen von der Wand nicht bremsen
    body.removeEventListener("collide",onHit);
    body.velocity.x*=.3;body.velocity.z*=.3;body.linearDamping=.16;
    if(targetKind==="table")body.angularVelocity.scale(.2,body.angularVelocity);
  };
  body.addEventListener("collide",onHit);
  n.body=body;n.fall=true;n.target=targetKind==="table"?target.clone():null;
  held=null;
  physicsWorld.addBody(body);
  body.aabbNeedsUpdate=true;body.wakeUp();
  if(targetKind==="table")tableNotes.push(n);else floorNotes.push(n);
  showHold();
  ensureFloorNotes();
  tone(n.len,0);
  msg(targetKind==="table"?"Note auf den Tisch geworfen.":"Note geworfen.");
  return true;
}

function check(){
  if(locked)return;
  if(tableNotes.some(n=>n.fall))return; // erst prüfen, wenn alles ruhig liegt
  const s=tsum();
  if(!tableNotes.length||Math.abs(s-4)>=EPS){
    // Falsch: nur Ton und rotes X über dem Knopf – kein Text oben in der Mitte.
    wrongSound();showWrongCheckX();
    if(mode==="tutorial")tutFlash=3.5;
    return;
  }
  locked=true;ding();
  let p=0;tableNotes.forEach(n=>{tone(n.len,.4+p*.5);p+=n.len});
  const c=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.06,24),new THREE.MeshStandardMaterial({color:0xffd43b,metalness:.6,roughness:.3,emissive:0x664d00}));
  c.rotation.x=Math.PI/2;c.position.set(3.1,TY+.5,TZ);scene.add(c);fx.push({m:c,t:0});
  const token=roundToken;
  if(mode==="tutorial"){
    tutorialCorrect++;
    if(tutorialCorrect>=5){
      save.tutorialDone=true;persist();
      setTimeout(()=>{if(token===roundToken&&mode==="tutorial"){showToast("Tutorial geschafft! Jetzt startet das Spiel.");startGame();}},3600);
    }else setTimeout(()=>{if(token===roundToken)newRound();},3600);
  }else{
    const gain=roundTime<FAST_TIME?2:1;
    save.coins+=gain;persist();updateCoinHud();
    showFeedback(`Richtig! +${gain} 🪙`,"good");
    setTimeout(()=>{if(token===roundToken)newRound();},3600);
  }
}
const rc=new THREE.Raycaster();
const bookBackButton=$("bookBack");
if(bookBackButton)bookBackButton.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();closeBook();});
function interact(cx,cy){
  if(mode==="menu")return;
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
let musicTracks=Array.from({length:5},(_,i)=>({
  name:`${i+1}.mp3`,src:`songs/${i+1}.mp3`,key:`slot-${i+1}`,blob:false
}));
let activeTrack=-1,musicStarted=false,userPaused=false,gapTimer=null,trackAttempt=0;
const failedMusicTracks=new Set();
function chooseRandomTrack(){
  let options=musicTracks.map((_,i)=>i).filter(i=>!failedMusicTracks.has(i)&&i!==activeTrack);
  if(!options.length)options=musicTracks.map((_,i)=>i).filter(i=>!failedMusicTracks.has(i));
  return options.length?options[Math.floor(Math.random()*options.length)]:-1;
}
function startRandomTrack(){
  if(userPaused)return;
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
  const pauseMs=10000+Math.floor(Math.random()*5001); // 10–15 Sekunden Stille
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
music.volume=.32;
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
  if(e.target.closest&&e.target.closest("#touchControls,#bookBack,#menuBtn,#menuScreen,#tutorial"))return;
  if(mode==="menu")return;
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
  if(document.pointerLockElement!==renderer.domElement||bookMode||cameraAnim||mode==="menu")return;
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
    (Math.abs(x)<2.05&&z>4.0&&z<6.3)||
    (x>2.0&&x<6.5&&z>4.0&&z<6.3)||
    PIL.some(p=>Math.hypot(x-p[0],z-p[1])<.8);
  const noteObstacle=floorNotes.some(n=>!n.fall&&(()=>{
    const h=noteHalfExtents(n),top=n.mesh.position.y+h.y;
    const overlaps=Math.abs(x-n.mesh.position.x)<h.x+PLAYER_RADIUS&&Math.abs(z-n.mesh.position.z)<h.z+PLAYER_RADIUS;
    return overlaps&&feetY<top-.035;
  })());
  return roomObstacle||noteObstacle;
}
// ---------- HUD: Coins, Toast, Zeit ----------
function updateCoinHud(){const el=$("coins");if(el)el.textContent="🪙 "+save.coins;}
let toastTimer=null;
function showToast(text){
  const el=$("toast");if(!el)return;
  el.textContent=text;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);
}
let lastTimerText="";
function updateTimerUi(){
  const f=Math.max(0,1-roundTime/ROUND_LIMIT);
  const bar=$("timerBar"),txt=$("timerText");
  if(bar){bar.style.width=(f*100).toFixed(1)+"%";bar.style.background=f>.5?"#ffd43b":f>.2?"#ffa94d":"#ff7b7b";}
  const s=Math.ceil(ROUND_LIMIT-roundTime)+" s";
  if(txt&&s!==lastTimerText){lastTimerText=s;txt.textContent="⏱ "+s;}
}

// ---------- Tutorial ----------
const NOTE_NAMES={4:"Ganze Note",2:"Halbe Note",1:"Viertelnote",.5:"Achtelnote",.25:"Sechzehntelnote"};
const tutMarker=new THREE.Mesh(new THREE.ConeGeometry(.17,.42,14),new THREE.MeshBasicMaterial({color:0xffd43b,depthTest:false,transparent:true,fog:false}));
tutMarker.rotation.x=Math.PI;tutMarker.renderOrder=40;tutMarker.visible=false;scene.add(tutMarker);
function bestHintNote(rem){
  const c=floorNotes.filter(n=>!n.fall&&n.len<=rem+EPS).sort((a,b)=>b.len-a.len);
  return c[0]||null;
}
function tutorialInfo(){
  const info={title:`Tutorial · ${tutorialCorrect}/5 richtig`,text:"",note:null,pos:null};
  const showMarker=tutorialCorrect<3; // Pfeile gibt es nur am Anfang
  if(locked){
    info.text=tutorialCorrect>=5?"Super! Alle 5 Aufgaben geschafft. Gleich startet das richtige Spiel! 🎉":"Richtig! 🎉 Gleich kommt die nächste Aufgabe.";
    return info;
  }
  if(held){
    info.text=`Du hältst eine ${NOTE_NAMES[held.len]} (${fmt(held.len)} ${held.len===1?"Schlag":"Schläge"}). Wirf sie jetzt auf den Tisch: Ziele auf den Tisch und klicke/tippe (Handy: Knopf „Werfen“).`;
    if(showMarker)info.pos=new THREE.Vector3(0,TY+.95,TABLE_NOTE_Z);
    return info;
  }
  if(tableNotes.some(n=>n.fall)){info.text="Die Note rollt noch … einen Moment.";return info;}
  const settled=tableNotes.filter(n=>!n.fall);
  const sum=settled.reduce((s,n)=>s+n.len,0),rem=4-sum;
  if(!settled.length){
    if(floorNotes.every(n=>n.fall)){info.text="Die Steine fallen vom Himmel … gleich geht’s los.";return info;}
    info.text="Aufgabe: Lege Noten auf den Tisch, die zusammen genau 4 Schläge ergeben. Nimm einen Stein auf: Fadenkreuz drauf und klicke/tippe (Handy: Knopf „Nehmen“). Tipp: Eine Ganze Note hat schon 4 Schläge!";
    const fit=bestHintNote(4);if(showMarker&&fit)info.note=fit;
    return info;
  }
  if(rem>EPS){
    info.text=`Auf dem Tisch liegen ${fmt(sum)} Schläge. Es fehlen noch ${fmt(rem)}. Nimm eine passende Note und wirf sie auf den Tisch.`+(NOTE_NAMES[rem]?` Gesucht: eine ${NOTE_NAMES[rem]}.`:"");
    const fit=bestHintNote(rem);if(showMarker&&fit)info.note=fit;
    return info;
  }
  if(Math.abs(rem)<EPS){
    info.text="Genau 4 Schläge! Drücke jetzt den roten PRÜFEN-Knopf auf dem Tisch (klicken/tippen).";
    if(showMarker||true)info.pos=new THREE.Vector3(checkButton.position.x,TY+.8,checkButton.position.z);
    return info;
  }
  info.text=`Das sind ${fmt(sum)} Schläge – zu viel. Klicke eine Note auf dem Tisch an, um sie wieder aufzunehmen, und tausche sie aus.`;
  const big=settled.slice().sort((a,b)=>b.len-a.len)[0];if(showMarker&&big)info.note=big;
  return info;
}
let lastTutHtml="";
function updateTutorialUI(now,dt){
  const panel=$("tutorial");
  if(mode!=="tutorial"){tutMarker.visible=false;return;}
  if(tutFlash>0)tutFlash-=dt;
  const info=tutorialInfo(),bad=tutFlash>0;
  const html=`<div class="tutTitle">${info.title}</div><div class="tutText">${bad?"<b>Noch nicht richtig.</b> ":""}${info.text}</div><div class="tutCheat">Ganze 4 · Halbe 2 · Viertel 1 · Achtel ½ · Sechzehntel ¼</div>`;
  if(panel&&html!==lastTutHtml){lastTutHtml=html;panel.innerHTML=html;}
  if(panel)panel.classList.toggle("bad",bad);
  let pos=null;
  if(info.note&&info.note.mesh)pos=info.note.mesh.position.clone().add(new THREE.Vector3(0,.8,0));
  else if(info.pos)pos=info.pos.clone();
  tutMarker.visible=!!pos&&!bookMode;
  if(pos){tutMarker.position.copy(pos);tutMarker.position.y+=Math.sin(now/180)*.08;}
}

function gameTick(now,dt){
  // Wert-Schilder nur im Tutorial
  const showL=mode==="tutorial";
  for(const n of floorNotes)if(n.label)n.label.visible=showL;
  for(const n of tableNotes)if(n.label)n.label.visible=showL;
  if(held&&held.label)held.label.visible=false;
  // ruhiger Zeitdruck nur im Spiel
  if(mode==="game"){
    if(!locked&&!bookMode&&!cameraAnim){
      roundTime+=dt;
      if(roundTime>=ROUND_LIMIT){showToast("Zeit abgelaufen – neue Runde!");newRound();}
    }
    updateTimerUi();
  }
  updateTutorialUI(now,dt);
}

// ---------- Hauptmenü ----------
function resetView(){P.set(0,0,-1);playerVy=0;yaw=0;pitch=-.35;}
function setMode(m){
  mode=m;
  document.body.classList.remove("mode-menu","mode-tutorial","mode-game");
  document.body.classList.add("mode-"+m);
  if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
  tutMarker.visible=false;
  if(m==="menu"){
    resetJoystick();for(const k in key)key[k]=0;
    if(bookMode)closeBook();
    const info=$("menuInfo");
    if(info)info.textContent=save.tutorialDone?`🪙 ${save.coins} Coins · Raum: ${THEMES[save.theme].name}`:"Beim ersten Mal startet das Tutorial (5 Aufgaben).";
  }
}
function startTutorial(){tutorialCorrect=0;tutFlash=0;lastTutHtml="";resetView();setMode("tutorial");newRound();}
function startGame(){resetView();setMode("game");newRound();updateCoinHud();}
$("btnPlay").addEventListener("click",()=>{if(!save.tutorialDone)startTutorial();else startGame();});
$("btnTutorial").addEventListener("click",startTutorial);
$("menuBtn").addEventListener("click",()=>setMode("menu"));

(function loop(now){requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000);last=now;
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
    if(!blocked(cx,P.z,P.y))P.x=cx;if(!blocked(P.x,cz,P.y))P.z=cz;
    const supportY=blockTopAt(P.x,P.z);
    if(P.y<=supportY&&playerVy<=0){P.y=supportY;playerVy=0;grounded=true;}else grounded=false;
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
  
  physicsWorld.step(1/60,dt,5);
  syncPhysicsNotes();
  for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=dt;f.m.position.y+=dt*1.2;f.m.rotation.z+=dt*9;if(f.t>1.6){scene.remove(f.m);fx.splice(i,1)}}
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

resize();newRound();applyTheme(save.theme);updateCoinHud();setMode("menu");
