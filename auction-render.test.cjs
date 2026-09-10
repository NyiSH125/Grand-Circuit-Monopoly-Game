const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('game.js', 'utf8');
const renderer = source.slice(source.indexOf('function renderAuction()'), source.indexOf('function bidNow('));
function fixture() {
  let builds = 0;
  const element = () => ({dataset:{},style:{},textContent:'',value:'',addEventListener(){},replaceChildren(){}});
  const nodes = {};
  let buttons = [];
  const side = {
    set innerHTML(html) {
      builds++;
      for(const key of ['.auc-buttons','.auc-amount','.auc-who','.auc-timer','.auc-bar i','.auc-controls','.auc-bid-label','#aucAs','.auc-note']) nodes[key]=element();
      buttons = Array.from({length:3},()=>{
        const children={span:element(),small:element()};
        return {...element(),querySelector:s=>children[s]};
      });
    },
    querySelector:s=>nodes[s] || null,
    querySelectorAll:()=>buttons
  };
  const player={id:0,name:'Player 1',cash:1500,bot:false};
  const G={auction:{idx:6,bid:80,high:1},players:[player,{id:1,name:'House',color:'cyan'}],
    AUCTION_MS:5000,bidSteps:()=>[2,10,100],auctionLeft:()=>4000,alive:()=>[player]};
  let bidder=player;
  const context=vm.createContext({G,Option:function(name,value){this.text=name;this.value=value;},
    $:selector=>selector==='#aucSide'?side:{classList:{contains:()=>true}},
    money:n=>'$'+n,auctionBidder:()=>bidder,avatarSVG:()=>'<svg></svg>',closeAuctionModal(){},openAuctionModal(){}});
  vm.runInContext(renderer,context);
  return {G,player,render:()=>context.renderAuction(),buttons:()=>buttons,nodes,
    builds:()=>builds,noBidder:()=>{bidder=null;}};
}
test('countdown ticks and incoming bids preserve buttons and seat selector',()=>{
  const f=fixture();f.render();const buttons=f.buttons();const pick=f.nodes['#aucAs'];
  for(let i=0;i<30;i++) f.render();
  assert.equal(f.builds(),1);assert.equal(f.buttons()[0],buttons[0]);assert.equal(f.nodes['#aucAs'],pick);
  // A guest receives a fresh auction object on each host update.
  f.G.auction={...f.G.auction,bid:90,high:0};f.render();
  assert.equal(f.buttons()[0],buttons[0]);assert.equal(buttons[0].querySelector('span').textContent,'$92');
  assert.equal(f.nodes['.auc-timer'].textContent,'Sold in 4s');
});
test('affordability and spectator controls still update without rebuilding',()=>{
  const f=fixture();f.render();const buttons=f.buttons();
  f.player.cash=85;f.render();assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,true);
  f.player.cash=0;f.render();assert(buttons.every(b=>b.disabled));
  f.noBidder();f.render();assert.equal(f.nodes['.auc-controls'].hidden,true);
  assert.equal(f.builds(),1);
});

test('countdown animates continuously and restarts only for a new deadline',()=>{
  const f=fixture(); f.render();
  const bar=f.nodes['.auc-bar i']; const animations=[]; let cancelled=0;
  bar.animate=(frames,options)=>{animations.push({frames,options});return {cancel(){cancelled++;}};};
  f.G.auction.endsAt=5000; f.G.auctionLeft=()=>4000; f.render();
  assert.equal(animations.length,1);
  assert.equal(animations[0].frames[0].width,'80%');
  assert.equal(animations[0].frames[1].width,'0%');
  assert.equal(animations[0].options.duration,4000);
  assert.equal(animations[0].options.easing,'linear');
  for(let i=0;i<20;i++) f.render();
  assert.equal(animations.length,1);
  f.G.auction.endsAt=9000; f.G.auctionLeft=()=>5000; f.render();
  assert.equal(cancelled,1);assert.equal(animations.length,2);
  assert.equal(animations[1].frames[0].width,'100%');
  assert.equal(animations[1].options.duration,5000);
});
