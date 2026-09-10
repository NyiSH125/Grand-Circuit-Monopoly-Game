/* The room layer: seats, invites, and keeping every browser in step.

   The host runs the game. Guests draw what the host publishes and send back
   what they want to do. Nothing here changes how the game itself works. */

const Rooms = {
  started: false,
  public: false,
  hostInfo: null,          // addresses the server can be reached on
  guestSeats: [],          // a guest's view of the seat list
  pendingName: '',

  /* ---- opening a room -------------------------------------------------- */
  async init() {
    const applyHomeName = () => {
      const name = $('#homeName').value.trim().replace(/[<>"&]/g, '').slice(0, 16) || 'Player 1';
      seats[0].name = name;
      this.pendingName = name;
      renderSeats();
    };
    $('#homePlay').addEventListener('submit', e => {
      e.preventDefault(); applyHomeName(); this.show('setup'); $('#startGame').click();
    });
    $('#doorCreate').addEventListener('click', () => { applyHomeName(); this.show('setup'); });
    $('#doorJoin').addEventListener('click', () => { applyHomeName(); this.show('joinView'); this.refreshLobbies(); });
    $('#doorPrivate').addEventListener('click', async () => {
      applyHomeName(); this.public = false; this.show('setup'); await this.host();
    });
    setInterval(() => { if (!$('#joinView').hidden) this.refreshLobbies(); }, 5000);

    const code = new URLSearchParams(location.search).get('room');
    if (code) return this.showJoin(code.toUpperCase());   // an invite link skips the door
    this.renderPanel();
  },

  async host() {
    if (Net.online()) return;
    await Net.open(Net.makeCode(), 'host');
    Net.seat = 0;
    Net.onchange = () => this.renderPanel();
    try {
      const res = await fetch('/room/host-info', { cache: 'no-store' });
      if (res.ok) this.hostInfo = await res.json();
    } catch (e) { /* no relay: the room still works between tabs here */ }
    this.renderPanel();
    Net.announceRoom();
    this.announceMeta();
  },

  /* Tell the server whether this table should show in the lobby list. */
  async announceMeta() {
    if (!Net.isHost() || Net.transport !== 'relay') return;
    try {
      await fetch('/room/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: Net.code,
          meta: {
            public: this.public,
            started: this.started,
            host: seats[0] ? seats[0].name : 'Someone',
            players: seats.filter(s => !s.bot).length,
            seats: seats.length,
            map: setupRules.map
          }
        })
      });
    } catch (e) { /* the lobby list is a convenience, not a requirement */ }
  },

  setPublic(on) {
    this.public = on;
    this.renderPanel();
    this.announceMeta();
  },

  close() {
    if (Net.source) Net.source.close();
    if (Net.channel) Net.channel.close();
    Net.role = 'solo'; Net.code = null; Net.transport = null; Net.connected = false;
    this.renderPanel();
  },

  /* The address to hand out: a network one when the page is on localhost. */
  invite() {
    const url = new URL(Net.link());
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (local && this.hostInfo && this.hostInfo.addresses && this.hostInfo.addresses.length) {
      url.hostname = this.hostInfo.addresses[0];
    }
    return url.toString();
  },

  seatList() {
    return seats.map((s, i) => ({ i, name: s.name, bot: s.bot, peer: s.peer || null }));
  },

  /* ---- the host's room panel ------------------------------------------ */
  renderPanel() {
    const host = $('#roomPanel');
    if (!host) return;

    if (!Net.online()) {
      host.innerHTML =
        `<button class="btn ghost" type="button" onclick="Rooms.host()">Open a room</button>`;
      return;
    }

    const link = this.invite();
    const reach = Net.transport === 'relay'
      ? (this.hostInfo && this.hostInfo.addresses && this.hostInfo.addresses.length
          ? `Anyone on your network can open this link.`
          : `Anyone who can reach this address can open this link.`)
      : `No room server is running, so this link only works in other tabs on this
         machine. Start it with <code>node server.js</code> to play across a network.`;

    host.innerHTML =
      `<div class="room-live">
         <div class="room-code">
           <span class="room-label">Room code</span>
           <strong>${Net.code}</strong>
         </div>
         <div class="room-link">
           <input id="roomLink" value="${link}" readonly aria-label="Invite link">
           <button class="btn ghost" type="button" onclick="Rooms.copyLink()">Copy</button>
         </div>
         <div class="rule room-rule">
           <span class="icon i-start">${ICON_SVG.start}</span>
           <span class="rule-text"><b>Public table</b>
             <small>Listed for anyone looking for a game. Off means the key or link only.</small></span>
           <button type="button" class="switch ${this.public ? 'on' : ''}" role="switch"
                   aria-checked="${this.public}" aria-label="Public table"
                   onclick="Rooms.setPublic(${!this.public})"><i></i></button>
         </div>
         <p class="room-note">${reach}</p>
         <p class="room-note room-state" id="roomState">${this.joinedLine()}</p>
       </div>`;
  },

  joinedLine() {
    const joined = seats.filter(s => s.peer).length;
    return joined
      ? `${joined} player${joined === 1 ? '' : 's'} joined. Start when everyone is in.`
      : 'Waiting for players to join.';
  },

  copyLink() {
    const box = $('#roomLink');
    if (!box) return;
    box.select();
    navigator.clipboard?.writeText(box.value).catch(() => document.execCommand('copy'));
    const btn = box.parentNode.querySelector('.btn');
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
  },

  /* ---- someone asks for a seat ---------------------------------------- */
  acceptJoin(name, peerId) {
    let seat = seats.findIndex(s => s.peer === peerId);
    if (seat === -1) {
      if (this.started) return;                    // no late arrivals mid-game
      seat = seats.findIndex(s => s.bot && !s.peer);
      if (seat === -1) {
        if (seats.length >= 6) return;
        seats.push({ name: name || 'Player', bot: false, peer: peerId });
        seat = seats.length - 1;
      } else {
        seats[seat] = { name: name || 'Player', bot: false, peer: peerId };
      }
    }
    seats[seat].name = name || seats[seat].name;
    seats[seat].bot = false;
    seats[seat].peer = peerId;
    renderSeats();
    this.renderPanel();
    Net.send({ type: 'seat', to: peerId, seat, name: seats[seat].name });
    Net.announceRoom();
    this.announceMeta();
  },

  /* ---- which screen is showing ---------------------------------------- */
  show(view) {
    ['landing', 'joinView', 'setup'].forEach(id => { $('#' + id).hidden = id !== view; });
    $('#app').hidden = true;
    if (view === 'joinView') this.renderJoinView();
    if (view === 'setup') this.renderPanel();
  },

  /* ---- the join screen -------------------------------------------------- */
  lobbies: [],
  joinError: '',

  async renderJoinView() {
    const card = $('#joinCard');
    if (!card) return;
    const list = this.lobbies.length
      ? `<ul class="lobbies">${this.lobbies.map(r => `
          <li>
            <span class="lobby-code">${r.code}</span>
            <span class="lobby-who">${r.host}'s table<small>${MAPS[r.map] ? MAPS[r.map].name : r.map} map</small></span>
            <span class="lobby-count">${r.players}/${Math.max(r.seats, r.players)}</span>
            <button class="btn ghost" type="button" onclick="Rooms.joinCode('${r.code}')">Join</button>
          </li>`).join('')}</ul>`
      : `<p class="room-note">No public tables are waiting right now. Ask a friend for a
           room key, or create a game of your own and leave it public.</p>`;

    card.innerHTML =
      `<p class="eyebrow">Join a game</p>
       <h1>Find a table</h1>
       <p class="setup-lede">Type the key a friend sent you, or take a seat at a public table.</p>

       <div class="keyrow">
         <input id="roomKey" maxlength="5" autocomplete="off" spellcheck="false"
                placeholder="ROOM KEY" aria-label="Room key">
         <button class="btn solid" type="button" onclick="Rooms.joinTyped()">Join</button>
       </div>
       ${this.joinError ? `<p class="join-error">${this.joinError}</p>` : ''}

       <div class="setup-head-row">
         <h2 class="setup-head">Public tables</h2>
         <button class="linkish" type="button" onclick="Rooms.refreshLobbies(true)">Refresh</button>
       </div>
       ${list}

       <div class="setup-row">
         <button class="btn ghost" type="button" onclick="Rooms.show('landing')">Back</button>
         <button class="btn solid" type="button" id="randomJoin"
                 ${this.lobbies.length ? '' : 'disabled'} onclick="Rooms.joinRandom()">Join a random table</button>
       </div>`;

    const key = $('#roomKey');
    if (key) {
      key.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      key.addEventListener('keydown', e => { if (e.key === 'Enter') this.joinTyped(); });
      key.focus();
    }
  },

  async refreshLobbies(render) {
    try {
      const res = await fetch('/room/list', { cache: 'no-store' });
      this.lobbies = res.ok ? (await res.json()).rooms || [] : [];
    } catch (e) { this.lobbies = []; }
    if (render !== false && !$('#joinView').hidden) this.renderJoinView();
  },

  joinTyped() {
    const box = $('#roomKey');
    const code = (box && box.value.trim().toUpperCase()) || '';
    if (code.length < 4) { this.joinError = 'That key looks too short.'; this.renderJoinView(); return; }
    this.joinCode(code);
  },

  joinRandom() {
    if (!this.lobbies.length) return;
    const pick = this.lobbies[Math.floor(Math.random() * this.lobbies.length)];
    this.joinCode(pick.code);
  },

  async joinCode(code) {
    this.joinError = '';
    try {
      const res = await fetch('/room/exists?code=' + encodeURIComponent(code), { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        if (!info.exists) {
          this.joinError = `No table is open under ${code}.`;
          this.renderJoinView();
          return;
        }
      }
    } catch (e) { /* no relay: try the local channel anyway */ }
    this.showJoin(code);
  },

  /* ---- the guest side -------------------------------------------------- */
  async showJoin(code) {
    $('#landing').hidden = true;
    $('#setup').hidden = true;
    $('#joinView').hidden = false;
    await Net.open(code, 'guest');
    Net.onchange = () => this.renderJoin();
    this.renderJoin();
    Net.send({ type: 'hello-guest' });
  },

  renderJoin() {
    const card = $('#joinCard');
    if (!card) return;
    const seated = Net.seat !== null;
    const list = this.guestSeats.length
      ? `<ul class="join-seats">${this.guestSeats.map(s =>
          `<li><span class="mini">${avatarSVG(TOKEN_COLORS[s.i], s.i, 22)}</span>
             ${s.name}${s.i === Net.seat ? ' <em>(you)</em>' : ''}
             <span class="tag">${s.bot ? 'House' : s.peer ? 'Joined' : 'Open'}</span></li>`).join('')}</ul>`
      : '<p class="room-note">Reading the room…</p>';

    card.innerHTML =
      `<p class="eyebrow">Room ${Net.code}</p>
       <h1>Join the table</h1>
       ${seated
         ? `<p class="setup-lede">You are seated. The game begins when the host starts it.</p>`
         : `<p class="setup-lede">Pick a name and take a seat. The host decides the map and
              the rules, and starts the game when everyone is in.</p>
            <div class="seat">
              <span class="swatch">${avatarSVG(TOKEN_COLORS[1], 1, 28)}</span>
              <input id="guestName" maxlength="16" autocomplete="off" spellcheck="false"
                     placeholder="Your name" value="${this.pendingName}">
              <button class="btn solid" type="button" onclick="Rooms.requestSeat()">Take a seat</button>
            </div>`}
       <h2 class="setup-head">At the table</h2>
       ${list}
       <p class="room-note">${Net.connected ? 'Connected to the room.' : 'Connecting…'}</p>`;
  },

  requestSeat() {
    const box = $('#guestName');
    this.pendingName = (box && box.value.trim()) || 'Player';
    Net.send({ type: 'join-request', name: this.pendingName });
  },

  onSeated(msg) {
    Net.seat = msg.seat;
    wireGuestActions();
    this.renderJoin();
  },

  onRoomState(msg) {
    this.guestSeats = msg.seats || [];
    Object.assign(setupRules, msg.rules || {});
    if (msg.started) this.enterGame();
    else this.renderJoin();
  },

  enterGame() {
    $('#landing').hidden = true;
    $('#joinView').hidden = true;
    $('#setup').hidden = true;
    $('#app').hidden = false;
  },

  /* ---- state on the wire ---------------------------------------------- */
  snapshot() {
    return {
      map: CURRENT_MAP,
      rules: G.rules,
      players: G.players,
      tiles: G.tiles,
      turn: G.turn,
      round: G.round,
      pot: G.pot,
      dice: G.dice,
      phase: G.phase,
      walking: G.walking,
      moverId: G.moverId,
      entries: G.entries,
      trades: G.trades.filter(t => t.status === 'open'),
      auction: G.auction ? { ...G.auction, msLeft: G.auctionLeft() } : null,
      clock: G.clock,
      seats: this.seatList()
    };
  },

  applyState(s) {
    if (s.map !== CURRENT_MAP) applyMap(s.map);
    G.remote = true;
    Object.assign(G.rules, s.rules);
    G.players = s.players;
    G.tiles = s.tiles;
    G.turn = s.turn;
    G.round = s.round;
    G.pot = s.pot;
    G.dice = s.dice;
    G.phase = s.phase;
    G.walking = false;              // the guest draws where pieces landed
    G.moverId = null;
    G.entries = s.entries;
    G.trades = s.trades;
    G.auction = s.auction;
    if (G.auction) G.auction.endsAt = Date.now() + (G.auction.msLeft || 0);
    G.clock = s.clock;
    this.guestSeats = s.seats || this.guestSeats;
    this.enterGame();
    render();
  },

  /* ---- a guest's move arrives ----------------------------------------- */
  TURN_ACTS: ['rollDice', 'buy', 'decline', 'endTurn', 'settleDebt', 'bankruptSelf',
              'payRelease', 'usePardon'],
  OWN_ACTS: ['build', 'sellHouse', 'mortgage', 'redeem'],
  TRADE_ACTS: ['acceptTrade', 'declineTrade', 'withdrawTrade', 'proposeTrade'],

  runIntent(msg) {
    const { name, args } = msg;
    const seat = seats.findIndex(s => s.peer === msg.from);
    if (seat === -1) return;

    if (name === 'surrender') {
      G.surrender(seat);
      return;
    }

    if (name === 'auctionBid') {
      if (G.auction) G.placeBid(seat, args[0]);
      render();
      return;
    }

    if (this.TURN_ACTS.includes(name)) {
      if (G.actor().id !== seat) return;
      if (name === 'bankruptSelf') G.bankrupt(G.players[seat]);
      else if (name === 'payRelease') payRelease();
      else if (name === 'usePardon') usePardon();
      else G[name](...(args || []));
    } else if (this.OWN_ACTS.includes(name)) {
      const idx = args[0];
      if (G.tiles[idx] && G.tiles[idx].owner === seat) G[name](idx);
    } else if (this.TRADE_ACTS.includes(name)) {
      if (name === 'proposeTrade') {
        const o = args[0] || {};
        if (o.fromId !== seat) return;
        proposeTrade(o);
      } else {
        const t = G.trades.find(x => x.id === args[0]);
        if (!t || t.status !== 'open') return;
        if (name === 'withdrawTrade' ? t.from !== seat : t.to !== seat) return;
        window[name](args[0]);
      }
    } else return;

    render();
  },

  /* The invite stays reachable while the game is on. */
  renderBar() {
    const bar = $('#roomBar');
    if (!bar) return;
    if (!Net.online()) { bar.hidden = true; return; }
    bar.hidden = false;
    const seated = (G.players.length ? G.players : seats).length;
    $('#roomCount').textContent = seated + ' at the table';
    const body = $('#roomBarBody');
    if (body.dataset.code === Net.code) return;
    body.dataset.code = Net.code;
    body.innerHTML =
      `<div class="room-code"><span class="room-label">Code</span><strong>${Net.code}</strong></div>
       <div class="room-link">
         <input id="roomLink" value="${this.invite()}" readonly aria-label="Invite link">
         <button class="btn ghost" type="button" onclick="Rooms.copyLink()">Copy</button>
       </div>`;
  },

  onChat(msg) {
    if (typeof msg.text !== 'string' || !msg.text.trim()) return;
    const list = $('#chatMessages');
    const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 30;
    const line = document.createElement('p');
    const name = document.createElement('b');
    name.textContent = String(msg.name || 'Player').slice(0, 40) + ': ';
    line.append(name, document.createTextNode(msg.text.slice(0, 500)));
    list.appendChild(line);
    if (follow) list.scrollTop = list.scrollHeight;
  }
};

/* ---- guests speak instead of acting ------------------------------------ */
function wireGuestActions() {
  const relay = name => (...args) => Net.send({ type: 'intent', name, args });
  ['rollDice', 'buy', 'decline', 'endTurn', 'settleDebt',
   'build', 'sellHouse', 'mortgage', 'redeem'].forEach(name => { G[name] = relay(name); });
  G.placeBid = () => {};              // guests bid through bidNow
  G.botsConsider = () => {};
  G.bankrupt = () => Net.send({ type: 'intent', name: 'bankruptSelf', args: [] });
  window.payRelease = relay('payRelease');
  window.usePardon = relay('usePardon');
  ['acceptTrade', 'declineTrade', 'withdrawTrade'].forEach(name => { window[name] = relay(name); });
  window.submitTrade = function (fromId, parent) {
    const toId = Number($('#partnerSel').value);
    const give = [...document.querySelectorAll('[data-side="give"]:checked')].map(c => Number(c.value));
    const get = [...document.querySelectorAll('[data-side="get"]:checked')].map(c => Number(c.value));
    const giveCash = Number($('#giveCash').value) || 0;
    const getCash = Number($('#getCash').value) || 0;
    if (!give.length && !get.length && !giveCash && !getCash) return closeModal();
    Net.send({ type: 'intent', name: 'proposeTrade', args: [{ fromId, toId, give, get, giveCash, getCash, parent }] });
    closeModal();
  };
  G.maybeBot = () => {};                 // the host runs the house players
  G.restart = () => {};
  G.forfeit = () => {};
}

/* The host publishes after anything that redraws the board. */
(function hookPublish() {
  const base = window.render;
  let queued = false;
  window.render = function () {
    base();
    Rooms.renderBar();
    if (!Net.isHost() || !Rooms.started) return;
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; Net.publish(); }, 40);
  };
})();

Rooms.init();

$('#chatForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#chatInput');
  const text = input.value.trim().slice(0, 500);
  if (!text) return;
  const player = Net.online() ? G.players.find(p => p.id === Net.seat) : G.cur();
  const message = { type: 'chat', name: player?.name || Rooms.pendingName || 'Player', text };
  Rooms.onChat(message);
  if (Net.online()) Net.send(message);
  input.value = '';
});
