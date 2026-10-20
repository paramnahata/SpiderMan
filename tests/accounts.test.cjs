const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map(), storage = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {textContent:'',hidden:false,addEventListener(){},replaceChildren(){},append(){},showModal(){},close(){}});
  return elements.get(id);
}
const context = {
  document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>element('row'),createTextNode:text=>text},
  window:{Enemy:function(){},addEventListener(){}},
  game:{gameover(){},score:0},ready:false,
  navigator:{onLine:true},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  setTimeout:()=>1,clearTimeout(){},console
};
context.window.Enemy.prototype.remove=function(){};
vm.createContext(context);
const source=fs.readFileSync('accounts.js','utf8').replace(/initialize\(\);\s*$/, '');
vm.runInContext(source, context);
async function run() {
  vm.runInContext('record(8); record(3); record(-1); record(NaN);',context);
  assert.equal(storage.get('spiderman-device-best'),'8');
  assert.equal(storage.size,1,'guest scores must not enter account storage');
  vm.runInContext("user={uid:'accountA'}; record(5);",context);
  assert.equal(storage.get('spiderman-pending-accountA'),'5');
  vm.runInContext("user={uid:'accountB'}; sessionBest=0; record(2);",context);
  assert.equal(storage.get('spiderman-pending-accountB'),'2');
  assert.equal(storage.get('spiderman-pending-accountA'),'5');
  context.cloudBest=10;context.writes=[];
  vm.runInContext(`db={}; store={doc:()=>({}),serverTimestamp:()=>123,runTransaction:async(db,callback)=>callback({get:async()=>({exists:()=>true,data:()=>({bestScore:cloudBest})}),set:(ref,data)=>writes.push(data)})};`,context);
  await vm.runInContext('syncBest()',context);
  assert.equal(context.writes.length,0,'lower local score must not replace higher cloud best');
  assert.equal(storage.get('spiderman-pending-accountB'),'0');
  vm.runInContext('record(15)',context);await vm.runInContext('syncBest()',context);
  assert.equal(context.writes[0].bestScore,15);
  assert.equal(Object.hasOwn(context.writes[0],'email'),false);
  vm.runInContext('record(20); navigator.onLine=false;',context);await vm.runInContext('syncBest()',context);
  assert.equal(storage.get('spiderman-pending-accountB'),'20','offline pending score must survive');
  vm.runInContext('navigator.onLine=true; store.runTransaction=async()=>{throw Error("network")}',context);await vm.runInContext('syncBest()',context);
  assert.equal(storage.get('spiderman-pending-accountB'),'20','failed upload must remain retryable');
  console.log('Passed: local best, guest isolation, account isolation, monotonic cloud merge, public fields, offline queue and failed-sync retry.');
}
run().catch(error=>{console.error(error);process.exitCode=1});

