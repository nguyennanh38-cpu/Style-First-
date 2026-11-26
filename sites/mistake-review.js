/* Shared, dependency-free cloze builder for reviewing mistakes in a checked answer.
   The learner's original essay and scores remain untouched. */
(function(root){
'use strict';
const WORD=/[\p{L}\p{N}]+(?:['’ʼ\u2010-\u2015\-][\p{L}\p{N}]+)*/gu;
function words(input){
 const s=String(input||'');
 return Array.from(s.matchAll(WORD),m=>({text:m[0],start:m.index,end:m.index+m[0].length,key:normalize(m[0])}));
}
function normalize(s){
 return String(s).normalize('NFKC').replace(/[\u2018\u2019\u02bc\u201b\uFF07]/g,"'").replace(/[\u2010-\u2015\u2212]/g,'-').toLowerCase();
}
function answerMatches(input,target){
 const a=words(input).map(w=>w.key),b=words(target).map(w=>w.key);
 return a.length===b.length&&a.every((w,i)=>w===b[i]);
}
function buildLegacy(original,submitted){
 const text=String(original||''),a=words(text),b=words(submitted);
 if(!a.length)return {parts:[{type:'text',text}],blanks:[],extra:[]};
 const n=a.length,m=b.length;
 if(n*m>1_000_000)return {parts:[{type:'text',text}],blanks:[],extra:[],tooLong:true};
 // Edit distance avoids unstable false highlights caused by greedy matching of repeated words.
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n;i>=0;i--)for(let j=m;j>=0;j--){
   if(i===n)dp[i][j]=m-j;
   else if(j===m)dp[i][j]=n-i;
   else if(a[i].key===b[j].key)dp[i][j]=dp[i+1][j+1];
   else dp[i][j]=1+Math.min(dp[i+1][j+1],dp[i+1][j],dp[i][j+1]);
 }
 const mask=new Uint8Array(n),mistakes=new Uint8Array(n),extras=[];
 let i=0,j=0;
 while(i<n||j<m){
   if(i<n&&j<m&&a[i].key===b[j].key&&dp[i][j]===dp[i+1][j+1]){i++;j++;continue;}
   const sub=i<n&&j<m?dp[i+1][j+1]:Infinity;
   const remove=i<n?dp[i+1][j]:Infinity;
   const insert=j<m?dp[i][j+1]:Infinity;
   const minimum=Math.min(sub,remove,insert);
   if(minimum===sub){mask[i]=1;mistakes[i]=1;i++;j++;}
   else if(minimum===remove){mask[i]=1;mistakes[i]=1;i++;}
   else{
     // Pure extra words need a cloze too: mask a short neighboring original phrase.
     extras.push(b[j].text);
     if(i>0)mask[i-1]=1;
     if(i<n)mask[i]=1;
     j++;
   }
 }
 const spans=[];
 for(let k=0;k<n;){
   if(!mask[k]){k++;continue;}
   let end=k+1;
   while(end<n&&mask[end]&&end-k<7&&!/\n\s*\n|[.!?][\s\n]/.test(text.slice(a[end-1].end,a[end].start)))end++;
   spans.push({from:k,to:end});
   k=end;
 }
 const blanks=[],parts=[];let cursor=0;
 for(const segment of spans){
   const first=a[segment.from],last=a[segment.to-1];
   if(first.start>cursor)parts.push({type:'text',text:text.slice(cursor,first.start)});
   const expected=text.slice(first.start,last.end),index=blanks.length+1;
   blanks.push({index,expected,wordCount:segment.to-segment.from});
   parts.push({type:'blank',index,expected,wordCount:segment.to-segment.from});
   cursor=last.end;
 }
 parts.push({type:'text',text:text.slice(cursor)});
 return {parts,blanks,extra:extras,errorWords:a.filter((w,k)=>mistakes[k]).map(w=>({start:w.start,end:w.end}))};
}
function build(original,submitted){
 const text=String(original||''),a=words(text),b=words(submitted);
 if(!a.length)return {parts:[{type:'text',text}],blanks:[],extra:[]};
 const n=a.length,m=b.length;
 if(n*m>1_000_000)return {parts:[{type:'text',text}],blanks:[],extra:[],tooLong:true};
 // Longest common subsequence: preserve every matched word; extra words are reported separately.
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
   dp[i][j]=a[i].key===b[j].key?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const mask=new Uint8Array(n),mistakes=mask,extras=[];
 let i=0,j=0;
 while(i<n&&j<m){
   if(a[i].key===b[j].key){i++;j++;}
   else if(dp[i+1][j]>=dp[i][j+1]){mask[i++]=1;}
   else extras.push(b[j++].text);
 }
 while(i<n)mask[i++]=1;
 while(j<m)extras.push(b[j++].text);
 const spans=[];
 for(let k=0;k<n;){
   if(!mask[k]){k++;continue;}
   let end=k+1;
   while(end<n&&mask[end]&&end-k<7&&!/\n\s*\n|[.!?][\s\n]/.test(text.slice(a[end-1].end,a[end].start)))end++;
   spans.push({from:k,to:end});
   k=end;
 }
 const blanks=[],parts=[];let cursor=0;
 for(const segment of spans){
   const first=a[segment.from],last=a[segment.to-1];
   if(first.start>cursor)parts.push({type:'text',text:text.slice(cursor,first.start)});
   const expected=text.slice(first.start,last.end),index=blanks.length+1;
   blanks.push({index,expected,wordCount:segment.to-segment.from});
   parts.push({type:'blank',index,expected,wordCount:segment.to-segment.from});
   cursor=last.end;
 }
 parts.push({type:'text',text:text.slice(cursor)});
 return {parts,blanks,extra:extras,errorWords:a.filter((w,k)=>mistakes[k]).map(w=>({start:w.start,end:w.end}))};
}
root.MistakeReview={build,buildLegacy,answerMatches,normalize};
})(typeof globalThis!=='undefined'?globalThis:this);
