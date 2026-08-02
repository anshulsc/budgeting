/* ── Firebase cloud sync — same backend as the Asca Gym app ──
   Same Firebase project (asca-gym), same username→email auth
   accounts, spoken to over plain REST exactly like the gym
   tracker's FirebaseSync module. This app owns ONE node at
   budget/{userId} = { uid, ts, name, data: {…the whole state S} },
   private to its owner (the RTDB rules deny reads by other
   accounts — budgets are not social). localStorage stays the
   on-device cache; the PIN lock and its encryption are untouched. */
var FB=(function(){
  var API_KEY='AIzaSyCAvGn9blvhx-sGINHwbasYcx8LH1A-4mk';
  var RTDB_URL='https://asca-gym-default-rtdb.firebaseio.com';
  var DOMAIN='asca-gym.app';           // usernames → synthetic emails, as in the gym app
  var AUTH_KEY='asca_budget_auth';     // tokens + user info (own key: different origin than the gym app)
  var auth=null;
  function loadAuth(){try{auth=JSON.parse(localStorage.getItem(AUTH_KEY))||null;}catch(e){auth=null;}return auth;}
  function saveAuth(){try{if(auth)localStorage.setItem(AUTH_KEY,JSON.stringify(auth));else localStorage.removeItem(AUTH_KEY);}catch(e){}}
  function toEmail(name){
    name=(name||'').trim().toLowerCase();
    if(name.indexOf('@')>=0)return name;
    if(!/^[a-z0-9._-]+$/.test(name))throw new Error('Usernames can only use letters, numbers, dots, dashes and underscores');
    return name+'@'+DOMAIN;
  }
  function uname(){return auth?String(auth.email||'').split('@')[0]:'';}
  function setTok(d){
    auth={uid:d.localId||d.user_id||(auth&&auth.uid)||'',
      email:d.email||(auth&&auth.email)||'',
      idToken:d.idToken||d.id_token,
      refreshToken:d.refreshToken||d.refresh_token,
      exp:Date.now()+((parseInt(d.expiresIn||d.expires_in||3600,10)-120)*1000)};
    saveAuth();return auth;
  }
  function errMsg(code){
    var map={EMAIL_NOT_FOUND:'No account with that username',INVALID_PASSWORD:'Wrong password',
      INVALID_LOGIN_CREDENTIALS:'Wrong username or password',EMAIL_EXISTS:'That username is already taken',
      WEAK_PASSWORD:'Password must be at least 6 characters',INVALID_EMAIL:'That username is not valid',
      USER_DISABLED:'This account has been disabled',TOO_MANY_ATTEMPTS_TRY_LATER:'Too many attempts — try again later'};
    var k=String(code||'').split(' ')[0].split(':')[0];
    return map[k]||('Sign-in failed: '+code);
  }
  function idCall(ep,body){
    return fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+ep+'?key='+encodeURIComponent(API_KEY),
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(errMsg(d.error&&d.error.message));return d;});});
  }
  function signIn(u,p){return idCall('signInWithPassword',{email:toEmail(u),password:p,returnSecureToken:true}).then(setTok);}
  function signUp(u,p){return idCall('signUp',{email:toEmail(u),password:p,returnSecureToken:true}).then(setTok);}
  function signOut(){auth=null;saveAuth();}
  // Coalesce concurrent refreshes so we never race-rotate the refresh token
  var refreshing=null;
  function refresh(){
    if(!auth||!auth.refreshToken)return Promise.reject(new Error('Not signed in'));
    if(refreshing)return refreshing;
    var p=fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(API_KEY),
      {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
       body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(auth.refreshToken)})
      .then(function(r){return r.json().then(function(d){
        if(!r.ok){signOut();throw new Error('Session expired — sign in again');}
        return setTok(d);});});
    refreshing=p;
    p.catch(function(){}).then(function(){if(refreshing===p)refreshing=null;});
    return p;
  }
  function token(){
    if(!auth)loadAuth();
    if(!auth)return Promise.reject(new Error('Not signed in'));
    if(Date.now()>=(auth.exp||0))return refresh().then(function(){return auth.idToken;});
    return Promise.resolve(auth.idToken);
  }
  // Restore a persisted session on unlock. Resolves to the user,
  // 'offline' (saved session but no network), or null (must sign in).
  function restore(){
    loadAuth();
    if(!auth||!auth.refreshToken)return Promise.resolve(null);
    if(Date.now()<(auth.exp||0))return Promise.resolve(user());
    return refresh().then(user,function(){return auth?'offline':null;});
  }
  function user(){if(!auth)loadAuth();return auth?{uid:auth.uid,email:auth.email,username:uname()}:null;}
  function nodeId(){return uname().replace(/[.#$\[\]\/]/g,'_');} // usernames may hold '.', RTDB keys may not
  // RTDB has no real arrays: sparse ones come back as numeric-keyed objects, empty ones vanish
  function toArr(v){
    if(Array.isArray(v))return v;
    if(v&&typeof v==='object')return Object.keys(v).sort(function(a,b){return a-b;}).map(function(k){return v[k];});
    return [];
  }
  function normalize(d){
    if(!d||typeof d!=='object')return null;
    return {
      income:{blocked:(d.income&&+d.income.blocked)||0,salary:(d.income&&+d.income.salary)||0},
      cycleDay:+d.cycleDay||25,
      cycleDays:(d.cycleDays&&typeof d.cycleDays==='object')?d.cycleDays:{},
      startSavings:+d.startSavings||0,
      goal:(d.goal&&typeof d.goal==='object')?{start:d.goal.start||'',months:+d.goal.months||4}:{start:'',months:4},
      cats:toArr(d.cats),
      items:toArr(d.items),
      recurring:toArr(d.recurring),
      del:(d.del&&typeof d.del==='object')?d.del:{},   // deletion tombstones {id: ts}
      loans:normDated(d.loans).map(function(l){l=l||{};l.pays=toArr(l.pays);return l;}),
      exp:normDated(d.exp)
    };
  }
  // Dated records (expenses, IOUs) are stored month-wise then date-wise,
  // each under its own id — { "YYYY-MM": { "YYYY-MM-DD": { id: {…} } } } —
  // so every transaction is directly browsable in the RTDB console, the
  // same idea as the gym app's date-keyed workouts. The in-app shape
  // stays a flat array; these two convert on push ⇄ pull.
  function datedToMap(list){
    var m={};
    (list||[]).forEach(function(e){
      if(!e||!e.date||!e.id)return;
      var mo=String(e.date).slice(0,7);
      var rec={},k;
      for(k in e)if(k!=='date'&&k!=='id'&&e[k]!=null)rec[k]=e[k];
      if(!m[mo])m[mo]={};
      if(!m[mo][e.date])m[mo][e.date]={};
      m[mo][e.date][e.id]=rec;
    });
    return m;
  }
  function datedToArray(map){
    var out=[];
    if(!map||typeof map!=='object')return out;
    Object.keys(map).sort().forEach(function(mo){
      var days=map[mo];if(!days||typeof days!=='object')return;
      Object.keys(days).sort().forEach(function(date){
        var recs=days[date];if(!recs||typeof recs!=='object')return;
        Object.keys(recs).forEach(function(id){
          var e=recs[id]||{},o={id:id,date:date},k;
          for(k in e)o[k]=e[k];
          out.push(o);
        });
      });
    });
    return out;
  }
  // Accepts both shapes on read: the month/date map (current), or a plain
  // array / numeric-keyed object (docs pushed by the first build).
  function normDated(v){
    if(!v)return [];
    if(Array.isArray(v))return v;
    var keys=Object.keys(v);
    if(keys.length&&keys.every(function(k){return /^\d+$/.test(k);}))return toArr(v);
    return datedToArray(v);
  }
  function readTs(){ // cheap freshness probe: just my node's ts
    return token().then(function(t){
      return fetch(RTDB_URL+'/budget/'+encodeURIComponent(nodeId())+'/ts.json?auth='+t);
    }).then(function(r){return r.ok?r.json():0;}).then(function(v){return +v||0;});
  }
  function pull(){ // read my node; resolves {ts, state} or null when it doesn't exist yet
    return token().then(function(t){
      return fetch(RTDB_URL+'/budget/'+encodeURIComponent(nodeId())+'.json?auth='+t);
    }).then(function(r){
      if(r.status===401||r.status===403)throw new Error('access denied — the budget/ database rules may not be published yet');
      if(!r.ok)throw new Error('Database responded '+r.status);
      return r.json();
    }).then(function(d){
      if(!d)return null;
      return {ts:+d.ts||0,state:normalize(d.data)};
    });
  }
  function push(state,ts){ // create-or-overwrite budget/{id}
    return token().then(function(t){
      var data={},k;
      for(k in state)if(k!=='exp'&&k!=='loans')data[k]=state[k];
      data.exp=datedToMap(state.exp);     // month → date → id, console-browsable
      data.loans=datedToMap(state.loans);
      var body={uid:auth.uid,ts:ts||Date.now(),name:uname().slice(0,60),data:data};
      return fetch(RTDB_URL+'/budget/'+encodeURIComponent(nodeId())+'.json?auth='+t,
        {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    }).then(function(r){
      if(r.status===401||r.status===403)throw new Error('write denied — publish the updated database rules (budget/ section)');
      if(!r.ok)throw new Error('Database responded '+r.status);
      return true;
    });
  }
  loadAuth();
  return {signIn:signIn,signUp:signUp,signOut:signOut,restore:restore,user:user,pull:pull,push:push,readTs:readTs,nodeId:nodeId};
})();
