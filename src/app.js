(function(){
"use strict";
var KEY='asca_budget_v5';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* ── Defaults ─────────────────────────────────────────────── */
function defaults(){
  return {
    income:{blocked:0,salary:0},
    cycleDay:25,
    cycleDays:{},
    startSavings:0,
    goal:{start:shiftP(periodOf(todayISO()),1),months:4},
    cats:[
      {id:'rent',name:'Rent',budget:0,kind:'fixed',color:'#7C93FF',hard:false},
      {id:'insurance',name:'Insurance',budget:0,kind:'fixed',color:'#B98CFF',hard:false},
      {id:'groceries',name:'Groceries',budget:120,kind:'var',color:'#63D69A',hard:true},
      {id:'personal',name:'Supplements & Care',budget:60,kind:'var',color:'#E8C77A',hard:true},
      {id:'grooming',name:'Grooming',budget:43,kind:'var',color:'#E080B0',hard:false},
      {id:'gym',name:'Gym',budget:26,kind:'fixed',color:'#E97365',hard:false},
      {id:'mobile',name:'Mobile',budget:15,kind:'fixed',color:'#4FC8D6',hard:false},
      {id:'radio',name:'Radio tax',budget:0,kind:'fixed',color:'#8FA093',hard:false},
      {id:'other',name:'Household & extras',budget:25,kind:'var',color:'#B0895C',hard:false}
    ],
    items:[
      {id:'i1',name:'Chicken thighs 2.5kg',cat:'groceries',price:12,plan:2},
      {id:'i2',name:'Eggs (tray)',cat:'groceries',price:2.5,plan:4},
      {id:'i3',name:'Milk (carton)',cat:'groceries',price:0.89,plan:12},
      {id:'i4',name:'Oats',cat:'groceries',price:2.5,plan:1},
      {id:'i5',name:'Bread',cat:'groceries',price:1.3,plan:3},
      {id:'i6',name:'Bananas',cat:'groceries',price:1.5,plan:3},
      {id:'i7',name:'Yogurt',cat:'groceries',price:1,plan:4},
      {id:'i8',name:'Rice, oil & spices',cat:'groceries',price:30,plan:1},
      {id:'i9',name:'Pasta',cat:'groceries',price:1,plan:2},
      {id:'i10',name:'Coffee',cat:'groceries',price:4.5,plan:1},
      {id:'i11',name:'Peanut butter',cat:'groceries',price:3,plan:0.5},
      {id:'i12',name:'Misc food',cat:'groceries',price:8,plan:1},
      {id:'i13',name:'Supplements',cat:'personal',price:35,plan:1},
      {id:'i14',name:'Facewash',cat:'personal',price:7,plan:1},
      {id:'i15',name:'Retinol',cat:'personal',price:8,plan:0.5},
      {id:'i16',name:'Face cream',cat:'personal',price:7,plan:0.5},
      {id:'i17',name:'Shampoo (good)',cat:'personal',price:7,plan:0.5},
      {id:'i18',name:'Conditioner',cat:'personal',price:7,plan:0.5},
      {id:'i19',name:'Toothpaste',cat:'personal',price:3,plan:0.5},
      {id:'i20',name:'Body wash',cat:'personal',price:4,plan:0.5},
      {id:'i21',name:'Deodorant',cat:'personal',price:3,plan:0.5},
      {id:'i22',name:'Household (detergent, soap)',cat:'other',price:8,plan:1},
      {id:'i23',name:'Toilet paper',cat:'other',price:4,plan:1},
      {id:'i24',name:'Eating out / takeaway',cat:'other',price:8,plan:1},
      {id:'i25',name:'Subscription (Spotify etc)',cat:'other',price:6,plan:1},
      {id:'i26',name:'Printing / stationery',cat:'other',price:3,plan:0.5}
    ],
    recurring:[
      {id:'r_rent',name:'Rent',cat:'rent',amount:0,covers:1,unit:'months',n:1,next:'2026-08-05'},
      {id:'r_ins',name:'Insurance',cat:'insurance',amount:0,covers:1,unit:'months',n:1,next:'2026-08-16'},
      {id:'r_gym',name:'Gym (3-month pass)',cat:'gym',amount:78,covers:3,unit:'months',n:3,next:'2026-08-13'},
      {id:'r_hair',name:'Haircut',cat:'grooming',amount:28,covers:1,unit:'days',n:20,next:'2026-08-05'}
    ],
    loans:[],
    exp:[]
  };
}

/* ── State ────────────────────────────────────────────────── */
var S, curP, pinKey=null;
var sheetCat=null, sheetItem=null, sheetUnit=0, lastLogged=null, pendingConfirm=null, editingId=null, envFilter=null;

/* ── Lock / encryption (PIN-gated, RC4 stream + salt) ─────── */
var LOCKKEY='asca_budget_lock';
function hashStr(s){var h=5381,i=s.length;while(i)h=(h*33^s.charCodeAt(--i))>>>0;return h.toString(36);}
function rc4(key,input){
  var s=[],j=0,x,res=[],i;
  for(i=0;i<256;i++)s[i]=i;
  for(i=0;i<256;i++){j=(j+s[i]+key.charCodeAt(i%key.length))&255;x=s[i];s[i]=s[j];s[j]=x;}
  i=0;j=0;
  for(var y=0;y<input.length;y++){i=(i+1)&255;j=(j+s[i])&255;x=s[i];s[i]=s[j];s[j]=x;res.push(String.fromCharCode(input.charCodeAt(y)^s[(s[i]+s[j])&255]));}
  return res.join('');
}
function lockCfg(){try{return JSON.parse(localStorage.getItem(LOCKKEY));}catch(e){return null;}}
function setLockCfg(pin){var salt=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(LOCKKEY,JSON.stringify({salt:salt,hash:hashStr(pin+'|'+salt)}));}
function keyOf(pin){var c=lockCfg();return pin+':'+(c?c.salt:'')+':vault';}
function enc(str,pin){return btoa(rc4(keyOf(pin),unescape(encodeURIComponent(str))));}
function dec(b64,pin){return decodeURIComponent(escape(rc4(keyOf(pin),atob(b64))));}

function load(){
  var raw=localStorage.getItem(KEY);if(!raw)return defaults();
  if(pinKey){try{var d=JSON.parse(dec(raw,pinKey));if(d&&d.cats)return d;}catch(e){}}
  try{var d2=JSON.parse(raw);if(d2&&d2.cats)return d2;}catch(e){} // plain-text migration
  return defaults();
}
function save(){var json=JSON.stringify(S);localStorage.setItem(KEY,pinKey?enc(json,pinKey):json);fbTouch();}

/* App-side sync glue: push (debounced) after every save, pull + merge
   on unlock and sign-in — mirroring the gym app's fbPush/fbRestore. */
var FBMETA='asca_budget_fb_meta'; // {ts: last successful push, edit: last local edit}
var fbTimer=null,fbReady=false;   // fbReady gates pushes until the boot pull settles
var hadLocal=!!localStorage.getItem(KEY); // captured before initApp persists defaults
function fbMeta(){try{return JSON.parse(localStorage.getItem(FBMETA))||{};}catch(e){return {};}}
function setFbMeta(m){try{localStorage.setItem(FBMETA,JSON.stringify(m));}catch(e){}}
function fbStatus(msg,isErr){var el=$('#fb-stat');if(el){el.textContent=msg;el.style.color=isErr?'var(--coral)':'';}}
function fbTouch(){
  if(!FB.user())return;
  var m=fbMeta();m.edit=Date.now();setFbMeta(m);
  if(!fbReady)return; // boot pull still in flight — it pushes when it settles
  clearTimeout(fbTimer);
  fbTimer=setTimeout(fbPushNow,1200);
}
function fbPushNow(){
  if(!FB.user())return;
  fbStatus('Syncing…');
  // A push PUT-replaces the whole node, so never push blind: if the cloud
  // holds a write we haven't seen (another device, the maintainer CLI),
  // pull + merge first — the merged doc then pushes itself back.
  FB.readTs().then(function(cloudTs){
    if(cloudTs>(fbMeta().ts||0)){fbReady=false;fbRestoreFlow();return;}
    var ts=Date.now();
    return FB.push(S,ts).then(function(){
      var m=fbMeta();m.ts=ts;setFbMeta(m);
      fbStatus('Synced ✓');
    });
  }).catch(function(e){fbStatus('Sync failed — '+e.message,true);});
}
/* Tombstones: a union merge alone can never propagate a deletion — the
   other side still holds the record, so it comes straight back. Deleting
   records the id in S.del {id: whenDeleted}; the merge drops any id either
   side has buried, and undo resurrects by clearing the tombstone. Entries
   are pruned after TOMB_TTL so the map can't grow forever. */
var TOMB_TTL=120*864e5; // 120 days — far longer than any device stays offline
function tombstone(id){if(!S.del)S.del={};S.del[id]=Date.now();}
function untombstone(id){if(S.del)delete S.del[id];}
function pruneTombs(m){
  var out={},cut=Date.now()-TOMB_TTL;
  Object.keys(m||{}).forEach(function(k){if(+m[k]>cut)out[k]=+m[k];});
  return out;
}
function unionById(a,b,dead){ // union of two record lists; `a` wins on id conflicts
  var out=[],seen={};
  (a||[]).forEach(function(x){if(x&&x.id&&!seen[x.id]&&!(dead&&dead[x.id])){seen[x.id]=1;out.push(x);}});
  (b||[]).forEach(function(x){if(x&&x.id&&!seen[x.id]&&!(dead&&dead[x.id])){seen[x.id]=1;out.push(x);}});
  return out;
}
// Merge cloud + local: settings come from whichever side edited last,
// record lists are unioned by id (newer side wins on conflicts) so no
// device's entries are lost — except ids either side has tombstoned,
// which is how a deletion travels between devices at all.
function fbMergeStates(loc,cld,cldTs){
  var localNewer=(fbMeta().edit||0)>cldTs;
  var base=localNewer?loc:cld, other=localNewer?cld:loc;
  var dead=pruneTombs({...(cld.del||{}),...(loc.del||{})});
  return {
    income:base.income,cycleDay:base.cycleDay,cycleDays:base.cycleDays,
    startSavings:base.startSavings,goal:base.goal,
    del:dead,
    cats:unionById(base.cats,other.cats),
    items:unionById(base.items,other.items),
    recurring:unionById(base.recurring,other.recurring),
    loans:unionById(base.loans,other.loans,dead),
    exp:unionById(base.exp,other.exp,dead)
  };
}
function fbRestoreFlow(){
  fbStatus('Syncing…');
  FB.pull().then(function(cloud){
    var meta=fbMeta();
    if(cloud&&cloud.state&&cloud.ts>(meta.ts||0)){
      // Cloud holds a push from another device (or another session)
      S=hadLocal?fbMergeStates(S,cloud.state,cloud.ts):cloud.state;
      if(!S.cycleDays)S.cycleDays={};
      if(!S.loans)S.loans=[];
      hadLocal=true;
      meta.ts=cloud.ts;setFbMeta(meta);
      fbReady=true;
      save(); // persists locally + queues the merged doc back to the cloud
      curP=periodOf(todayISO());renderAll();
      fbStatus('Synced from cloud ✓');
    }else{
      // No cloud doc yet, or the cloud just holds our own last push
      fbReady=true;
      fbPushNow();
    }
  },function(e){
    fbReady=true;
    fbStatus('Sync failed — '+e.message,true);
  });
}
function fbBoot(){
  renderFbCard();
  if(!FB.user()){fbReady=true;return;}
  FB.restore().then(function(u){
    if(u==='offline'){fbReady=true;fbStatus('Offline — using data on this device',true);return;}
    if(!u){fbReady=true;renderFbCard();fbStatus('Session expired — sign in again',true);return;}
    fbRestoreFlow();
  },function(){fbReady=true;});
}
function renderFbCard(){
  var out=$('#fb-out'),inn=$('#fb-in');
  if(!out||!inn)return;
  var u=FB.user();
  out.style.display=u?'none':'';
  inn.style.display=u?'':'none';
  if(u)$('#fb-who').innerHTML='Signed in as <b>@'+esc(u.username)+'</b> · cloud node <span class="num">budget/'+esc(FB.nodeId())+'</span>';
}
function fbAuth(mode){
  var u=$('#fb-user').value.trim(),p=$('#fb-pass').value;
  if(!u||!p){fbStatus('Enter a username and password first',true);return;}
  fbStatus(mode==='up'?'Creating account…':'Signing in…');
  var call;
  try{call=mode==='up'?FB.signUp(u,p):FB.signIn(u,p);}
  catch(e){fbStatus(e.message,true);return;}
  call.then(function(){
    $('#fb-pass').value='';
    renderFbCard();
    fbReady=false;
    fbRestoreFlow();
  },function(e){fbStatus(e.message,true);});
}
$('#fb-signin').onclick=function(){fbAuth('in');};
$('#fb-signup').onclick=function(){fbAuth('up');};
$('#fb-pass').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();fbAuth('in');}});
$('#fb-signout').onclick=function(){FB.signOut();renderFbCard();fbStatus('Signed out — data stays on this device.');};
$('#fb-sync').onclick=function(){fbReady=false;fbRestoreFlow();};
// Hard fetch: take the cloud's copy wholesale, no merge — for when this
// device's local state differs and the cloud is the one you trust.
$('#fb-fetch').onclick=function(){
  if(!FB.user()){fbStatus('Sign in first',true);return;}
  fbStatus('Fetching cloud copy…');
  FB.pull().then(function(cloud){
    if(!cloud||!cloud.state){fbStatus('No cloud data yet',true);return;}
    S=cloud.state;
    if(!S.cycleDays)S.cycleDays={};
    if(!S.loans)S.loans=[];
    hadLocal=true;
    fbReady=true;
    save();
    clearTimeout(fbTimer); // nothing to push back — we ARE the cloud copy now
    var m=fbMeta();m.ts=cloud.ts;m.edit=0;setFbMeta(m);
    curP=periodOf(todayISO());renderAll();
    fbStatus('Cloud copy loaded — this device now matches the cloud ✓');
  },function(e){fbStatus('Fetch failed — '+e.message,true);});
};
// Full ruleset for the SHARED asca-gym database — the gym app's rules
// plus the budget/ section. Publishing this replaces the whole rules
// document, so it must always carry every node both apps use.
$('#fb-rules').onclick=function(){
  var rules=JSON.stringify({
    rules: {
      // Any signed-in member can read (Strava-style); only the owner
      // (uid) may write, and the payload is validated + size-capped so
      // a hostile client can't store malformed or oversized data.
      gym: {
        $userId: {
          ".read": "auth != null",
          ".write": "auth != null && (data.exists() ? data.child('uid').val() === auth.uid : newData.child('uid').val() === auth.uid)",
          ".validate": "newData.hasChildren(['uid','ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber()",
          name: {
            ".validate": "newData.isString() && newData.val().length <= 60"
          },
          bio: {
            ".validate": "newData.isString() && newData.val().length <= 120"
          },
          github: {
            ".validate": "newData.isString() && newData.val().length <= 40"
          },
          avatar: {
            ".validate": "newData.isString() && newData.val().length <= 200000"
          },
          bw: {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 700"
          }
        }
      },
      // Writable by the node's owner: self-uid stamp (atomic writes) or
      // the matching gym node's uid (legacy path). Fields are validated.
      directory: {
        ".read": "auth != null",
        $userId: {
          ".write": "auth != null && (newData.child('uid').val() === auth.uid || root.child('gym').child($userId).child('uid').val() === auth.uid)",
          uid: {
            ".validate": "newData.val() === auth.uid"
          },
          name: {
            ".validate": "newData.isString() && newData.val().length <= 60"
          },
          bio: {
            ".validate": "newData.isString() && newData.val().length <= 120"
          },
          avatar: {
            ".validate": "newData.isString() && newData.val().length <= 200000"
          },
          bw: {
            ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 700"
          },
          ts: {
            ".validate": "newData.isNumber()"
          }
        }
      },
      kudos: {
        ".read": "auth != null",
        $ownerId: {
          $date: {
            $likerUid: {
              ".write": "auth != null && auth.uid === $likerUid",
              ".validate": "newData.val() === true"
            }
          }
        }
      },
      comments: {
        ".read": "auth != null",
        $ownerId: {
          $date: {
            $commentId: {
              ".write": "auth != null && (!data.exists() ? newData.child('uid').val() === auth.uid : data.child('uid').val() === auth.uid)",
              ".validate": "newData.hasChildren(['uid','text','ts']) && newData.child('uid').val() === auth.uid && newData.child('text').isString() && newData.child('text').val().length <= 300 && newData.child('ts').isNumber()"
            }
          }
        }
      },
      // Progress pics stored as base64 JPEG (`img`) directly in RTDB —
      // no Cloud Storage / billing. Any member can read; only the owner
      // of that username's gym node may write/delete, the record must
      // stamp their own uid, and `img` is size-capped (~900KB).
      progress: {
        ".read": "auth != null",
        $ownerId: {
          $picId: {
            ".write": "auth != null && root.child('gym').child($ownerId).child('uid').val() === auth.uid && (!newData.exists() || newData.child('uid').val() === auth.uid)",
            ".validate": "!newData.exists() || (newData.hasChildren(['uid','img','ts']) && newData.child('uid').val() === auth.uid && newData.child('img').isString() && newData.child('img').val().length <= 900000 && newData.child('ts').isNumber())"
          }
        }
      },
      // Asca Budget app (separate site, same accounts): one private
      // doc per user at budget/{userId}. Unlike gym data budgets are
      // NOT social — only the owning account may read its node (a
      // missing node stays readable so first sync can see it's empty).
      budget: {
        $userId: {
          ".read": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)",
          ".write": "auth != null && (data.exists() ? data.child('uid').val() === auth.uid : newData.child('uid').val() === auth.uid)",
          ".validate": "newData.hasChildren(['uid','ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber()",
          name: {
            ".validate": "newData.isString() && newData.val().length <= 60"
          }
        }
      },
      // Winter Arc private season state: goals, daily check-ins, xp/level,
      // streak, badges. Owner-read-only — sleep/protein/water/steps never
      // leave this node, which is what makes the social surfaces safe.
      arc: {
        $userId: {
          ".read": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)",
          ".write": "auth != null && (data.exists() ? data.child('uid').val() === auth.uid : newData.child('uid').val() === auth.uid)",
          $seasonId: {
            ".validate": "newData.hasChildren(['uid','ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber()"
          }
        }
      },
      // The narrow social projection of arc/: xp, level, streak, badge
      // count. Member-readable like directory/. NEVER sleep, protein,
      // water, steps or body weight — those stay in arc/ only.
      arcPublic: {
        ".read": "auth != null",
        $userId: {
          ".write": "auth != null && (newData.child('uid').val() === auth.uid || root.child('gym').child($userId).child('uid').val() === auth.uid)",
          $seasonId: {
            uid: {
              ".validate": "newData.val() === auth.uid"
            },
            ts: {
              ".validate": "newData.isNumber()"
            }
          }
        }
      },
      // Challenge definitions (built-in or friend-created). Any member
      // may read; only the creator may write, checked both on create
      // (no existing owner yet) and on every subsequent edit.
      challenges: {
        ".read": "auth != null",
        $cid: {
          ".write": "auth != null && (!data.exists() ? newData.child('ownerUid').val() === auth.uid : data.child('ownerUid').val() === auth.uid)",
          ".validate": "newData.hasChildren(['ownerUid','ts']) && newData.child('ts').isNumber()",
          name: {
            ".validate": "newData.isString() && newData.val().length <= 60"
          },
          desc: {
            ".validate": "newData.isString() && newData.val().length <= 200"
          }
        }
      },
      // Sibling of challenges/, not a child — a member can write ONLY
      // their own progress here with no write access to the definition.
      // The owner may also write, to remove a member.
      challengeMembers: {
        ".read": "auth != null",
        $cid: {
          $userId: {
            ".write": "auth != null && (root.child('gym').child($userId).child('uid').val() === auth.uid || root.child('challenges').child($cid).child('ownerUid').val() === auth.uid)",
            ".validate": "!newData.exists() || (newData.hasChildren(['uid','ts']) && newData.child('ts').isNumber())"
          }
        }
      },
      // The sender creates an invite; the recipient can read + delete
      // their own inbox (accept = join elsewhere + delete; decline =
      // delete). Mirrors the gym-node-owner trick used by directory/.
      invites: {
        $inviteeId: {
          ".read": "auth != null && root.child('gym').child($inviteeId).child('uid').val() === auth.uid",
          $cid: {
            ".write": "auth != null && (newData.child('fromUid').val() === auth.uid || root.child('gym').child($inviteeId).child('uid').val() === auth.uid)",
            ".validate": "!newData.exists() || (newData.hasChildren(['fromUid','ts']) && newData.child('fromUid').val() === auth.uid && newData.child('ts').isNumber())"
          }
        }
      }
    }
  },null,2);
  navigator.clipboard.writeText(rules).then(function(){showToast('Database rules copied — publish in the Firebase console');},function(){showToast('Failed to copy');});
};

function initApp(){
  S=load();
  if(!S.cycleDays)S.cycleDays={};
  if(!S.loans)S.loans=[];
  S.del=pruneTombs(S.del);
  curP=periodOf(todayISO()); // always open on the cycle that contains today
  if(!localStorage.getItem(KEY))save(); // persist defaults encrypted on first unlock
  renderAll();
  fbBoot();
}
function cycleDay(){return Math.min(28,Math.max(1,(typeof S!=='undefined'&&S&&+S.cycleDay)||25));}
// per-month start day: an override in S.cycleDays[key] wins over the global default
function cycleDayFor(key){
  var ov=(typeof S!=='undefined'&&S&&S.cycleDays)?S.cycleDays[key]:null;
  var v=(ov!=null&&ov!=='')?+ov:cycleDay();
  return Math.min(28,Math.max(1,v||25));
}

/* ── Date / period helpers (cycle = cycleDay → day-before) ─── */
function pad(n){return String(n).padStart(2,'0');}
function ym(d){return d.getFullYear()+'-'+pad(d.getMonth()+1);}
function todayISO(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function parseISO(iso){var p=iso.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function addDaysISO(iso,n){var d=parseISO(iso);d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addMonthsISO(iso,n){var d=parseISO(iso);d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function isoOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
// default date for a new entry: today if the current cycle is on screen, else that cycle's start
function logDateFor(){return isCur()?todayISO():isoOf(pStart(curP));}

// period key = YYYY-MM of the cycle START
function periodOf(iso){
  var y=+iso.slice(0,4),m=+iso.slice(5,7),d=+iso.slice(8,10);
  if(d>=cycleDayFor(y+'-'+pad(m)))return y+'-'+pad(m);
  var pm=m-1,py=y;if(pm<1){pm=12;py--;}return py+'-'+pad(pm);
}
function pStart(key){var p=key.split('-');return new Date(+p[0],+p[1]-1,cycleDayFor(key));}
function pEnd(key){var nk=shiftP(key,1),p=nk.split('-');return new Date(+p[0],+p[1]-1,cycleDayFor(nk)-1);}
function daysInP(key){return Math.round((pEnd(key)-pStart(key))/864e5)+1;}
function numWeeks(key){return Math.ceil(daysInP(key)/7);}
function dayIndexIn(iso,key){return Math.floor((parseISO(iso)-pStart(key))/864e5);}
function weekOf(iso,key){return Math.floor(dayIndexIn(iso,key)/7);}
function shiftP(key,delta){var p=key.split('-');return ym(new Date(+p[0],+p[1]-1+delta,1));}
function periodDiff(a,b){var pa=a.split('-'),pb=b.split('-');return (+pb[0]-+pa[0])*12+(+pb[1]-+pa[1]);}
function dayNowOf(key){if(key>curPnow())return 0;if(key<curPnow())return daysInP(key);return dayIndexIn(todayISO(),key)+1;}
function curPnow(){return periodOf(todayISO());}
function pLabel(key){
  var s=pStart(key),e=pEnd(key),M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return s.getDate()+' '+M[s.getMonth()]+'–'+e.getDate()+' '+M[e.getMonth()];
}

/* ── Money ────────────────────────────────────────────────── */
function eur(n){var neg=n<0;n=Math.abs(Math.round(n));return (neg?'-€':'€')+n.toLocaleString('en-US');}
function eur2(n){var neg=n<0;n=Math.abs(n);return (neg?'-€':'€')+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function round1(n){return Math.round(n*10)/10;}

/* ── Data access with amortization ────────────────────────── */
function catOf(id){for(var i=0;i<S.cats.length;i++)if(S.cats[i].id===id)return S.cats[i];return null;}
function income(){return (+S.income.blocked||0)+(+S.income.salary||0);}
function budgetTotal(){return S.cats.reduce(function(a,c){return a+(+c.budget||0);},0);}
function isCur(){return curP===curPnow();}
function isFuture(){return curP>curPnow();}
// contribution of one expense to a given period (spreads if covers>1)
function contrib(e,key){
  var p0=periodOf(e.date),cov=+e.covers||1,amt=+e.amt||0;
  if(cov<=1)return p0===key?amt:0;
  var off=periodDiff(p0,key);
  return (off>=0&&off<cov)?amt/cov:0;
}
function spentByCat(key){var m={};S.exp.forEach(function(e){var c=contrib(e,key);if(c)m[e.cat]=(m[e.cat]||0)+c;});return m;}
function totalSpent(key){return S.exp.reduce(function(a,e){return a+contrib(e,key);},0);}
function ledgerFor(key){return S.exp.filter(function(e){return periodOf(e.date)===key;});}

function projectedSpend(key){
  var dim=daysInP(key),past=key<curPnow(),future=key>curPnow(),dn=dayNowOf(key);
  var sc=spentByCat(key),tot=0;
  S.cats.forEach(function(c){
    var sp=sc[c.id]||0,bd=+c.budget||0;
    if(past){tot+=sp;return;}
    if(future){tot+=Math.max(sp,bd);return;}
    if(c.kind==='fixed'){tot+=Math.max(sp,bd);}
    else{var proj=dn>0?sp/dn*dim:sp;tot+=Math.min(Math.max(sp,proj),bd*1.5||proj);}
  });
  return tot;
}

/* ── HOME ─────────────────────────────────────────────────── */
function renderHome(){
  var inc=income(),spent=totalSpent(curP),proj=projectedSpend(curP),budget=budgetTotal(),sc=spentByCat(curP);
  var notSetup=inc<=0, projSave=inc-proj, dim=daysInP(curP), dn=dayNowOf(curP);
  if(notSetup){
    $('#h-save').textContent='—';
    $('#h-sub').innerHTML='Add your income & budgets in <b>Setup</b> to begin';
    $('#h-track').innerHTML='<span class="trackpill"><span class="dot"></span>Let’s set up your budget</span>';
  }else{
    $('#h-save').textContent=eur(projSave);
    $('#h-sub').innerHTML=isFuture()
      ? 'Upcoming cycle · budget <b>'+eur(budget)+'</b>'
      : 'Day <b>'+dn+'</b> of '+dim+' · spent <b>'+eur(spent)+'</b> so far';
    var target=inc-budget,ok=projSave>=target-1;
    $('#h-track').innerHTML='<span class="trackpill '+(ok?'':'warn')+'"><span class="dot"></span>'+
      (ok?'On track — saving '+eur(projSave):'Behind — '+eur(target-projSave)+' under plan')+'</span>';
  }
  $('#h-inc').textContent=eur(inc);
  $('#h-spent').textContent=eur(spent);
  $('#h-left').textContent=eur(budget-spent);

  // safe-to-spend: flexible (variable) money left ÷ days remaining in cycle
  var varRemain=0,varBudget=0;
  S.cats.forEach(function(c){if(c.kind==='var'){varBudget+=(+c.budget||0);varRemain+=Math.max((+c.budget||0)-(sc[c.id]||0),0);}});
  var safeEl=$('#h-safe');
  if(curP<curPnow()||notSetup){safeEl.style.display='none';}
  else{safeEl.style.display='';
    var daysLeft=isFuture()?dim:Math.max(dim-dn+1,1);
    var perDay=(isFuture()?varBudget:varRemain)/daysLeft;
    safeEl.innerHTML='<div><div class="sv num">'+eur2(perDay)+'/day</div><div class="ssub">safe to spend</div></div>'+
      '<div class="sl">'+daysLeft+' days left<br>'+eur(varRemain)+' left in flexible envelopes</div>';
  }

  renderProjection();
  renderUpcoming();

  var wq=numWeeks(curP),wsum=new Array(wq).fill(0);
  S.exp.forEach(function(e){var c=contrib(e,curP);if(c&&periodOf(e.date)===curP){var w=weekOf(e.date,curP);if(w>=0&&w<wq)wsum[w]+=c;}});
  var wpace=budget*7/dim;
  $('#wk-pace').textContent='pace '+eur(wpace)+'/wk';
  var curW=isCur()?weekOf(todayISO(),curP):-1;
  $('#weeks').innerHTML=wsum.map(function(v,i){
    var over=v>wpace;
    return '<div class="wk'+(i===curW?' cur':'')+'"><div class="wl">Week '+(i+1)+'</div>'+
      '<div class="wv num" style="color:'+(over?'var(--coral)':'var(--ink)')+'">'+eur(v)+'</div>'+
      '<div class="wp num">'+Math.round(wpace?v/wpace*100:0)+'% of pace</div></div>';
  }).join('');

  var use={};S.exp.forEach(function(e){if(e.item)use[e.item]=(use[e.item]||0)+1;});
  $('#chips').innerHTML=S.items.slice().sort(function(a,b){return (use[b.id]||0)-(use[a.id]||0);}).slice(0,12).map(function(it){
    return '<button class="chip" data-item="'+it.id+'">'+esc(shortName(it.name))+' <span class="cp num">'+eur2(it.price)+'</span></button>';
  }).join('')+'<button class="chip add" data-open-sheet="1">+ Custom</button>';

  if(envFilter&&!catOf(envFilter))envFilter=null;
  $('#env-sub').textContent=eur(spent)+' / '+eur(budget)+' · tap to filter log';
  $('#envelopes').innerHTML=S.cats.map(function(c){
    var sp=sc[c.id]||0,bd=+c.budget||0,pct=bd>0?Math.min(sp/bd*100,100):(sp>0?100:0);
    var over=sp>bd&&bd>0,col=over?'var(--coral)':(pct>85?'var(--amber)':c.color);
    var paid=c.kind==='fixed'&&sp>=bd-0.01&&bd>0;
    var btn=c.kind==='fixed'&&bd>0?'<button class="paidbtn'+(paid?' done':'')+'" data-pay="'+c.id+'">'+(paid?'Covered ✓':'Mark paid')+'</button>':'';
    return '<div class="env'+(envFilter===c.id?' filt':'')+'" data-envf="'+c.id+'"><div class="env-top"><span class="swatch" style="background:'+c.color+';box-shadow:0 0 6px '+c.color+'"></span>'+
      '<span class="env-name">'+esc(c.name)+(c.hard?' <span class="hardlock">🔒</span>':'')+'</span>'+
      (c.kind==='fixed'?'<span class="env-tag">fixed</span>':'')+
      '<span class="env-fig num"><span class="sp" style="color:'+(over?'var(--coral)':'var(--ink)')+'">'+eur(sp)+'</span><span class="bd"> / '+eur(bd)+'</span></span></div>'+
      '<div class="bar"><span style="width:'+pct+'%;background:'+col+'"></span></div>'+
      '<div class="env-foot"><span class="env-left'+(over?' over':'')+'">'+(over?eur(sp-bd)+' over':eur(bd-sp)+' left')+'</span>'+btn+'</div></div>';
  }).join('');

  renderLoans();

  var fc=envFilter?catOf(envFilter):null;
  var list=ledgerFor(curP).filter(function(e){return !fc||e.cat===envFilter;})
    .sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.id<b.id?1:-1);});
  $('#log-count').textContent=fc?list.length+' · '+fc.name+' only':list.length+' entries';
  if(!list.length){$('#ledger').innerHTML='<div class="empty"><b>'+(fc?'Nothing in '+esc(fc.name)+' yet':'Nothing logged yet')+'</b>'+(fc?'Tap the envelope again to clear the filter.':'Tap a chip above or the + button.')+'</div>';}
  else{$('#ledger').innerHTML=list.map(function(e){
    var c=catOf(e.cat)||{name:'?',color:'#888'};
    var qtxt=(e.qty&&e.qty!=1)?e.qty+'× · ':'';
    var amtxt=(+e.covers>1)?' <span style="color:var(--faint)">('+eur(e.amt/e.covers)+'/cyc)</span>':'';
    return '<div class="led"><span class="dot" style="background:'+c.color+';box-shadow:0 0 5px '+c.color+'"></span>'+
      '<div class="body"><div class="t">'+esc(e.name||c.name)+'</div>'+
      '<div class="m num">'+qtxt+esc(c.name)+' · '+fmtDate(e.date)+((+e.covers>1)?' · '+e.covers+'-cyc':'')+'</div></div>'+
      '<span class="amt num">'+eur2(e.amt)+amtxt+'</span>'+
      '<button class="edit" data-edit="'+e.id+'" aria-label="Edit entry">✎</button>'+
      '<button class="del" data-del="'+e.id+'">✕</button></div>';
  }).join('');}
}
function fmtDate(iso){var p=iso.split('-');return (+p[2])+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1];}
function shortName(n){n=String(n).replace(/\s*\(.*?\)/g,'');var s=n.split(' ').slice(0,2).join(' ');return s.length>15?s.slice(0,14)+'…':s;}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

function renderProjection(){
  if(income()<=0){
    $('#proj-rate').textContent='';
    $('#proj-rows').innerHTML='<div class="empty" style="padding:14px 10px"><b>Set your income first</b>Add it in Setup to see where saving gets you.</div>';
    $('#proj-foot').textContent='';
    return;
  }
  var rate=income()-budgetTotal(),start=+S.startSavings||0,goalM=+S.goal.months||4;
  var marks=[1,goalM,6,12],uniq=[];
  marks.forEach(function(m){if(m>0&&uniq.indexOf(m)<0)uniq.push(m);});
  uniq.sort(function(a,b){return a-b;});
  $('#proj-rate').textContent=(rate>=0?'+':'')+eur(rate)+'/mo';
  $('#proj-rows').innerHTML=uniq.map(function(m){
    var val=start+rate*m,isGoal=m===goalM;
    return '<div class="prow'+(isGoal?' goal':'')+'"><span class="pm">In '+m+' month'+(m>1?'s':'')+'</span>'+
      (isGoal?'<span class="gbadge">your goal</span>':'')+
      '<span class="pv num">'+eur(val)+'</span></div>';
  }).join('');
  $('#proj-foot').innerHTML=start>0
    ? 'From '+eur(start)+' today, saving '+eur(rate)+'/mo at your plan.'
    : 'Starting from €0 today, at your plan of '+eur(rate)+'/mo. Every euro you don’t spend lands here.';
}

/* ── Loans: lent & borrowed — kept outside all budget math ── */
var showSettledLoans=false;
function loanOf(id){return (S.loans||[]).filter(function(l){return l.id===id;})[0];}
function paidOf(l){return (l.pays||[]).reduce(function(a,p){return a+(+p.amt||0);},0);}
function remainOf(l){return Math.max((+l.amt||0)-paidOf(l),0);}
function renderLoans(){
  var loans=S.loans||[];
  var open=loans.filter(function(l){return !l.settled;}),done=loans.filter(function(l){return l.settled;});
  var lent=0,bor=0;
  open.forEach(function(l){if(l.dir==='borrowed')bor+=remainOf(l);else lent+=remainOf(l);});
  var sub=$('#loan-sub');
  sub.textContent=done.length?(showSettledLoans?'hide settled':done.length+' settled · show'):(open.length?open.length+' open':'outside the budget');
  sub.style.textDecoration=done.length?'underline':'';
  var net=lent-bor,sumEl=$('#loan-sum');
  if(open.length){sumEl.style.display='';
    sumEl.innerHTML='<div><div class="k">Out with friends</div><div class="v num" style="color:var(--gold)">'+eur(lent)+'</div></div>'+
      '<div><div class="k">You owe</div><div class="v num" style="color:'+(bor>0?'var(--coral)':'var(--ink)')+'">'+eur(bor)+'</div></div>'+
      '<div><div class="k">Net</div><div class="v num">'+(net>=0?'+':'')+eur(net)+'</div></div>';
  }else sumEl.style.display='none';
  var byDate=function(a,b){return a.date<b.date?1:-1;};
  var list=open.slice().sort(byDate).concat(showSettledLoans?done.slice().sort(byDate):[]);
  if(!list.length){
    $('#loans').innerHTML=loans.length
      ? '<div class="empty" style="padding:14px 10px"><b>All settled ✓</b>Everything you lent came back.</div>'
      : '<div class="empty" style="padding:14px 10px"><b>No IOUs yet</b>Money you lend stays counted as yours — it never touches your spending or savings.</div>';
    return;
  }
  $('#loans').innerHTML=list.map(function(l){
    var isLent=l.dir!=='borrowed',rem=remainOf(l),paid=paidOf(l);
    var meta=(isLent?'lent':'borrowed')+' · '+fmtDate(l.date);
    if(paid>0&&!l.settled)meta+=' · '+eur(paid)+' of '+eur(+l.amt||0)+(isLent?' back':' paid');
    if(l.note)meta+=' · '+esc(l.note);
    if(l.due&&!l.settled){
      var dd=Math.round((parseISO(l.due)-parseISO(todayISO()))/864e5);
      meta+=' · <span class="'+(dd<0?'lover':dd<=3?'ldue':'')+'">'+(dd<0?Math.abs(dd)+'d overdue':dd===0?'due today':'due in '+dd+'d')+'</span>';
    }
    if(l.settled)meta+=' · settled '+fmtDate(l.settled);
    return '<div class="loan '+(isLent?'lent':'borrowed')+(l.settled?' done':'')+'">'+
      '<div class="li"><div class="ln">'+esc(l.person||'Someone')+'</div><div class="lm num">'+meta+'</div></div>'+
      '<span class="la num">'+(isLent?'':'−')+eur2(l.settled?(+l.amt||0):rem)+'</span>'+
      (l.settled?'':'<button class="settle" data-lpay="'+l.id+'">'+(isLent?'Got back':'Pay back')+'</button>')+
      '<button class="edit" data-ledit="'+l.id+'" aria-label="Edit IOU">✎</button>'+
      '<button class="del" data-ldel="'+l.id+'" aria-label="Delete IOU">✕</button></div>';
  }).join('');
}

function renderUpcoming(){
  var card=$('#up-card');
  if(!S.recurring||!S.recurring.length){card.style.display='none';return;}
  card.style.display='';
  var today=todayISO();
  var sorted=S.recurring.slice().sort(function(a,b){return a.next<b.next?-1:1;});
  $('#upcoming').innerHTML=sorted.map(function(r){
    var c=catOf(r.cat)||{name:r.cat};
    var days=Math.round((parseISO(r.next)-parseISO(today))/864e5);
    var when=days<0?Math.abs(days)+'d overdue':days===0?'due today':'in '+days+'d';
    var cls=days<0?'over':(days<=3?'due':'');
    var cov=(+r.covers>1)?' · '+eur(r.amount/r.covers)+'/cyc ×'+r.covers:'';
    return '<div class="up"><div class="ui"><div class="un">'+esc(r.name)+'</div>'+
      '<div class="ud '+cls+'">'+fmtDate(r.next)+' · '+when+' · every '+r.n+' '+r.unit+cov+'</div></div>'+
      '<span class="ua num">'+eur(r.amount)+'</span>'+
      '<button class="logbtn" data-logrec="'+r.id+'">Log</button></div>';
  }).join('');
}

/* ── STATS ────────────────────────────────────────────────── */
function renderStats(){
  var inc=income(),spent=totalSpent(curP),budget=budgetTotal();
  $('#s-blocked').textContent=eur(S.income.blocked);
  $('#s-salary').textContent=eur(S.income.salary);
  $('#s-income').textContent=eur(inc);
  $('#s-budget').textContent=eur(budget);
  $('#s-spent').textContent=eur(spent);
  $('#s-saved').textContent=eur(inc-spent);
  $('#s-rate').textContent=inc>0?Math.round((inc-projectedSpend(curP))/inc*100)+'%':'—';
  var dim=daysInP(curP),dn=dayNowOf(curP);
  $('#s-burn').textContent=dn>0?eur2(spent/dn):'€0';

  var lentO=0,oweO=0;
  (S.loans||[]).forEach(function(l){if(!l.settled){if(l.dir==='borrowed')oweO+=remainOf(l);else lentO+=remainOf(l);}});
  $('#sr-lent').style.display=lentO>0?'':'none';$('#s-lent').textContent=eur(lentO);
  $('#sr-owe').style.display=oweO>0?'':'none';$('#s-owe').textContent=eur(oweO);

  renderFlags();
  renderHistory();
  renderDonut();
  renderCompare();
  renderTop5();
  renderFlow();
  renderDaily();
  renderRecords();

  var wq=numWeeks(curP),wsum=new Array(wq).fill(0);
  S.exp.forEach(function(e){var c=contrib(e,curP);if(c&&periodOf(e.date)===curP){var w=weekOf(e.date,curP);if(w>=0&&w<wq)wsum[w]+=c;}});
  var wpace=budget*7/dim,mx=Math.max(wpace,Math.max.apply(null,wsum),1);
  $('#trend').innerHTML=wsum.map(function(v,i){
    return '<div class="col"><div class="bwrap"><div class="b'+(v>wpace?' over':'')+'" style="height:'+Math.max(v/mx*100,2)+'%"></div></div><div class="cl">W'+(i+1)+'</div></div>';
  }).join('');

  var sc=spentByCat(curP);
  $('#pvb').innerHTML=S.cats.map(function(c){
    var sp=sc[c.id]||0,bd=+c.budget||0,pct=bd>0?Math.min(sp/bd*100,100):(sp>0?100:0),over=sp>bd&&bd>0;
    return '<div class="pvb"><div class="pvb-h"><span class="nm">'+esc(c.name)+(c.hard?' 🔒':'')+'</span>'+
      '<span class="fg num">'+eur(sp)+' / '+eur(bd)+'</span></div>'+
      '<div class="bar"><span style="width:'+pct+'%;background:'+(over?'var(--coral)':c.color)+'"></span></div></div>';
  }).join('');

  var bq={},ba={};
  ledgerFor(curP).forEach(function(e){if(e.item){bq[e.item]=(bq[e.item]||0)+(+e.qty||1);ba[e.item]=(ba[e.item]||0)+(+e.amt||0);}});
  $('#items').innerHTML=S.items.map(function(it){
    var q=bq[it.id]||0,plan=+it.plan||0,pct=plan>0?Math.min(q/plan*100,100):(q>0?100:0),c=catOf(it.cat)||{color:'#888'};
    return '<div class="item-row"><div class="in"><div>'+esc(it.name)+'</div>'+
      '<div class="iq num">'+round1(q)+' / '+plan+' · '+eur(ba[it.id]||0)+' of '+eur(it.price*plan)+'</div></div>'+
      '<div class="ib"><div class="bar"><span style="width:'+pct+'%;background:'+c.color+'"></span></div></div></div>';
  }).join('');

  renderGoal();
}

function renderFlags(){
  var flags=[],inc=income(),budget=budgetTotal(),sc=spentByCat(curP);
  var dim=daysInP(curP),dn=dayNowOf(curP),wpace=budget*7/dim;
  // hard-limit breaches (highest priority)
  S.cats.forEach(function(c){var sp=sc[c.id]||0,bd=+c.budget||0;
    if(c.hard&&bd>0&&sp>bd)flags.push({sev:'high',t:esc(c.name)+' broke its hard limit',p:eur(sp)+' spent vs €'+bd+' cap — '+eur(sp-bd)+' over. Pull back or move the overflow to Other.'});
  });
  // projected over budget (current cycle only)
  if(isCur()&&dn>0){
    S.cats.forEach(function(c){var sp=sc[c.id]||0,bd=+c.budget||0;if(c.hard||bd<=0)return;
      if(c.kind==='var'){var proj=sp/dn*dim;if(proj>bd*1.05&&sp>0)flags.push({sev:'med',t:esc(c.name)+' is pacing over budget',p:'On track for ~'+eur(proj)+' vs '+eur(bd)+'. Slow down to stay under.'});}
    });
  }
  // non-hard already over
  S.cats.forEach(function(c){var sp=sc[c.id]||0,bd=+c.budget||0;
    if(!c.hard&&bd>0&&sp>bd)flags.push({sev:'med',t:esc(c.name)+' is over budget',p:eur(sp-bd)+' over its '+eur(bd)+' envelope.'});
  });
  // week spikes (completed weeks)
  var wq=numWeeks(curP),wsum=new Array(wq).fill(0);
  S.exp.forEach(function(e){var cc=contrib(e,curP);if(cc&&periodOf(e.date)===curP){var w=weekOf(e.date,curP);if(w>=0&&w<wq)wsum[w]+=cc;}});
  var curW=isCur()?weekOf(todayISO(),curP):wq;
  wsum.forEach(function(v,i){if(i<curW&&v>wpace*1.3)flags.push({sev:'low',t:'Week '+(i+1)+' spiked',p:eur(v)+' vs '+eur(wpace)+' pace. Check what drove it.'});});
  // items overbought
  var bq={};ledgerFor(curP).forEach(function(e){if(e.item)bq[e.item]=(bq[e.item]||0)+(+e.qty||1);});
  S.items.forEach(function(it){var q=bq[it.id]||0;if(it.plan>0&&q>it.plan)flags.push({sev:'low',t:esc(it.name)+' overbought',p:round1(q)+' bought vs '+it.plan+' planned.'});});
  // projected savings below plan
  var projSave=inc-projectedSpend(curP),plan=inc-budget;
  if(!isFuture()&&projSave<plan-5)flags.push({sev:'med',t:'Savings tracking below plan',p:'Projected '+eur(projSave)+' vs '+eur(plan)+' target this cycle.'});

  var order={high:0,med:1,low:2};
  flags.sort(function(a,b){return order[a.sev]-order[b.sev];});
  if(!flags.length){$('#flags').innerHTML='<div class="okflag"><span>✓</span>No problems this cycle — on track.</div>';return;}
  $('#flags').innerHTML=flags.map(function(f){
    return '<div class="flag '+f.sev+'"><div class="fi"></div><div><div class="ft">'+f.t+'</div><div class="fp">'+f.p+'</div></div></div>';
  }).join('');
}

function renderHistory(){
  var inc=income(),rows=[],mx=1;
  for(var i=5;i>=0;i--){var k=shiftP(curPnow(),-i);
    if(k>curPnow())continue;
    var saved=inc-(k<curPnow()?totalSpent(k):projectedSpend(k));
    rows.push({k:k,saved:saved,cur:k===curPnow()});mx=Math.max(mx,Math.abs(saved));
  }
  $('#hist').innerHTML=rows.map(function(r){
    var pct=Math.max(r.saved/mx*100,2),col=r.saved<0?'var(--coral)':(r.cur?'var(--gold)':'var(--brand)');
    return '<div class="hr"><span class="hl num">'+pLabel(r.k)+'</span>'+
      '<span class="hb"><span class="bar"><span style="width:'+pct+'%;background:'+col+'"></span></span></span>'+
      '<span class="hv num" style="color:'+(r.saved<0?'var(--coral)':'var(--ink)')+'">'+eur(r.saved)+'</span></div>';
  }).join('');
}

function renderGoal(){
  var g=S.goal,inc=income(),budget=budgetTotal(),months=+g.months||4,start=g.start;
  var target=(inc-budget)*months,saved=0,projected=0,done=0,now=curPnow();
  for(var i=0;i<months;i++){var k=shiftP(start,i);
    if(k<now){var s=inc-totalSpent(k);saved+=s;projected+=s;done++;}
    else if(k===now){var s2=inc-totalSpent(k);saved+=s2;projected+=inc-projectedSpend(k);done++;}
    else{projected+=inc-budget;}
  }
  var pct=target>0?Math.max(0,Math.min(saved/target*100,100)):0;
  $('#goal-range').textContent=pLabel(start)+' · '+months+' cyc';
  $('#goal-saved').textContent=eur(saved);
  $('#goal-target').textContent=eur(target);
  $('#goal-pct').textContent=Math.round(pct)+'%';
  $('#goal-bar').style.width=pct+'%';
  $('#goal-arc').style.strokeDashoffset=276-(pct/100*276);
  $('#goal-hint').innerHTML='Projected by window end: <b style="color:var(--gold)">'+eur(projected)+'</b> ('+done+'/'+months+' cycles in)';
}

/* ── Extra stats ──────────────────────────────────────────── */
function renderDonut(){
  var sc=spentByCat(curP),parts=[],tot=0;
  S.cats.forEach(function(c){var v=sc[c.id]||0;if(v>0.005){parts.push({name:c.name,color:c.color,v:v});tot+=v;}});
  Object.keys(sc).forEach(function(id){if(!catOf(id)&&sc[id]>0.005){parts.push({name:'Uncategorised',color:'#6B7E6F',v:sc[id]});tot+=sc[id];}});
  var card=$('#dn-card');
  if(tot<=0){card.style.display='none';return;}
  card.style.display='';
  parts.sort(function(a,b){return b.v-a.v;});
  if(parts.length>6){
    var rest=parts.slice(5),sum=rest.reduce(function(a,p){return a+p.v;},0);
    parts=parts.slice(0,5);parts.push({name:'Everything else',color:'#6B7E6F',v:sum});
  }
  var acc=0,stops=parts.map(function(p){
    var a0=acc/tot*360;acc+=p.v;
    return p.color+' '+a0.toFixed(1)+'deg '+(acc/tot*360).toFixed(1)+'deg';
  });
  $('#dchart').style.background='conic-gradient('+stops.join(',')+')';
  $('#dn-tot').textContent=eur(tot);
  $('#dn-leg').innerHTML=parts.map(function(p){
    return '<div class="dlr"><span class="sw" style="background:'+p.color+'"></span><span class="nm">'+esc(p.name)+'</span>'+
      '<span class="pc num">'+Math.round(p.v/tot*100)+'%</span><span class="pv num">'+eur(p.v)+'</span></div>';
  }).join('');
}

// spend per envelope up to (but excluding) day index dayN of a cycle
function spentThroughByCat(key,dayN){
  var m={};
  S.exp.forEach(function(e){
    if(periodOf(e.date)!==key)return;
    if(dayIndexIn(e.date,key)>=dayN)return;
    m[e.cat]=(m[e.cat]||0)+(+e.amt||0)/(+e.covers||1);
  });
  return m;
}
function deltaPill(d){
  if(Math.abs(d)<1)return '<span class="dpill flat">same</span>';
  return d>0?'<span class="dpill up num">▲ '+eur(d)+'</span>':'<span class="dpill down num">▼ '+eur(-d)+'</span>';
}
function renderCompare(){
  var prev=shiftP(curP,-1),dn=dayNowOf(curP),partial=isCur();
  var a=partial?spentThroughByCat(curP,dn):spentByCat(curP);
  var b=partial?spentThroughByCat(prev,dn):spentByCat(prev);
  var totA=0,totB=0,k;
  for(k in a)totA+=a[k];
  for(k in b)totB+=b[k];
  var card=$('#cmp-card');
  if(totA<=0&&totB<=0){card.style.display='none';return;}
  card.style.display='';
  $('#cmp-sub').textContent=partial?'first '+dn+' days of each':pLabel(prev)+' → '+pLabel(curP);
  var rows='<div class="cmp-row"><span class="nm" style="font-weight:640">Total</span>'+
    '<span class="was num">'+eur(totB)+'</span><span class="now num">'+eur(totA)+'</span>'+deltaPill(totA-totB)+'</div>';
  S.cats.forEach(function(c){
    var va=a[c.id]||0,vb=b[c.id]||0;
    if(va<0.01&&vb<0.01)return;
    rows+='<div class="cmp-row"><span class="nm">'+esc(c.name)+'</span>'+
      '<span class="was num">'+eur(vb)+'</span><span class="now num">'+eur(va)+'</span>'+deltaPill(va-vb)+'</div>';
  });
  $('#cmp').innerHTML=rows;
}

function renderTop5(){
  var list=ledgerFor(curP).slice().sort(function(a,b){return (+b.amt||0)-(+a.amt||0);}).slice(0,5);
  var card=$('#top-card');
  if(!list.length){card.style.display='none';return;}
  card.style.display='';
  $('#top5').innerHTML=list.map(function(e,i){
    var c=catOf(e.cat)||{name:'—'};
    return '<div class="toprow"><span class="rk num">'+(i+1)+'</span>'+
      '<div class="bi"><div class="bn">'+esc(e.name||c.name)+'</div><div class="bm">'+esc(c.name)+' · '+fmtDate(e.date)+'</div></div>'+
      '<span class="ba num">'+eur2(e.amt)+'</span></div>';
  }).join('');
}

function renderFlow(){
  var inc=income(),card=$('#flow-card');
  if(inc<=0){card.style.display='none';return;}
  card.style.display='';
  var sc=spentByCat(curP),fixed=0;
  S.cats.forEach(function(c){if(c.kind==='fixed')fixed+=sc[c.id]||0;});
  var tot=totalSpent(curP),flex=Math.max(tot-fixed,0),left=inc-tot;
  var fp=Math.min(fixed/inc*100,100),xp=Math.min(flex/inc*100,100-fp),lp=left>0?Math.max(100-fp-xp,0):0;
  $('#flowbar').innerHTML='<span style="width:'+fp+'%;background:#7C93FF"></span>'+
    '<span style="width:'+xp+'%;background:var(--mint)"></span>'+
    '<span style="width:'+lp+'%;background:var(--gold)"></span>';
  $('#flow-sub').textContent='saving ~'+Math.round(Math.max(inc-projectedSpend(curP),0)/inc*100)+'% of income';
  function row(col,nm,v){return '<div class="dlr"><span class="sw" style="background:'+col+'"></span><span class="nm">'+nm+'</span>'+
    '<span class="pc num">'+Math.round(v/inc*100)+'%</span><span class="pv num">'+eur(v)+'</span></div>';}
  $('#flow-leg').innerHTML=row('#7C93FF','Fixed bills',fixed)+row('var(--mint)','Flexible spending',flex)+
    row(left<0?'var(--coral)':'var(--gold)',left<0?'Overspent':'Not spent yet',Math.abs(left));
}

function renderDaily(){
  var dim=daysInP(curP),arr=new Array(dim).fill(0);
  S.exp.forEach(function(e){
    var c=contrib(e,curP);
    if(c&&periodOf(e.date)===curP){var d=dayIndexIn(e.date,curP);if(d>=0&&d<dim)arr[d]+=c;}
  });
  var tot=0;arr.forEach(function(v){tot+=v;});
  var card=$('#dd-card');
  if(tot<=0){card.style.display='none';return;}
  card.style.display='';
  var mx=Math.max.apply(null,arr),ti=isCur()?dayNowOf(curP)-1:-1;
  var avg=tot/Math.max(dayNowOf(curP)||dim,1);
  $('#dd-sub').textContent='avg '+eur2(avg)+'/day · peak '+eur(mx);
  $('#daily').innerHTML=arr.map(function(v,i){
    var cls=i===ti?' today':v<=0?' zero':(v>avg*2?' hot':'');
    return '<div class="db'+cls+'" style="height:'+(mx>0?Math.max(v/mx*100,3):3)+'%" title="Day '+(i+1)+': '+eur(v)+'"></div>';
  }).join('');
  $('#dax').innerHTML='<span>'+fmtDate(isoOf(pStart(curP)))+'</span><span>'+fmtDate(isoOf(pEnd(curP)))+'</span>';
}

function renderRecords(){
  if(!S.exp.length){$('#records').innerHTML='<div class="hint">Log a few expenses and your all-time records show up here.</div>';return;}
  var inc=income(),per={},total=0;
  S.exp.forEach(function(e){per[periodOf(e.date)]=1;total+=(+e.amt||0);});
  var keys=Object.keys(per).sort(),now=curPnow();
  var past=keys.filter(function(x){return x<now;});
  var best=null,sumSp=0;
  past.forEach(function(x){
    var sp=totalSpent(x);sumSp+=sp;
    var sv=inc-sp;
    if(best===null||sv>best.v)best={k:x,v:sv};
  });
  var seen={},ns=0,dn=dayNowOf(now),start=isoOf(pStart(now));
  S.exp.forEach(function(e){if(periodOf(e.date)===now)seen[e.date]=1;});
  for(var i=0;i<dn;i++)if(!seen[addDaysISO(start,i)])ns++;
  var wd=[0,0,0,0,0,0,0],wn=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],wi=0;
  S.exp.forEach(function(e){wd[parseISO(e.date).getDay()]+=(+e.amt||0)/(+e.covers||1);});
  wd.forEach(function(v,i){if(v>wd[wi])wi=i;});
  var rows='';
  function r(l,v,col){rows+='<div class="stat-row"><span class="lab">'+l+'</span><span class="val num"'+(col?' style="color:'+col+'"':'')+'>'+v+'</span></div>';}
  r('Entries logged',S.exp.length+' · '+eur(total));
  r('Cycles tracked',keys.length);
  if(inc>0&&best)r('Best cycle · '+pLabel(best.k),eur(best.v)+' saved','var(--gold)');
  if(past.length)r('Avg spend per cycle',eur(sumSp/past.length));
  r('No-spend days this cycle',ns+' of '+dn,ns>0?'var(--mint)':null);
  if(wd[wi]>0)r('Priciest weekday',wn[wi]);
  $('#records').innerHTML=rows;
}

/* ── SETUP ────────────────────────────────────────────────── */
function renderSetup(){
  $('#in-blocked').value=S.income.blocked;
  $('#in-salary').value=S.income.salary;
  $('#in-cycle').value=cycleDay();
  renderCycleOverrides();
  $('#in-start').value=S.goal.start;
  $('#in-months').value=S.goal.months;
  $('#in-saved0').value=+S.startSavings||0;

  $('#set-cats').innerHTML=S.cats.map(function(c){
    return '<div class="setrow"><span class="swatch" style="background:'+c.color+';box-shadow:0 0 6px '+c.color+'"></span>'+
      '<span class="sn">'+esc(c.name)+'<small>'+c.kind+'</small></span>'+
      '<button class="tog'+(c.hard?' on':'')+'" data-hard="'+c.id+'">'+(c.hard?'🔒 hard':'soft')+'</button>'+
      '<input class="mini num" type="number" inputmode="decimal" value="'+(+c.budget||0)+'" data-cbud="'+c.id+'">'+
      '<button class="rm" data-crm="'+c.id+'">✕</button></div>';
  }).join('');

  $('#set-rec').innerHTML=(S.recurring||[]).map(function(r){
    var c=catOf(r.cat)||{name:'?'};
    return '<div class="setrow"><span class="sn">'+esc(r.name)+'<small>'+esc(c.name)+' · every '+r.n+' '+r.unit+(+r.covers>1?' · covers '+r.covers:'')+'</small></span>'+
      '<input class="mini num" type="number" inputmode="decimal" value="'+r.amount+'" data-ramt="'+r.id+'">'+
      '<input class="mdate num" type="date" value="'+r.next+'" data-rnext="'+r.id+'">'+
      '<button class="rm" data-rrm="'+r.id+'">✕</button></div>';
  }).join('')||'<div class="hint">No recurring items.</div>';

  $('#set-items').innerHTML=S.items.map(function(it){
    var c=catOf(it.cat)||{name:'?'};
    return '<div class="setrow"><span class="sn">'+esc(it.name)+'<small>'+esc(c.name)+'</small></span>'+
      '<input class="mini2 num" type="number" inputmode="decimal" value="'+it.price+'" data-iprice="'+it.id+'" aria-label="unit price €">'+
      '<input class="mini2 num" type="number" inputmode="decimal" value="'+it.plan+'" data-iplan="'+it.id+'" aria-label="planned per cycle">'+
      '<button class="rm" data-irm="'+it.id+'">✕</button></div>';
  }).join('');

  var opts=S.cats.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('');
  $('#ni-cat').innerHTML=opts;$('#nr-cat').innerHTML=opts;
}
function periodTitle(key){var p=key.split('-');return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1]+' '+p[0];}
function renderCycleOverrides(){
  var ov=S.cycleDays||{};
  $('#ov-period').textContent=periodTitle(curP);
  $('#in-cycle-ov').value=(ov[curP]!=null&&ov[curP]!=='')?ov[curP]:'';
  var keys=Object.keys(ov).filter(function(k){return ov[k]!=null&&ov[k]!=='';}).sort();
  $('#ov-list').innerHTML=keys.length?keys.map(function(k){
    return '<div class="setrow"><span class="sn">'+periodTitle(k)+'<small>starts on the '+cycleDayFor(k)+'</small></span>'+
      '<button class="rm" data-ovrm="'+k+'">✕</button></div>';
  }).join(''):'<div class="hint">No per-month overrides yet — every cycle uses the default.</div>';
}

/* ── Render orchestration ─────────────────────────────────── */
function renderAll(){
  var td=new Date(),D=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var toNew=Math.max(Math.round((pStart(shiftP(curPnow(),1))-td)/864e5),0);
  $('#today').textContent=D[td.getDay()]+', '+td.getDate()+' '+M[td.getMonth()]+(toNew<=6?' · '+toNew+'d to new cycle':'');
  $('#mlabel').textContent=pLabel(curP);
  renderHome();
  if($('#v-stats').classList.contains('active'))renderStats();
  if($('#v-setup').classList.contains('active'))renderSetup();
}

/* ── Add / confirm / delete ───────────────────────────────── */
function commit(o){
  S.exp.push({id:uid(),date:o.date||todayISO(),cat:o.cat,item:o.item||null,name:o.name||'',qty:o.qty||1,amt:+o.amt||0,covers:+o.covers||1});
  S.lastCat=o.cat;
  if(navigator.vibrate)try{navigator.vibrate(8);}catch(err){}
  save();renderAll();return S.exp[S.exp.length-1];
}
// gate hard limits before committing
function tryAdd(o,onDone){
  var c=catOf(o.cat),key=periodOf(o.date||todayISO());
  if(c&&c.hard&&(+c.budget||0)>0){
    var cur=spentByCat(key)[o.cat]||0,after=cur+(+o.amt||0),bd=+c.budget;
    if(after>bd){
      askConfirm(esc(c.name)+' hard limit',
        'This puts <b>'+esc(c.name)+'</b> at <b>'+eur(after)+'</b>, over your '+eur(bd)+' hard limit by <b>'+eur(after-bd)+'</b> for '+pLabel(key)+'.',
        function(){var e=commit(o);if(onDone)onDone(e);});
      return;
    }
  }
  var e=commit(o);if(onDone)onDone(e);
}
function logItem(it){
  tryAdd({cat:it.cat,item:it.id,name:it.name,qty:1,amt:it.price,date:logDateFor()},function(e){
    lastLogged=e;showToast('Logged <b>'+esc(shortName(it.name))+'</b> '+eur2(it.price),undoLast);
  });
}
function delExpense(id){S.exp=S.exp.filter(function(e){return e.id!==id;});tombstone(id);save();renderAll();}

function askConfirm(title,msg,cb,okLabel){
  pendingConfirm=cb;$('#cm-title').innerHTML=title;$('#cm-msg').innerHTML=msg;
  $('#cm-ok').textContent=okLabel||'Log anyway';
  $('#cscrim').classList.add('open');$('#cmodal').classList.add('open');
}
function closeConfirm(){pendingConfirm=null;$('#cscrim').classList.remove('open');$('#cmodal').classList.remove('open');}

/* ── Toast ────────────────────────────────────────────────── */
var toastTimer;
function showToast(html,undoFn){
  var t=$('#toast');
  t.innerHTML='<span>'+html+'</span>'+(undoFn?'<button id="undo">Undo</button>':'');
  t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('show');},3400);
  if(undoFn)$('#undo').onclick=function(){undoFn();t.classList.remove('show');};
}
function undoLast(){if(lastLogged){delExpense(lastLogged.id);lastLogged=null;}}

/* ── Sheet ────────────────────────────────────────────────── */
function openSheet(prefill){
  if(!S.cats.length){showToast('Add an envelope in Setup first');return;}
  editingId=prefill&&prefill.editId?prefill.editId:null;
  sheetCat=prefill&&prefill.cat?prefill.cat:(catOf(S.lastCat)?S.lastCat:S.cats[0].id);
  sheetItem=prefill&&prefill.item?prefill.item:null;
  sheetUnit=(sheetItem&&prefill.qty>0)?(+prefill.amt||0)/(+prefill.qty):0;
  $('#sheet-cats').innerHTML=S.cats.map(function(c){
    return '<button class="cp2'+(c.id===sheetCat?' sel':'')+'" data-scat="'+c.id+'"><span class="sw" style="background:'+c.color+'"></span>'+esc(c.name)+'</button>';
  }).join('');
  renderSug();
  $('#sh-name').value=prefill&&prefill.name?prefill.name:'';
  $('#sh-qty').value=prefill&&prefill.qty?prefill.qty:1;
  $('#sh-amt').value=prefill&&prefill.amt!=null?prefill.amt:'';
  $('#sh-amt').style.borderColor='';
  $('#sh-date').value=prefill&&prefill.date?prefill.date:logDateFor();
  $('#sheet-title').textContent=editingId?'Edit entry':'Add expense';
  $('#sh-save').textContent=editingId?'Save changes':'Log it';
  $('#scrim').classList.add('open');$('#sheet').classList.add('open');
}
// catalog items for the picked envelope, tap to prefill name + price
function renderSug(){
  var its=S.items.filter(function(i){return i.cat===sheetCat;});
  $('#sheet-sug').innerHTML=its.map(function(it){
    return '<button class="chip'+(it.id===sheetItem?' sel':'')+'" data-sug="'+it.id+'">'+esc(shortName(it.name))+' <span class="cp num">'+eur2(it.price)+'</span></button>';
  }).join('');
}
function syncSheetAmt(){
  if(sheetUnit>0){
    var q=parseFloat($('#sh-qty').value)||1;
    $('#sh-amt').value=(Math.round(q*sheetUnit*100)/100);
    $('#sh-amt').style.borderColor='';
  }
}
function editExpense(id){
  var e=S.exp.filter(function(x){return x.id===id;})[0];if(!e)return;
  openSheet({cat:e.cat,name:e.name,qty:e.qty,amt:e.amt,date:e.date,item:e.item,editId:e.id});
}
function closeSheet(){$('#scrim').classList.remove('open');$('#sheet').classList.remove('open');}

/* ── Recurring: log now + advance ─────────────────────────── */
function logRecurring(id){
  var r=(S.recurring||[]).filter(function(x){return x.id===id;})[0];if(!r)return;
  tryAdd({cat:r.cat,name:r.name,qty:1,amt:r.amount,covers:+r.covers||1,date:r.next},function(e){
    lastLogged=e;
    var prevNext=r.next;
    r.next=r.unit==='months'?addMonthsISO(r.next,+r.n||1):addDaysISO(r.next,+r.n||1);
    save();renderAll();
    showToast('Logged <b>'+esc(r.name)+'</b> '+eur(r.amount)+' · next '+fmtDate(r.next),
      function(){undoLast();r.next=prevNext;save();renderAll();});
  });
}

/* ── Events ───────────────────────────────────────────────── */
$$('.nav-b').forEach(function(b){b.onclick=function(){
  var v=b.dataset.view;
  $$('.nav-b').forEach(function(x){x.classList.toggle('active',x===b);});
  $$('.view').forEach(function(x){x.classList.toggle('active',x.id==='v-'+v);});
  if(v==='home')renderHome();else if(v==='stats')renderStats();else if(v==='setup')renderSetup();
  window.scrollTo(0,0);
};});
$('#mprev').onclick=function(){curP=shiftP(curP,-1);renderAll();};
$('#mnext').onclick=function(){curP=shiftP(curP,1);renderAll();};

$('#v-home').addEventListener('click',function(e){
  var t=e.target.closest('[data-item],[data-del],[data-edit],[data-pay],[data-open-sheet],[data-logrec],[data-envf]');if(!t)return;
  if(t.dataset.item){var it=S.items.filter(function(x){return x.id===t.dataset.item;})[0];if(it)logItem(it);}
  else if(t.dataset.del){
    var ex=S.exp.filter(function(x){return x.id===t.dataset.del;})[0];
    delExpense(t.dataset.del);
    if(ex)showToast('Deleted <b>'+esc(ex.name||(catOf(ex.cat)||{name:'entry'}).name)+'</b> '+eur2(ex.amt),
      function(){untombstone(ex.id);S.exp.push(ex);save();renderAll();});
  }
  else if(t.dataset.edit)editExpense(t.dataset.edit);
  else if(t.dataset.pay)payFixed(t.dataset.pay);
  else if(t.dataset.logrec)logRecurring(t.dataset.logrec);
  else if(t.dataset.openSheet)openSheet(null);
  else if(t.dataset.envf){envFilter=envFilter===t.dataset.envf?null:t.dataset.envf;renderHome();}
});
function payFixed(cid){
  var c=catOf(cid);if(!c)return;
  var already=spentByCat(curP)[cid]||0,due=(+c.budget||0)-already;
  if(due<=0.01){showToast(esc(c.name)+' already covered');return;}
  tryAdd({cat:cid,name:c.name+' (bill)',qty:1,amt:due,date:logDateFor()},function(e){
    lastLogged=e;showToast('<b>'+esc(c.name)+'</b> marked paid '+eur(due),undoLast);
  });
}

/* ── Loan sheet ───────────────────────────────────────────── */
var loanDir='lent',loanEditId=null;
function setLoanDir(d){loanDir=d;
  $$('#l-dir button').forEach(function(b){var on=b.dataset.dir===d;b.classList.toggle('sel',on);b.classList.toggle('neg',on&&d==='borrowed');});}
function openLoanSheet(l){
  loanEditId=l?l.id:null;
  setLoanDir(l?l.dir:'lent');
  var seen={},opts='';
  (S.loans||[]).forEach(function(x){var p=(x.person||'').trim();if(p&&!seen[p.toLowerCase()]){seen[p.toLowerCase()]=1;opts+='<option value="'+esc(p)+'">';}});
  $('#l-people').innerHTML=opts;
  $('#l-person').value=l?(l.person||''):'';
  $('#l-amt').value=l?l.amt:'';
  $('#l-amt').style.borderColor='';
  $('#l-date').value=l?l.date:todayISO();
  $('#l-due').value=(l&&l.due)?l.due:'';
  $('#l-note').value=(l&&l.note)?l.note:'';
  $('#lsheet-title').textContent=l?'Edit IOU':'Lend / borrow';
  $('#scrim').classList.add('open');$('#lsheet').classList.add('open');
}
function closeLoanSheet(){loanEditId=null;$('#scrim').classList.remove('open');$('#lsheet').classList.remove('open');}
$('#add-loan').onclick=function(){openLoanSheet(null);};
$('#l-dir').addEventListener('click',function(e){var t=e.target.closest('[data-dir]');if(t)setLoanDir(t.dataset.dir);});
$('#l-save').onclick=function(){
  var amt=parseFloat($('#l-amt').value);
  if(!amt||amt<=0){$('#l-amt').focus();$('#l-amt').style.borderColor='var(--coral)';return;}
  var person=$('#l-person').value.trim()||'Someone';
  if(!S.loans)S.loans=[];
  if(loanEditId){
    var l=loanOf(loanEditId);
    if(l){l.dir=loanDir;l.person=person;l.amt=amt;l.date=$('#l-date').value||todayISO();l.due=$('#l-due').value||null;l.note=$('#l-note').value.trim();}
    closeLoanSheet();save();renderLoans();showToast('IOU updated');return;
  }
  S.loans.push({id:uid(),dir:loanDir,person:person,amt:amt,date:$('#l-date').value||todayISO(),due:$('#l-due').value||null,note:$('#l-note').value.trim(),pays:[],settled:null});
  closeLoanSheet();save();renderLoans();
  showToast(loanDir==='borrowed'
    ? 'Borrowed <b>'+eur2(amt)+'</b> from '+esc(person)+' — not counted as income'
    : 'Lent <b>'+eur2(amt)+'</b> to '+esc(person)+' — still yours');
};
/* repayment sheet: partial or full */
var payLoanId=null;
function openPaySheet(l){
  payLoanId=l.id;
  var rem=remainOf(l),isLent=l.dir!=='borrowed';
  $('#psheet-title').textContent=isLent?'Money back from '+(l.person||'someone'):'Pay back '+(l.person||'someone');
  $('#p-amt').value=Math.round(rem*100)/100;
  $('#p-amt').style.borderColor='';
  $('#p-date').value=todayISO();
  $('#p-hist').innerHTML=(l.pays||[]).map(function(p){
    return '<div class="stat-row" style="padding:8px 0"><span class="lab">'+(isLent?'Got back':'Paid back')+' · '+fmtDate(p.date)+'</span><span class="val num">'+eur2(p.amt)+'</span></div>';
  }).join('');
  $('#p-hint').textContent=eur2(rem)+' outstanding of '+eur2(+l.amt||0)+(isLent
    ? ' — repayments come back into your money, never counted as income.'
    : ' — paying back never counts as spending.');
  updatePayBtn();
  $('#scrim').classList.add('open');$('#psheet').classList.add('open');
}
function closePaySheet(){payLoanId=null;$('#scrim').classList.remove('open');$('#psheet').classList.remove('open');}
function updatePayBtn(){
  var l=loanOf(payLoanId);if(!l)return;
  var rem=remainOf(l),v=parseFloat($('#p-amt').value)||0,isLent=l.dir!=='borrowed';
  $('#p-save').textContent=v>=rem-0.005?'Settle in full':'Log '+eur2(v)+(isLent?' back':' paid');
}
$('#p-amt').oninput=function(){this.style.borderColor='';updatePayBtn();};
$('#p-half').onclick=function(){var l=loanOf(payLoanId);if(l){$('#p-amt').value=Math.round(remainOf(l)/2*100)/100;updatePayBtn();}};
$('#p-all').onclick=function(){var l=loanOf(payLoanId);if(l){$('#p-amt').value=Math.round(remainOf(l)*100)/100;updatePayBtn();}};
$('#p-save').onclick=function(){
  var l=loanOf(payLoanId);if(!l)return;
  var rem=remainOf(l),v=parseFloat($('#p-amt').value);
  if(!v||v<=0||v>rem+0.005){$('#p-amt').focus();$('#p-amt').style.borderColor='var(--coral)';return;}
  if(!l.pays)l.pays=[];
  var pay={amt:Math.min(v,rem),date:$('#p-date').value||todayISO()};
  l.pays.push(pay);
  var full=remainOf(l)<=0.005;
  if(full)l.settled=pay.date;
  closePaySheet();save();renderAll();
  var isLent=l.dir!=='borrowed';
  showToast(full
    ? 'Settled with <b>'+esc(l.person)+'</b> ✓'
    : (isLent?'Got <b>':'Paid <b>')+eur2(pay.amt)+'</b>'+(isLent?' back from ':' back to ')+esc(l.person)+' · '+eur2(remainOf(l))+' left',
    function(){l.pays.pop();l.settled=null;save();renderAll();});
};

$('#loan-card').addEventListener('click',function(e){
  if(e.target.id==='loan-sub'){showSettledLoans=!showSettledLoans;renderLoans();return;}
  var t=e.target.closest('[data-lpay],[data-ledit],[data-ldel]');if(!t)return;
  if(t.dataset.lpay){var lp=loanOf(t.dataset.lpay);if(lp)openPaySheet(lp);}
  else if(t.dataset.ledit){var le=loanOf(t.dataset.ledit);if(le)openLoanSheet(le);}
  else if(t.dataset.ldel){
    var id=t.dataset.ldel,ld=loanOf(id);
    S.loans=S.loans.filter(function(x){return x.id!==id;});tombstone(id);save();renderAll();
    if(ld)showToast('Deleted IOU with <b>'+esc(ld.person)+'</b> '+eur2(ld.amt),
      function(){untombstone(ld.id);S.loans.push(ld);save();renderAll();});
  }
});

$('#fab').onclick=function(){openSheet(null);};
$('#scrim').onclick=function(){closeSheet();closeLoanSheet();closePaySheet();};
$('#sheet-cats').addEventListener('click',function(e){var t=e.target.closest('[data-scat]');if(!t)return;
  sheetCat=t.dataset.scat;sheetItem=null;sheetUnit=0;
  $$('#sheet-cats .cp2').forEach(function(x){x.classList.toggle('sel',x.dataset.scat===sheetCat);});
  renderSug();});
$('#sheet-sug').addEventListener('click',function(e){var t=e.target.closest('[data-sug]');if(!t)return;
  var it=itm(t.dataset.sug);if(!it)return;
  sheetItem=it.id;sheetUnit=+it.price||0;
  $('#sh-name').value=it.name;
  syncSheetAmt();
  $$('#sheet-sug .chip').forEach(function(x){x.classList.toggle('sel',x.dataset.sug===sheetItem);});});
$('#q-minus').onclick=function(){var q=$('#sh-qty');q.value=Math.max(0.5,(+q.value||1)-1);syncSheetAmt();};
$('#q-plus').onclick=function(){var q=$('#sh-qty');q.value=(+q.value||0)+1;syncSheetAmt();};
$('#sh-qty').oninput=syncSheetAmt;
$('#sh-name').oninput=function(){ // typing a different name unlinks the catalog item
  var it=sheetItem&&itm(sheetItem);
  if(it&&this.value!==it.name){sheetItem=null;sheetUnit=0;$$('#sheet-sug .chip').forEach(function(x){x.classList.remove('sel');});}
};
$('#sh-name').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('#sh-amt').focus();}});
$('#sh-amt').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();$('#sh-save').click();}});
$('#sh-save').onclick=function(){
  var amt=parseFloat($('#sh-amt').value);
  if(!amt||amt<=0){$('#sh-amt').focus();$('#sh-amt').style.borderColor='var(--coral)';return;}
  var o={cat:sheetCat,item:sheetItem,name:$('#sh-name').value.trim(),qty:parseFloat($('#sh-qty').value)||1,amt:amt,date:$('#sh-date').value||logDateFor()};
  var eid=editingId;editingId=null;
  closeSheet();
  if(eid){
    var e=S.exp.filter(function(x){return x.id===eid;})[0];
    if(e){e.cat=o.cat;e.item=o.item;e.name=o.name;e.qty=o.qty;e.amt=o.amt;e.date=o.date;save();renderAll();showToast('Entry updated');}
    return;
  }
  tryAdd(o,function(e){lastLogged=e;showToast('Logged '+eur2(amt),undoLast);});
};

$('#cscrim').onclick=closeConfirm;
$('#cm-cancel').onclick=closeConfirm;
$('#cm-ok').onclick=function(){var cb=pendingConfirm;closeConfirm();if(cb)cb();};

function setupField(e,live){var t=e.target;
  if(t.dataset.cbud){var c=catOf(t.dataset.cbud);if(c){c.budget=parseFloat(t.value)||0;save();renderHome();}}
  else if(t.dataset.ramt){var r=rec(t.dataset.ramt);if(r){r.amount=parseFloat(t.value)||0;save();renderHome();}}
  else if(t.dataset.rnext){if(live)return;var r2=rec(t.dataset.rnext);if(r2&&t.value){r2.next=t.value;save();renderSetup();renderHome();}}
  else if(t.dataset.iprice){var ip=itm(t.dataset.iprice);if(ip){ip.price=parseFloat(t.value)||0;save();renderHome();}}
  else if(t.dataset.iplan){var il=itm(t.dataset.iplan);if(il){il.plan=parseFloat(t.value)||0;save();renderHome();}}
}
$('#v-setup').addEventListener('change',function(e){setupField(e,false);});
$('#v-setup').addEventListener('input',function(e){setupField(e,true);});
function rec(id){return (S.recurring||[]).filter(function(x){return x.id===id;})[0];}
function itm(id){return S.items.filter(function(x){return x.id===id;})[0];}
$('#v-setup').addEventListener('click',function(e){
  var t=e.target.closest('[data-crm],[data-irm],[data-rrm],[data-hard],[data-ovrm]');if(!t)return;
  if(t.dataset.hard){var c=catOf(t.dataset.hard);if(c){c.hard=!c.hard;save();renderSetup();renderHome();}}
  else if(t.dataset.crm){
    var cid=t.dataset.crm,cdel=catOf(cid);
    askConfirm('Delete envelope?',
      'Remove <b>'+esc(cdel?cdel.name:'this envelope')+'</b>? Its logged expenses stay in the ledger but lose their category.',
      function(){S.cats=S.cats.filter(function(c){return c.id!==cid;});save();renderSetup();renderHome();},'Delete');
  }
  else if(t.dataset.irm){S.items=S.items.filter(function(i){return i.id!==t.dataset.irm;});save();renderSetup();renderHome();}
  else if(t.dataset.rrm){S.recurring=S.recurring.filter(function(r){return r.id!==t.dataset.rrm;});save();renderSetup();renderHome();}
  else if(t.dataset.ovrm){if(S.cycleDays)delete S.cycleDays[t.dataset.ovrm];save();renderAll();}
});
$('#in-blocked').onchange=function(){S.income.blocked=parseFloat(this.value)||0;save();renderHome();};
$('#in-salary').onchange=function(){S.income.salary=parseFloat(this.value)||0;save();renderHome();};
$('#in-cycle').onchange=function(){S.cycleDay=Math.min(28,Math.max(1,parseInt(this.value)||25));curP=periodOf(todayISO());save();renderAll();};
$('#in-cycle-ov').onchange=function(){
  if(!S.cycleDays)S.cycleDays={};
  var v=parseInt(this.value);
  if(this.value===''||isNaN(v))delete S.cycleDays[curP];
  else S.cycleDays[curP]=Math.min(28,Math.max(1,v));
  save();renderAll();
};
$('#ov-reset').onclick=function(){if(S.cycleDays)delete S.cycleDays[curP];save();renderAll();};
$('#in-start').onchange=function(){if(this.value){S.goal.start=this.value;save();renderHome();}};
$('#in-months').onchange=function(){S.goal.months=parseInt(this.value)||4;save();renderHome();};
$('#in-saved0').onchange=function(){S.startSavings=parseFloat(this.value)||0;save();renderHome();};
['in-blocked','in-salary','in-start','in-months','in-saved0'].forEach(function(id){var el=$('#'+id);el.oninput=el.onchange;});
$('#add-cat').onclick=function(){
  var n=$('#nc-name').value.trim();if(!n)return;
  var pal=['#7C93FF','#B98CFF','#63D69A','#E8C77A','#E080B0','#E97365','#4FC8D6','#B0895C'];
  S.cats.push({id:uid(),name:n,budget:parseFloat($('#nc-bud').value)||0,kind:$('#nc-kind').value==='fixed'?'fixed':'var',color:pal[S.cats.length%pal.length],hard:false});
  $('#nc-name').value='';$('#nc-bud').value='';save();renderSetup();renderHome();
};
$('#add-item').onclick=function(){
  var n=$('#ni-name').value.trim();if(!n)return;
  S.items.push({id:uid(),name:n,cat:$('#ni-cat').value,price:parseFloat($('#ni-price').value)||0,plan:parseFloat($('#ni-plan').value)||1});
  $('#ni-name').value='';$('#ni-price').value='';$('#ni-plan').value='';save();renderSetup();renderHome();
};
$('#add-rec').onclick=function(){
  var n=$('#nr-name').value.trim();if(!n)return;
  if(!S.recurring)S.recurring=[];
  S.recurring.push({id:uid(),name:n,cat:$('#nr-cat').value,amount:parseFloat($('#nr-amt').value)||0,
    covers:parseInt($('#nr-cov').value)||1,unit:$('#nr-unit').value,n:parseInt($('#nr-n').value)||1,
    next:$('#nr-next').value||todayISO()});
  $('#nr-name').value='';$('#nr-amt').value='';$('#nr-cov').value='';$('#nr-n').value='';$('#nr-next').value='';
  save();renderSetup();renderHome();
};

$('#exp-csv').onclick=function(){
  var rows=[['date','cycle','category','item','qty','amount_eur','covers']];
  S.exp.slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(e){
    var c=catOf(e.cat)||{name:e.cat};
    rows.push([e.date,periodOf(e.date),c.name,(e.name||''),e.qty||1,(+e.amt||0).toFixed(2),e.covers||1]);
  });
  var csv=rows.map(function(r){return r.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  download('vault-expenses.csv','text/csv',csv);
};
$('#exp-ious').onclick=function(){
  var rows=[['date','direction','person','amount_eur','repaid_eur','outstanding_eur','due','settled','note']];
  (S.loans||[]).slice().sort(function(a,b){return a.date<b.date?-1:1;}).forEach(function(l){
    rows.push([l.date,l.dir==='borrowed'?'borrowed':'lent',l.person||'',(+l.amt||0).toFixed(2),paidOf(l).toFixed(2),remainOf(l).toFixed(2),l.due||'',l.settled||'',l.note||'']);
  });
  var csv=rows.map(function(r){return r.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  download('vault-ious.csv','text/csv',csv);
};
$('#exp-json').onclick=function(){download('vault-backup.json','application/json',JSON.stringify(S,null,2));};
$('#imp-json').onclick=function(){$('#imp-file').click();};
$('#imp-file').onchange=function(e){
  var f=e.target.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){try{var d=JSON.parse(r.result);if(d.cats){S=d;save();curP=periodOf(todayISO());renderAll();showToast('Backup imported');}else showToast('Not a valid backup');}catch(err){showToast('Could not read file');}};
  r.readAsText(f);
};
$('#reset-all').onclick=function(){
  if(confirm('Erase all budget data on this device? Export a backup first if unsure.')){
    localStorage.removeItem(KEY);S=defaults();curP=periodOf(todayISO());renderAll();showToast('Reset to defaults');
  }
};
$('#clear-cache').onclick=function(){
  if(confirm('Clear all saved data on this device and reload a fresh copy?')){
    Object.keys(localStorage).forEach(function(k){if(k.indexOf('asca_budget')===0)localStorage.removeItem(k);});
    location.reload();
  }
};
function download(name,type,data){
  var b=new Blob([data],{type:type}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u);},1000);
}

/* ── Lock screen flow ─────────────────────────────────────── */
var entered='', lockMode='enter', tempPin='';
function updateDots(){$$('#dots span').forEach(function(s,i){s.classList.toggle('on',i<entered.length);});}
function lockErr(msg){$('#lock-err').textContent=msg||'';if(msg){$('#lock').classList.add('shake');setTimeout(function(){$('#lock').classList.remove('shake');},420);}}
function setSub(t){$('#lock-sub').textContent=t;}
function showLock(mode){lockMode=mode;entered='';tempPin='';lockErr('');updateDots();
  setSub(mode==='create'?'Create a 4-digit PIN':mode==='change-new'?'Enter a new PIN':'Enter your PIN');
  $('#lock').classList.add('show');window.scrollTo(0,0);}
function hideLock(){$('#lock').classList.remove('show');}
/* Stay unlocked on this device: after a successful PIN entry the PIN is
   remembered (lightly obfuscated) so refreshes/relaunches skip the lock
   screen. "Lock now" forgets it and requires the PIN again. Storing the
   PIN on-device trades the casual-privacy shield for convenience. */
var UNLOCKKEY='asca_budget_unlock';
function rememberUnlock(pin){try{localStorage.setItem(UNLOCKKEY,btoa(pin));}catch(e){}}
function savedUnlock(){try{return atob(localStorage.getItem(UNLOCKKEY)||'');}catch(e){return '';}}
function bootLock(){
  var cfg=lockCfg();
  if(cfg){
    var saved=savedUnlock();
    if(saved&&hashStr(saved+'|'+cfg.salt)===cfg.hash){pinKey=saved;initApp();return;}
    showLock('enter');
  }else showLock('create');
}
function pressKey(k){
  if(k==='del'){entered=entered.slice(0,-1);lockErr('');updateDots();return;}
  if(entered.length>=4)return;
  entered+=k;updateDots();
  if(entered.length===4)setTimeout(submitPin,130);
}
function submitPin(){
  if(lockMode==='create'||lockMode==='change-new'){
    tempPin=entered;lockMode=(lockMode==='create')?'confirm':'change-confirm';
    entered='';updateDots();setSub('Confirm your PIN');return;
  }
  if(lockMode==='confirm'||lockMode==='change-confirm'){
    if(entered===tempPin){
      var changing=(lockMode==='change-confirm');
      setLockCfg(tempPin);pinKey=tempPin;rememberUnlock(tempPin);entered='';updateDots();
      if(changing){save();hideLock();showToast('PIN changed');}
      else{lockErr('');hideLock();initApp();}
    }else{
      showLock(lockMode==='change-confirm'?'change-new':'create');
      lockErr('PINs didn’t match — try again');
    }
    return;
  }
  var cfg=lockCfg();
  if(cfg&&hashStr(entered+'|'+cfg.salt)===cfg.hash){pinKey=entered;rememberUnlock(entered);entered='';updateDots();lockErr('');hideLock();initApp();}
  else{entered='';updateDots();lockErr('Wrong PIN');}
}
$('#keypad').addEventListener('click',function(e){var t=e.target.closest('[data-k]');if(t)pressKey(t.dataset.k);});
document.addEventListener('keydown',function(e){
  if($('#lock').classList.contains('show')){
    if(e.key>='0'&&e.key<='9')pressKey(e.key);
    else if(e.key==='Backspace')pressKey('del');
    return;
  }
  if(e.key==='Escape'){closeSheet();closeLoanSheet();closePaySheet();closeConfirm();}
});
$('#lock-reset').onclick=function(){
  if(confirm('Reset the app? This erases all data on this device and sets a new PIN.')){
    Object.keys(localStorage).forEach(function(k){if(k.indexOf('asca_budget')===0)localStorage.removeItem(k);});
    location.reload();
  }
};
$('#lock-now').onclick=function(){try{localStorage.removeItem(UNLOCKKEY);}catch(e){}pinKey=null;showLock('enter');};
$('#change-pin').onclick=function(){showLock('change-new');};

bootLock();
})();
