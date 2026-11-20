/* Shared cloze feedback classifier and inline diff highlighter.
   No AI: only surface-level differences with conservative spelling heuristics are "minor".
   The original exact-recall score is deliberately unchanged. */
(function(root){
"use strict";
const normalize=s=>String(s||"").normalize("NFKC")
 .replace(/[\u2018\u2019\u02bc\u201b\uFF07]/g,"'")
 .replace(/[\u201c\u201d]/g,'"')
 .replace(/[\u2010-\u2015\u2212]/g,"-")
 .replace(/[\u00a0\u2007\u202f]/g," ")
 .replace(/\s+/g," ").trim();
const safe=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
 .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const tokens=s=>normalize(s).match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu)||[];
const cleanWord=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const stopwords=new Set(("a an and are as at be been being but by can cannot could did do does for from had has have he her hers his how i if in into is it its may might must no not of on or our ours out she should so such than that the their theirs them there these they this those to was were what when where which who whom why will with would you your yours").split(" "));
const realPairs=new Set(["could|would","might|night","where|there","form|from","quite|quiet","trail|trial","casual|causal","affect|effect","accept|except","then|than","whether|weather","specially|especially","lose|loose","stationary|stationery","personal|personnel","principal|principle","complement|compliment","capital|capitol","pubic|public","than|then","desert|dessert","later|latter","dairy|diary","their|there"]);
const pairs=new Set(["color|colour","colors|colours","colored|coloured","coloring|colouring","favorite|favourite","honor|honour","humor|humour","labor|labour","neighbor|neighbour","center|centre","theater|theatre","meter|metre","liter|litre","organize|organise","realize|realise","analyze|analyse","recognize|recognise","defense|defence","offense|offence","license|licence","traveling|travelling","traveled|travelled","canceled|cancelled","modeling|modelling","gray|grey","judgment|judgement"]);
const typoPairs=new Set(["recieve|receive","teh|the","definately|definitely","seperate|separate","occured|occurred","goverment|government","maintenence|maintenance","neccessary|necessary","responsibilites|responsibilities","achievment|achievement","acheivement|achievement","enviroment|environment"]);
const pair=(a,b)=>[a,b].sort().join("|");
function edits(a,b){
 const x=[...a],y=[...b];
 if(Math.abs(x.length-y.length)>1)return 9;
 const dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0));
 for(let i=0;i<=x.length;i++)dp[i][0]=i;
 for(let j=0;j<=y.length;j++)dp[0][j]=j;
 for(let i=1;i<=x.length;i++)for(let j=1;j<=y.length;j++){
  dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(x[i-1]===y[j-1]?0:1));
  if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1])
   dp[i][j]=Math.min(dp[i][j],dp[i-2][j-2]+1);
 }
 return dp[x.length][y.length];
}
function isLikelyTypo(a,b){
 const x=cleanWord(a),y=cleanWord(b);
 if(x===y)return false;
 const p=pair(x,y);
 if(typoPairs.has(p))return true;
 if(realPairs.has(p)||stopwords.has(x)||stopwords.has(y))return false;
 if(Math.min(x.length,y.length)<7)return false;
 if(/(?:s|ed|ing|er|est|ly)$/.test(x)&&!/(?:s|ed|ing|er|est|ly)$/.test(y))return false;
 if(/(?:s|ed|ing|er|est|ly)$/.test(y)&&!/(?:s|ed|ing|er|est|ly)$/.test(x))return false;
 if((x.endsWith("s")&&x.slice(0,-1)===y)||(y.endsWith("s")&&y.slice(0,-1)===x))return false;
 if((x.endsWith("ed")&&x.slice(0,-2)===y)||(y.endsWith("ed")&&y.slice(0,-2)===x))return false;
 return edits(x,y)===1;
}
function coordinatedReorderingOnly(answer,expected){
 // Treat as minor only an actual AND/OR enumeration with identical whole items.
 // Arbitrary word permutations and missing/added list items remain non-minor.
 function positions(s){
  return Array.from(normalize(s).matchAll(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu),m=>({
   key:cleanWord(m[0]),start:m.index,end:m.index+m[0].length
  }));
 }
 function splitList(s){
  s=normalize(s).toLowerCase().replace(/,\s*(and|or)\b/g," $1");
  const links=[...s.matchAll(/\b(and|or)\b/g)].map(m=>m[1]);
  if(!links.length||links.some(v=>v!==links[0]))return null;
  const parts=s.split(/\s*(?:,|\b(?:and|or)\b)\s*/).map(p=>p.trim());
  if(parts.length<2||parts.some(p=>!p))return null;
  const items=parts.map(p=>tokens(p).map(cleanWord).join(" ")); 
  if(items.some(x=>!x))return null;
  return {conjunction:links[0],items};
 }
 function permutation(a,b){
  const x=splitList(a),y=splitList(b);
  if(!x||!y||x.conjunction!==y.conjunction||x.items.length!==y.items.length)return false;
  if(x.items.every((v,i)=>v===y.items[i]))return false;
  const counts=new Map();
  for(const v of x.items)counts.set(v,(counts.get(v)||0)+1);
  for(const v of y.items){
   if(!(counts.get(v)>0))return false;
   counts.set(v,counts.get(v)-1);
  }
  return [...counts.values()].every(v=>v===0);
 }
 if(permutation(answer,expected))return true;
 // Allow the enumeration to be embedded in otherwise identical surrounding text.
 const a=normalize(answer),b=normalize(expected),aw=positions(a),bw=positions(b);
 let start=0;
 while(start<aw.length&&start<bw.length&&aw[start].key===bw[start].key)start++;
 let aEnd=aw.length,bEnd=bw.length;
 while(aEnd>start&&bEnd>start&&aw[aEnd-1].key===bw[bEnd-1].key){aEnd--;bEnd--;}
 if(start>=aEnd||start>=bEnd)return false;
 return permutation(a.slice(aw[start].start,aw[aEnd-1].end),
                    b.slice(bw[start].start,bw[bEnd-1].end));
}
function classify(answer,expected){
 const a=normalize(answer),b=normalize(expected);
 if(a===b)return {kind:"exact",reason:"Exact match"};
 const wa=tokens(a),wb=tokens(b);
 const lc=s=>s.toLowerCase();
 // Exact word sequence with only capitalization/punctuation/spacing differences.
 if(wa.length===wb.length&&wa.every((w,i)=>cleanWord(w)===cleanWord(wb[i]))){
  if(a.toLowerCase()===b.toLowerCase())return {kind:"minor",reason:"Capitalization only"};
  return {kind:"minor",reason:"Punctuation or spacing"};
 }
 if(coordinatedReorderingOnly(a,b))return {kind:"minor",reason:"List order only"};
 // Common US/UK variants are textually different, but semantically equivalent.
 if(wa.length===wb.length&&wa.some((w,i)=>w.toLowerCase()!==wb[i].toLowerCase())&&
   wa.every((w,i)=>cleanWord(w)===cleanWord(wb[i])||pairs.has(pair(cleanWord(w),cleanWord(wb[i])))))
  return {kind:"minor",reason:"Spelling variant"};
 // Conservative typo heuristic: do not classify changed function words or modals as minor.
 if(wa.length===wb.length){
  let count=0,possible=true;
  for(let i=0;i<wa.length;i++){
   if(cleanWord(wa[i])===cleanWord(wb[i]))continue;
   count++;
   if(count>2||!isLikelyTypo(wa[i],wb[i])){possible=false;break;}
  }
  if(possible&&count>0)return {kind:"minor",reason:"Likely spelling typo"};
 }
 return {kind:"major",reason:"Wording difference (meaning not automatically assessed)"};
}
function chunks(s){
 // Preserve whitespace, and keep punctuation attached to visible word tokens.
 return String(s??"").split(/(\s+)/).filter(x=>x.length>0);
}
function highlight(answer,expected){
 const originals=chunks(expected),users=chunks(answer);
 const x=originals.filter(t=>t.trim()),y=users.filter(t=>t.trim());
 if(x.length*y.length>50000)return {answer:safe(answer),expected:safe(expected)};
 const n=x.length,m=y.length;
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 const equal=(a,b)=>normalize(a).toLowerCase()===normalize(b).toLowerCase();
 // Dynamic edit-distance alignment: inserted words are marked in the learner response,
 // omitted words are marked in the original.
 for(let i=n;i>=0;i--)for(let j=m;j>=0;j--){
  if(i===n)dp[i][j]=m-j;
  else if(j===m)dp[i][j]=n-i;
  else if(equal(x[i],y[j]))dp[i][j]=dp[i+1][j+1];
  else dp[i][j]=1+Math.min(dp[i+1][j+1],dp[i+1][j],dp[i][j+1]);
 }
 const wrongX=new Set(),wrongY=new Set();
 let i=0,j=0;
 while(i<n||j<m){
  if(i<n&&j<m&&equal(x[i],y[j])&&dp[i][j]===dp[i+1][j+1]){
   if(normalize(x[i])!==normalize(y[j])){wrongX.add(i);wrongY.add(j);}
   i++;j++;continue;
  }
  const sub=i<n&&j<m?dp[i+1][j+1]:1e6,del=i<n?dp[i+1][j]:1e6,ins=j<m?dp[i][j+1]:1e6;
  const v=Math.min(sub,del,ins);
  if(v===sub){wrongX.add(i++);wrongY.add(j++);}
  else if(v===del)wrongX.add(i++);
  else wrongY.add(j++);
 }
 const render=(source,bad)=>{
  let k=0;
  return source.map(t=>{
   if(!t.trim())return safe(t);
   const flagged=bad.has(k++);
   return flagged?'<strong class="cloze-diff-word">'+safe(t)+'</strong>':safe(t);
  }).join('');
 };
 return {answer:render(users,wrongY),expected:render(originals,wrongX),
   differences:wrongX.size+wrongY.size};
}
root.ClozeFeedback={classify,highlight,normalize};
})(typeof window!=="undefined"?window:globalThis);
