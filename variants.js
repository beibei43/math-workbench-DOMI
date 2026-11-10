/* 举一反三 · 本地变式题题库（离线可用）
   每道题的答案都由程序按题目里的数字现算出来，不写死、不瞎编。
   没有模板的专题，自动退回该专题「典型例题」，并明确标注来源。 */
(function(root){
'use strict';

var R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
var pick=a=>a[R(0,a.length-1)];
var NUM=n=>String(Math.round(n*1e6)/1e6);
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=a%b;a=b;b=t;}return a||1;}
function F(n,d){if(!d)return'0';var g=gcd(n,d);n/=g;d/=g;if(d<0){n=-n;d=-d;}return d===1?String(n):n+'/'+d;}
function coprime(d){var a=[];for(var i=1;i<d;i++)if(gcd(i,d)===1)a.push(i);return a.length?pick(a):1;}

var BANK = {
  '盈亏': [function(){
    var n=R(4,12), a=R(3,7), c=a+R(1,4), maxb=n*(c-a)-1;
    var b=R(1,Math.max(1,Math.min(9,maxb))), T=a*n+b, d=c*n-T;
    return {q:'老师给小朋友分糖：每人分 '+a+' 颗，多出 '+b+' 颗；每人分 '+c+' 颗，少 '+d+' 颗。一共有几个小朋友？多少颗糖？',
      ans:n+' 人，'+T+' 颗糖',
      sol:['两次分配，每人相差 '+c+' − '+a+' = '+(c-a)+' 颗。','从「多 '+b+' 颗」到「少 '+d+' 颗」，总共相差 '+(b+d)+' 颗。','人数 = 总差 ÷ 每人差 = '+(b+d)+' ÷ '+(c-a)+' = '+n+' 人。','糖数代回第一种方案：'+a+' × '+n+' + '+b+' = '+T+' 颗。','验算第二种：'+c+' × '+n+' − '+d+' = '+T+' 颗，对上了。']};
  }],
  '等差数列': [function(){
    var a1=R(2,9), d=R(2,7), n=R(8,20), an=a1+(n-1)*d, S=(a1+an)*n/2;
    return {q:'一列数 '+a1+', '+(a1+d)+', '+(a1+2*d)+', …，按这个规律排下去，第 '+n+' 项是多少？前 '+n+' 项的和是多少？',
      ans:'第 '+n+' 项是 '+an+'，前 '+n+' 项和是 '+S,
      sol:['先找公差：'+(a1+d)+' − '+a1+' = '+d+'。','第 n 项 = 首项 + (n − 1) × 公差 = '+a1+' + '+(n-1)+' × '+d+' = '+an+'。','配对求和 = (首项 + 末项) × 项数 ÷ 2 = ('+a1+' + '+an+') × '+n+' ÷ 2 = '+S+'。','别忘了「项数 = 间隔数 + 1」，这是最容易漏的一步。']};
  }],
  '和差倍': [function(){
    var S=R(30,80), d=R(2,Math.min(20,S-2)); if((S+d)%2) d++;
    var big=(S+d)/2, small=(S-d)/2;
    return {q:'甲乙两数的和是 '+S+'，甲比乙大 '+d+'，甲、乙各是多少？',
      ans:'甲 '+big+'，乙 '+small,
      sol:['和差公式：大数 = (和 + 差) ÷ 2 = ('+S+' + '+d+') ÷ 2 = '+big+'。','小数 = (和 − 差) ÷ 2 = ('+S+' − '+d+') ÷ 2 = '+small+'。','验算：'+big+' + '+small+' = '+S+'，'+big+' − '+small+' = '+d+'。']};
  },function(){
    var k=R(2,5), one=R(6,20), total=one*(k+1);
    return {q:'果园里桃树是梨树的 '+k+' 倍，两种树共 '+total+' 棵，桃树和梨树各多少棵？',
      ans:'梨树 '+one+' 棵，桃树 '+(one*k)+' 棵',
      sol:['把梨树看作 1 份，桃树 '+k+' 份，一共 '+(k+1)+' 份。','1 份 = '+total+' ÷ '+(k+1)+' = '+one+' 棵（梨树）。','桃树 = '+one+' × '+k+' = '+(one*k)+' 棵。','验算：'+one+' + '+(one*k)+' = '+total+' 棵。']};
  }],
  '年龄': [function(){
    var s=R(7,12), k=pick([2,3,4]), then=R(14,22), y=then-s, father=k*then-y;
    return {q:'爸爸今年 '+father+' 岁，儿子 '+s+' 岁。几年后爸爸的年龄是儿子的 '+k+' 倍？',
      ans:y+' 年后',
      sol:['年龄差永远不变：'+father+' − '+s+' = '+(father-s)+' 岁。','当爸爸是儿子 '+k+' 倍时，差就是 '+(k-1)+' 份，'+(k-1)+' 份 = '+(father-s)+' 岁。','那时儿子 1 份 = '+then+' 岁。',then+' − '+s+' = '+y+' 年后。','验算：那时爸爸 '+(father+y)+' 岁，'+k+' × '+then+' = '+(k*then)+'，对上了。']};
  }],
  '周期与日期': [function(){
    var colors=['红','黄','蓝','绿'], N=R(20,120), ans=colors[(N-1)%4];
    return {q:'按红、黄、蓝、绿的顺序不断串珠子，第 '+N+' 颗是什么颜色？',
      ans:ans+'色',
      sol:['周期是 4（红黄蓝绿）。',N+' ÷ 4 = '+Math.floor(N/4)+' 组 … 余 '+(((N-1)%4)+1)+'。','余数是几，就取每组里第几个；整除时取每组最后一个。','所以是'+ans+'色。']};
  },function(){
    var W=['星期一','星期二','星期三','星期四','星期五','星期六','星期日'], w=R(0,6), N=R(10,60);
    return {q:'今天是'+W[w]+'，再过 '+N+' 天是星期几？',
      ans:W[(w+N)%7],
      sol:['星期周期是 7。',N+' ÷ 7 = '+Math.floor(N/7)+' 周 … 余 '+(N%7)+' 天。','只往后数余数天：从'+W[w]+'往后数 '+(N%7)+' 天。','答案是'+W[(w+N)%7]+'。（整除时还是原来的星期几。）']};
  }],
  '鸡兔同笼': [function(){
    var c=R(3,15), r=R(3,12), h=c+r, legs=2*c+4*r;
    return {q:'鸡兔同笼，共 '+h+' 只、'+legs+' 条腿。鸡和兔各几只？',
      ans:'鸡 '+c+' 只，兔 '+r+' 只',
      sol:['假设 '+h+' 只全是鸡，则有 '+h+' × 2 = '+(2*h)+' 条腿。','比实际少 '+legs+' − '+(2*h)+' = '+(legs-2*h)+' 条腿。','把一只鸡换成兔，多 4 − 2 = 2 条腿。','兔 = '+(legs-2*h)+' ÷ 2 = '+r+' 只，鸡 = '+h+' − '+r+' = '+c+' 只。','验算：'+r+' × 4 + '+c+' × 2 = '+legs+' 条腿。']};
  }],
  '还原与间隔': [function(){
    var x=R(3,12), a=R(2,9), b=R(2,6), c=R(2,12), result=(x+a)*b-c;
    return {q:'一个数加上 '+a+'，再乘 '+b+'，再减去 '+c+'，结果是 '+result+'。原数是多少？',
      ans:String(x),
      sol:['从结果倒推，每步用逆运算：'+result+' + '+c+' = '+(result+c)+'。',(result+c)+' ÷ '+b+' = '+(x+a)+'。',(x+a)+' − '+a+' = '+x+'。','顺着验算：('+x+' + '+a+') × '+b+' − '+c+' = '+result+'。']};
  },function(){
    var m=R(3,9), seg=R(4,12), L=m*seg;
    return {q:'一条 '+L+' 米长的路，两端都栽树，每隔 '+m+' 米栽一棵，一共栽几棵？',
      ans:(seg+1)+' 棵',
      sol:['先求段数：'+L+' ÷ '+m+' = '+seg+' 段。','两端都栽：棵数 = 段数 + 1 = '+(seg+1)+' 棵。','（一端不栽 = '+seg+' 棵；两端都不栽 = '+(seg-1)+' 棵；围成一圈 = '+seg+' 棵。）']};
  }],
  '行程': [function(){
    var v1=R(40,70), v2=R(50,90), t=R(2,5), dist=(v1+v2)*t;
    return {q:'两地相距 '+dist+' 千米，甲车每小时 '+v1+' 千米、乙车每小时 '+v2+' 千米，同时相向出发，几小时相遇？',
      ans:t+' 小时',
      sol:['相遇问题用速度和：'+v1+' + '+v2+' = '+(v1+v2)+' 千米/时。','相遇时间 = 路程和 ÷ 速度和 = '+dist+' ÷ '+(v1+v2)+' = '+t+' 小时。','验算：甲走 '+(v1*t)+' 千米、乙走 '+(v2*t)+' 千米，合计 '+dist+' 千米。']};
  }],
  '几何平面': [function(){
    var L=R(7,16), W=R(3,L-1), left=W*(L-W);
    return {q:'一个长方形长 '+L+' cm、宽 '+W+' cm，在里面剪去一个最大的正方形，剩下的面积是多少？',
      ans:left+' 平方厘米',
      sol:['最大正方形的边长等于长方形的宽，即 '+W+' cm。','长方形面积 = '+L+' × '+W+' = '+(L*W)+' 平方厘米。','正方形面积 = '+W+' × '+W+' = '+(W*W)+' 平方厘米。','剩下 = '+(L*W)+' − '+(W*W)+' = '+left+' 平方厘米。']};
  }],
  '几何立体': [function(){
    var l=R(3,9), w=R(2,8), h=R(2,7), sa=2*(l*w+l*h+w*h), v=l*w*h;
    return {q:'一个长方体长 '+l+' cm、宽 '+w+' cm、高 '+h+' cm，求它的表面积和体积。',
      ans:'表面积 '+sa+' 平方厘米，体积 '+v+' 立方厘米',
      sol:['表面积 = 2 × (长×宽 + 长×高 + 宽×高) = 2 × ('+(l*w)+' + '+(l*h)+' + '+(w*h)+') = '+sa+' 平方厘米。','体积 = 长 × 宽 × 高 = '+l+' × '+w+' × '+h+' = '+v+' 立方厘米。','注意单位不同：面积用平方厘米，体积用立方厘米。']};
  }],
  '方程': [function(){
    var a=R(2,9), x=R(2,12), b=R(1,20), sum=a*x+b;
    return {q:'解方程 '+a+'x + '+b+' = '+sum+'，x = ?',
      ans:'x = '+x,
      sol:['等式两边同减 '+b+'：'+a+'x = '+(sum-b)+'。','两边同除以 '+a+'：x = '+x+'。','把 '+x+' 代回去：'+a+' × '+x+' + '+b+' = '+sum+'，成立。']};
  }],
  '数论': [function(){
    var a=R(6,40), b=R(6,40), g=gcd(a,b), l=a*b/g;
    return {q:'求 '+a+' 和 '+b+' 的最大公约数与最小公倍数。',
      ans:'最大公约数 '+g+'，最小公倍数 '+l,
      sol:['先找两数的公共因数，最大公约数是 '+g+'。','两数乘积 = 最大公约数 × 最小公倍数。','最小公倍数 = '+a+' × '+b+' ÷ '+g+' = '+l+'。','验算：'+l+' 既能被 '+a+' 整除，也能被 '+b+' 整除。']};
  }],
  '分数计算': [function(){
    var d1=R(2,9), d2=R(2,9), n1=coprime(d1), n2=coprime(d2), den=d1*d2, A=n1*d2, B=n2*d1;
    return {q:'计算 '+n1+'/'+d1+' + '+n2+'/'+d2+'。（结果化成最简分数）',
      ans:F(A+B,den),
      sol:['分母 '+d1+' 和 '+d2+' 的最小公倍数是 '+den/gcd(d1,d2)+'，先通分。',n1+'/'+d1+' = '+A+'/'+den+'，'+n2+'/'+d2+' = '+B+'/'+den+'。',A+'/'+den+' + '+B+'/'+den+' = '+(A+B)+'/'+den+'。','约分后 = '+F(A+B,den)+'。']};
  }],
  '分数应用题': [function(){
    var den=R(3,6), p=R(1,den-1), unit=R(12,30), total=den*unit, left=(den-p)*unit;
    return {q:'一本书已经读了 '+p+'/'+den+'，还剩 '+left+' 页没读，这本书共多少页？',
      ans:total+' 页',
      sol:['把整本书看作单位「1」，剩下的分率是 1 − '+p+'/'+den+' = '+(den-p)+'/'+den+'。','量率对应：具体量 ÷ 对应分率 = 单位「1」。',left+' ÷ '+(den-p)+'/'+den+' = '+left+' × '+den+'/'+(den-p)+' = '+total+' 页。','验算：'+total+' × '+p+'/'+den+' = '+(total/den*p)+' 页已读，'+total+' − '+(total/den*p)+' = '+left+' 页。']};
  }],
  '比与比例': [function(){
    var a=R(2,5), b=R(2,5), k=R(3,12), total=(a+b)*k;
    return {q:'把 '+total+' 颗糖按 '+a+' : '+b+' 分给甲、乙两人，各得多少颗？',
      ans:'甲 '+(a*k)+' 颗，乙 '+(b*k)+' 颗',
      sol:['总份数 = '+a+' + '+b+' = '+(a+b)+' 份。','1 份 = '+total+' ÷ '+(a+b)+' = '+k+' 颗。','甲 = '+k+' × '+a+' = '+(a*k)+' 颗，乙 = '+k+' × '+b+' = '+(b*k)+' 颗。','验算：'+(a*k)+' + '+(b*k)+' = '+total+'，'+(a*k)+' : '+(b*k)+' = '+a+' : '+b+'。']};
  }],
  '百分数与浓度': [function(){
    var price=pick([100,200,250,300,400]), off=pick([7,8,9]);
    return {q:'一件衣服原价 '+price+' 元，打 '+off+' 折后是多少元？',
      ans:NUM(price*off/10)+' 元',
      sol:['打 '+off+' 折就是按原价的 '+(off*10)+'% 出售。',price+' × '+(off*10)+'% = '+NUM(price*off/10)+' 元。','注意「打几折」和「降价百分之几」不是一回事。']};
  },function(){
    var salt=R(10,40), water=100-salt;
    return {q:salt+' 克盐溶解在 '+water+' 克水里，盐水的浓度是多少？',
      ans:salt+'%',
      sol:['溶液（盐水）= 溶质 + 溶剂 = '+salt+' + '+water+' = 100 克。','浓度 = 溶质 ÷ 溶液 = '+salt+' ÷ 100 = '+salt+'%。','易错：除数要用盐水总重，不是水的重量。']};
  }],
  '工程': [function(){
    var pair=pick([[6,12],[10,15],[4,12],[6,3],[8,8],[12,24],[9,18],[5,20]]), a=pair[0], b=pair[1], days=a*b/(a+b);
    return {q:'一项工程甲单独做 '+a+' 天完成，乙单独做 '+b+' 天完成，两人合作几天完成？',
      ans:days+' 天',
      sol:['把总工作量看作 1，甲效率 1/'+a+'，乙效率 1/'+b+'。','合作效率 = 1/'+a+' + 1/'+b+' = '+(a+b)+'/'+(a*b)+'。','合作天数 = 1 ÷ '+(a+b)+'/'+(a*b)+' = '+days+' 天。','工作量没给具体数时，设成 1 最方便。']};
  }],
  '平均与容斥': [function(){
    var base=R(80,95), arr=[base-3,base,base+2,base+1];
    return {q:'小明四次数学测验成绩是 '+arr.join('、')+' 分，平均分是多少？',
      ans:base+' 分',
      sol:['先求总分：'+arr.join(' + ')+' = '+(base*4)+' 分。','平均分 = '+(base*4)+' ÷ 4 = '+base+' 分。','移多补少：以 '+base+' 为基准，−3 + 0 + 2 + 1 = 0，所以平均就是 '+base+'。']};
  },function(){
    var A=R(18,26), B=R(14,24), both=R(3,10), atLeast=A+B-both, N=atLeast+R(2,12), neither=N-atLeast;
    return {q:'全班 '+N+' 人，参加数学组的 '+A+' 人、语文组的 '+B+' 人，两组都参加的 '+both+' 人。两组都没参加的有几人？',
      ans:neither+' 人',
      sol:['至少参加一组 = '+A+' + '+B+' − '+both+' = '+atLeast+' 人（都参加的被算了两次，要减一次）。','都没参加 = '+N+' − '+atLeast+' = '+neither+' 人。','画两个圈重叠的图，一眼就能看明白为什么要减。']};
  }],
  '计数': [function(){
    var u=R(2,6), p=R(2,7);
    return {q:'从 '+u+' 件上衣和 '+p+' 条裤子中各选一件，一共有多少种搭配？',
      ans:(u*p)+' 种',
      sol:['完成这件事要分两步：先选上衣，再选裤子，用乘法原理。',u+' × '+p+' = '+(u*p)+' 种。','（如果是「可以选上衣或选裤子」，那是分类，用加法 '+(u+p)+' 种。）']};
  }],
  '统计与概率': [function(){
    var red=R(1,6), white=R(1,6), tot=red+white;
    return {q:'袋子里有 '+red+' 个红球、'+white+' 个白球，除颜色外完全相同。任意摸出 1 个，摸到红球的可能性是多少？',
      ans:F(red,tot),
      sol:['所有等可能结果共 '+red+' + '+white+' = '+tot+' 个。','目标（红球）结果有 '+red+' 个。','可能性 = '+red+'/'+tot+' = '+F(red,tot)+'。','判断游戏是否公平，就看双方获胜的可能性是不是相等。']};
  }],
  '有理数': [function(){
    var a=R(-9,9), b=R(2,9), c=R(-10,10), ans=a*b+c;
    return {q:'计算 ('+a+') × '+b+' + ('+c+')。',
      ans:String(ans),
      sol:['先算乘法：('+a+') × '+b+' = '+(a*b)+'。','再加上 ('+c+')：'+(a*b)+' + ('+c+') = '+ans+'。','先定符号、再算绝对值；减去一个负数等于加上它的相反数。']};
  }],
  '整式': [function(){
    var x1=R(2,9), x2=R(1,8), y1=R(2,9), y2=R(2,9), cx=x1+x2, cy=y1+y2, val=cx*2+cy;
    return {q:'化简 '+x1+'a + '+y1+'b + '+x2+'a + '+y2+'b，并求 a = 2、b = 1 时的值。',
      ans:'化简得 '+cx+'a + '+cy+'b，值为 '+val,
      sol:['只有字母和指数完全相同的项才能合并。','a 的项：'+x1+'a + '+x2+'a = '+cx+'a；b 的项：'+y1+'b + '+y2+'b = '+cy+'b。','化简结果 '+cx+'a + '+cy+'b。','代入 a=2、b=1：'+cx+' × 2 + '+cy+' × 1 = '+val+'。']};
  }],
  '小数计算': [function(){
    var a=R(11,89), b=R(11,89), k=R(2,9);
    return {q:'计算 '+NUM(a/10)+' + '+NUM(b/10)+' × '+k+'。',
      ans:NUM((a+b*k)/10),
      sol:['先算乘法：'+NUM(b/10)+' × '+k+' = '+NUM(b*k/10)+'。','小数加减要小数点对齐：'+NUM(a/10)+' + '+NUM(b*k/10)+' = '+NUM((a+b*k)/10)+'。','也可以先把小数点同时右移一位，按整数算完再移回来。']};
  }]
};

/* 从典型例题里取（这些答案是人工核对过的，不会算错） */
function fromExamples(guide){
  var exs=(guide&&guide.examples)||[];
  if(!exs.length) return {q:'这个专题暂时没有可自动生成的变式题，请到「专题讲解」里挑一道典型例题重做。',ans:'—',sol:[],source:'none',label:'暂无变式题'};
  var e=pick(exs);
  return {q:e.q,ans:e.ans,sol:e.sol||[],source:'example',label:'同专题典型例题'};
}

/* 生成 n 道；返回 [{q,ans,sol,source,label}] */
function makeVariants(tag,n,guide){
  var bank=BANK[tag]||[], out=[], seen={};
  n=n||3;
  for(var i=0;i<n;i++){
    var item=null;
    if(bank.length){
      for(var t=0;t<6;t++){
        var v=pick(bank)();
        if(!seen[v.q]){ item=Object.assign({},v,{source:'local',label:'同型变式题'}); seen[v.q]=1; break; }
      }
      if(!item) item=Object.assign({},pick(bank)(),{source:'local',label:'同型变式题'});
    } else item=fromExamples(guide);
    out.push(item);
  }
  return out;
}
function hasBank(tag){ return !!(BANK[tag]&&BANK[tag].length); }

root.VARIANT_BANK=BANK;
root.makeVariants=makeVariants;
root.hasVariantBank=hasBank;
if(typeof module!=='undefined' && module.exports) module.exports={BANK:BANK,makeVariants:makeVariants,hasVariantBank:hasBank};
})(typeof window!=='undefined' ? window : globalThis);
