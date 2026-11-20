// Alle Texte des Spiels auf Deutsch und Englisch.
// {name} wird durch Werte ersetzt, z. B. t("bought",{room:"Wald"}).
window.I18N=(function(){
const TEXT={
de:{
  sub:"Lege Noten auf den Tisch – zusammen genau 4 Schläge!",
  continue:"Weiterspielen",newGame:"Neues Spiel",storyBtn:"Geschichte",tutorial:"Tutorial",
  language:"Sprache",voice:"Stimme",fullscreen:"Vollbild",on:"an",off:"aus",music:"Musik",sounds:"Soundeffekte",afkVideos:"Videos bei AFK",loud:"laut",quiet:"leise",
  menuInfoSave:"{coins} Coins · Raum: {room}",menuInfoNew:"Starte ein neues Spiel!",
  confirmNew:"Neues Spiel starten? Dein Spielstand ({coins} Coins und gekaufte Räume) wird gelöscht.",
  yes:"Ja, neu starten",no:"Abbrechen",
  chooseTitle:"Wie möchtest du starten?",watchStory:"Geschichte ansehen",playNow:"Gleich selbst spielen",
  menu:"☰ Menü",back:"← Zurück",skip:"Überspringen ›",tapNext:"Tippen = weiter",take:"Nehmen",throw:"Werfen",
  credits:"Code: ChatGPT & Claude · Musik: Gemini · 3D-Modelle: Blender<br>Sounds: Kenney (kenney.nl), CC0<br>Tewe444 · Waldorfschule Rostock",
  tutDoneTitle:"Tutorial geschafft!",tutDoneText:"Super gemacht! Jetzt spielst du richtig. Für jede Lösung gibt es Coins – damit kannst du neue Räume kaufen.",tutDoneBtn:"Weiter zum Spiel ▶",
  tableFull:"Auf dem Tisch ist kein Platz mehr.",shopLocked:"Die Räume kannst du nach dem Tutorial kaufen.",
  alreadyActive:"„{room}“ ist schon aktiv.",selected:"Raum „{room}“ ausgewählt.",bought:"Gekauft: „{room}“!",
  tooPoor:"Zu wenig Coins – „{room}“ kostet {price} 🪙 (du hast {coins}).",
  shopActive:"✔ Aktiv",shopSelect:"Wählen",shopFree:"Gratis",shopSign:"Räume",
  oneBlock:"so einen Block",manyBlocks:"solche Blöcke",and:" und ",
  tutTake:"Nimm dir {icons} und lege {pron} auf den Tisch.",pronOne:"ihn",pronMany:"sie",
  tutThrow:"Gut! Jetzt wirf ihn auf den Tisch.",tutWrongHeld:"Der passt nicht. Wirf ihn auf den Boden und nimm einen anderen.",
  tutWait:"Einen Moment …",tutExtra:"Der Block hier gehört nicht dazu. Nimm ihn wieder vom Tisch.",
  tutCheck:"Jetzt drück auf <b>PRÜFEN</b>.",tutSuper:"Super! 🎉",
  tutHelpDesktop:"Klick = Block nehmen · auf den Tisch zielen + Klick = ablegen",
  tutHelpTouch:"Knopf „Nehmen“ = Block nehmen · auf den Tisch zielen + „Werfen“",
  checkLabel:"PRÜFEN",
  rooms:["Mondruine","Sonnenuntergang","Eiswelt","Wald","Neon-Disco","Unterwasser"],
  story:[
    "Es war einmal ein Mond …",
    "Er war so sauber und blank geputzt, dass er glänzte wie ein Spiegel.",
    "Er warf das Sonnenlicht zurück – heller und heller und immer heller …",
    "So hell, dass die Erde es nicht mehr aushalten konnte.",
    "KRACH! Die Erde zerbrach in tausend Teile.",
    "Und du? Du bist mitgefallen. Tief, tief hinunter …",
    "Du wachst in einer alten Ruine auf. Überall liegen Steine mit Noten.",
    "Lege die richtigen Noten zusammen – vielleicht kannst du so die Welt wieder heil machen."
  ],
  noteRows:[["Ganze Note","4 Schläge"],["Halbe Note","2 Schläge"],["Viertelnote","1 Schlag"],["Achtelnote","½ Schlag"],["Sechzehntelnote","¼ Schlag"]],
  bookHint:"Zum Blättern auf die linke oder rechte Seite klicken",
  book:[
    {title:"Das Spiel",text:"Der Mond hat die Erde in tausend Teile zerstrahlt. Jetzt liegen überall Notensteine herum – immer genau 30.\n\nNimm Noten auf und wirf sie auf den Tisch. Zusammen sollen sie genau vier Schläge ergeben. Danach drückst du den roten PRÜFEN-Knopf."},
    {title:"Die Notenwerte",text:""},
    {title:"So spielst du",text:"Wirf bis zu fünf Noten auf den Tisch. Liegen sie ruhig, zählen sie.\n\nZu wenig oder zu viel? Klicke eine Note auf dem Tisch an, nimm sie wieder auf und tausche sie aus."},
    {title:"So prüfst du",text:"1. Lege Noten auf den Tisch.\n2. Zähle die Schläge zusammen.\n3. Genau 4? Dann drücke den roten PRÜFEN-Knopf.\n\nRichtig = über dem Knopf fliegt eine Münze hoch. Die Noten auf dem Tisch verschwinden und neue Steine fallen vom Himmel. Falsch = ein rotes X erscheint über dem Knopf."},
    {title:"Steuerung",text:"PC: W, A, S, D laufen · Maus umschauen · Leertaste springen. Klick: Stein nehmen oder werfen. Rechtsklick oder E: nach vorne werfen.\n\nHandy: Joystick links laufen (ganz nach vorne = rennen) · Pfeil springen · Bildschirm ziehen = umschauen · Knopf „Nehmen/Werfen“ oder Tippen."},
    {title:"Coins",text:"Es gibt keinen Zeitdruck. Lass dir Zeit!\n\nFür jede richtige Lösung bekommst du so viele Coins, wie Noten auf dem Tisch liegen. Im Tutorial gibt es noch keine Coins. Sechzehntel sind am häufigsten, Ganze Noten sehr selten."},
    {title:"Der Shop",text:"Neben dem Buch steht der Shop. Dort stehen kleine 3D-Figuren – jede ist ein Raum.\n\nZiele auf eine Figur und klicke/tippe: Mit genug Coins kaufst du den Raum. Die Räume sind teuer – spare gut! Gekaufte Räume kannst du jederzeit wieder auswählen."},
    {title:"Credits",credits:true}
  ],
  bookCredits:[["Code: ChatGPT & Claude",40],["Musik: Gemini",40],["3D-Modelle: Blender",40],["Sounds: Kenney · kenney.nl",36],["(Lizenz CC0, frei nutzbar)",28]]
},
en:{
  sub:"Put notes on the table – exactly 4 beats in total!",
  continue:"Continue",newGame:"New game",storyBtn:"Story",tutorial:"Tutorial",
  language:"Language",voice:"Voice",fullscreen:"Fullscreen",on:"on",off:"off",music:"Music",sounds:"Sound effects",afkVideos:"AFK videos",loud:"loud",quiet:"quiet",
  menuInfoSave:"{coins} coins · Room: {room}",menuInfoNew:"Start a new game!",
  confirmNew:"Start a new game? Your progress ({coins} coins and bought rooms) will be deleted.",
  yes:"Yes, start over",no:"Cancel",
  chooseTitle:"How do you want to start?",watchStory:"Watch the story",playNow:"Play right away",
  menu:"☰ Menu",back:"← Back",skip:"Skip ›",tapNext:"Tap = next",take:"Take",throw:"Throw",
  credits:"Code: ChatGPT & Claude · Music: Gemini · 3D models: Blender<br>Sounds: Kenney (kenney.nl), CC0<br>Tewe444 · Waldorfschule Rostock",
  tutDoneTitle:"Tutorial complete!",tutDoneText:"Well done! Now you play for real. Every solution earns coins – use them to buy new rooms.",tutDoneBtn:"Continue to the game ▶",
  tableFull:"There is no more room on the table.",shopLocked:"You can buy rooms after the tutorial.",
  alreadyActive:"“{room}” is already active.",selected:"Room “{room}” selected.",bought:"Bought: “{room}”!",
  tooPoor:"Not enough coins – “{room}” costs {price} 🪙 (you have {coins}).",
  shopActive:"✔ Active",shopSelect:"Select",shopFree:"Free",shopSign:"Rooms",
  oneBlock:"this block",manyBlocks:"these blocks",and:" and ",
  tutTake:"Take {icons} and put {pron} on the table.",pronOne:"it",pronMany:"them",
  tutThrow:"Good! Now throw it onto the table.",tutWrongHeld:"That one doesn't fit. Throw it on the floor and take another one.",
  tutWait:"One moment …",tutExtra:"This block doesn't belong here. Take it off the table again.",
  tutCheck:"Now press <b>CHECK</b>.",tutSuper:"Great! 🎉",
  tutHelpDesktop:"Click = take a block · aim at the table + click = put it down",
  tutHelpTouch:"“Take” button = take a block · aim at the table + “Throw”",
  checkLabel:"CHECK",
  rooms:["Moon Ruin","Sunset","Ice World","Forest","Neon Disco","Underwater"],
  story:[
    "Once upon a time there was a moon …",
    "It was so clean and polished that it shone like a mirror.",
    "It reflected the sunlight – brighter and brighter and ever brighter …",
    "So bright that the Earth could not bear it any longer.",
    "CRACK! The Earth broke into a thousand pieces.",
    "And you? You fell too. Deep, deep down …",
    "You wake up in an old ruin. Stones with notes are lying everywhere.",
    "Put the right notes together – maybe that way you can make the world whole again."
  ],
  noteRows:[["Whole note","4 beats"],["Half note","2 beats"],["Quarter note","1 beat"],["Eighth note","½ beat"],["Sixteenth note","¼ beat"]],
  bookHint:"Click the left or right page to turn it",
  book:[
    {title:"The Game",text:"The moon shattered the Earth into a thousand pieces. Now note stones lie everywhere – always exactly 30.\n\nPick up notes and throw them onto the table. Together they must make exactly four beats. Then press the red CHECK button."},
    {title:"Note Values",text:""},
    {title:"How to Play",text:"Throw up to five notes onto the table. Once they lie still, they count.\n\nToo few or too many? Click a note on the table, pick it up again and swap it."},
    {title:"How to Check",text:"1. Put notes on the table.\n2. Add up the beats.\n3. Exactly 4? Then press the red CHECK button.\n\nCorrect = a coin flies up above the button. The notes on the table disappear and new stones fall from the sky. Wrong = a red X appears above the button."},
    {title:"Controls",text:"PC: W, A, S, D to walk · mouse to look · space to jump. Click: take or throw a stone. Right click or E: throw forward.\n\nPhone: joystick on the left to walk (all the way forward = run) · arrow to jump · drag the screen to look · “Take/Throw” button or tap."},
    {title:"Coins",text:"There is no time pressure. Take your time!\n\nEvery correct solution gives you as many coins as there are notes on the table. The tutorial gives no coins yet. Sixteenth notes are the most common, whole notes are very rare."},
    {title:"The Shop",text:"Next to the book is the shop. Small 3D figures stand there – each one is a room.\n\nAim at a figure and click/tap: with enough coins you buy the room. Rooms are expensive – save up! You can switch back to rooms you bought at any time."},
    {title:"Credits",credits:true}
  ],
  bookCredits:[["Code: ChatGPT & Claude",40],["Music: Gemini",40],["3D models: Blender",40],["Sounds: Kenney · kenney.nl",36],["(CC0 license, free to use)",28]]
}};
const api={
  lang:"de",
  set(l){api.lang=TEXT[l]?l:"de";document.documentElement.lang=api.lang;},
  get(key){const v=TEXT[api.lang][key];return v===undefined?TEXT.de[key]:v;},
  t(key,vars){let s=api.get(key);if(typeof s!=="string")return s;if(vars)for(const k in vars)s=s.split("{"+k+"}").join(vars[k]);return s;}
};
return api;
})();
