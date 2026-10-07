const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);}
const sandbox={Intl,Map,Set};
vm.createContext(sandbox);
vm.runInContext(between('const products =','let toastTimer;')+
 between('function sanitizeCart(', 'const savedFavorites')+
 between('function validOrder(', 'state.lastOrder =')+
 between('function orderPayload(', 'function downloadOrder(')+
 ';this.api={products,catalog,clampQuantity,sanitizeCart,validOrder,escape,orderPayload};',sandbox);
const {api}=sandbox;
const plain=v=>JSON.parse(JSON.stringify(v));
test('application parses and has no external runtime resources',()=>{
 new vm.Script(source);
 assert(!/<script[^>]+src=["']https?:/i.test(html));
 assert(!/@import|url\(\s*["']?https?:/i.test(fs.readFileSync(path.join(root,'style.css'),'utf8')));
 for(const match of html.matchAll(/(?:src|href)=["']([^"'#][^"']*)["']/g)){
   if(!match[1].includes('://')) assert(fs.existsSync(path.join(root,match[1])),match[1]);
 }
});
test('quantity stays between one and ten',()=>{
 for(const [v,e] of [[0,1],[-2,1],[1.8,1],[11,10],[Infinity,10],['oops',1],['3',3]]) assert.equal(api.clampQuantity(v),e);
});
test('cart rejects malformed and unknown values and caps counts',()=>{
 for(const v of [null,[],false,'oops']) assert.deepEqual(plain(api.sanitizeCart(v)),{});
 assert.deepEqual(plain(api.sanitizeCart({atlas:99,nova:2,arc:-1,unknown:1})),{atlas:10,nova:2});
 assert.deepEqual(plain(api.sanitizeCart({atlas:'2',nova:1.2})),{});
});
const order={number:'RL-20000101-ABCD',createdAt:'2000-01-01T00:00:00.000Z',items:[{id:'atlas',quantity:2},{id:'nova',quantity:1}]};
test('orders require a valid id, timestamp, unique known items and bounded counts',()=>{
 assert.deepEqual(plain(api.validOrder(order)),order);
 for(const bad of [null,{}, {...order,number:'<x>'},{...order,createdAt:'invalid'},{...order,items:[]},
 {...order,items:[{id:'other',quantity:1}]},{...order,items:[{id:'atlas',quantity:11}]},
 {...order,items:[{id:'atlas',quantity:1},{id:'atlas',quantity:2}]}]) assert.equal(api.validOrder(bad),null);
});
test('demo payload calculates 1398 plus 299 without trusting stored prices',()=>{
 const result=api.orderPayload({...order,total:1});
 assert.equal(result.type,'local-demo-order');assert.equal(result.currency,'CNY');
 assert.equal(result.total,1697);assert.equal(result.items[0].unitPrice,699);
});
test('display escaping covers HTML-sensitive characters',()=>{
 assert.equal(api.escape('<>&"\''),'&lt;&gt;&amp;&quot;&#39;');
});
test('HTML identifiers are unique and PNGs have no text/EXIF metadata or trailing payload',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const name of ['atlas','nova','arc']){
  const data=fs.readFileSync(path.join(root,'assets',name+'.png'));
  assert(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let p=8,ended=false;
  while(p<data.length){
   const size=data.readUInt32BE(p),type=data.toString('ascii',p+4,p+8);
   // caBX holds reviewed C2PA generation provenance; preserve the original attribution.
   assert(['IHDR','IDAT','IEND','sRGB','gAMA','pHYs','caBX'].includes(type),'unexpected PNG chunk '+type);
   if(type==='caBX') assert(!/[A-Z]:[\\/]Users[\\/]|chatgpt\.site|appgprj_|localhost|127\.0\.0\.1/i.test(data.subarray(p+8,p+8+size).toString('utf8')));
   assert(p+size+12<=data.length);p+=size+12;
   if(type==='IEND'){ended=true;break;}
  }
  assert(ended);assert.equal(p,data.length);
 }
});
