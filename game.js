/* Grand Circuit - a hot-seat property game with optional house players. */

const $ = sel => document.querySelector(sel);
const money = n => (n < 0 ? '-$' + Math.abs(n) : '$' + n);
const initials = name => name.trim().slice(0, 1).toUpperCase();

/* ====================================================================== */
/* Setup screen                                                            */
/* ====================================================================== */

const seats = [
  { name: 'Player 1', bot: false },
  { name: BOT_NAMES[0], bot: true },
  { name: BOT_NAMES[1], bot: true }
];

function renderSeats() {
  const host = $('#seats');
  host.innerHTML = '';
  seats.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'seat';
    row.innerHTML =
      `<span class="swatch">${avatarSVG(TOKEN_COLORS[i], i, 28)}</span>` +
      `<input value="${s.name.replace(/"/g, '&quot;')}" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Player ${i + 1} name">` +
      (s.peer
        ? `<span class="tag seat-tag">Joined</span>`
        : `<span class="toggle">
             <button type="button" data-bot="0" class="${s.bot ? '' : 'on'}">Human</button>
             <button type="button" data-bot="1" class="${s.bot ? 'on' : ''}">House</button>
           </span>`);
    row.querySelector('input').addEventListener('input', e => { s.name = e.target.value; });
    if (s.peer) row.querySelector('input').readOnly = true;
    row.querySelectorAll('[data-bot]').forEach(b => b.addEventListener('click', () => {
      s.bot = b.dataset.bot === '1';
      renderSeats();
    }));
    host.appendChild(row);
  });
  $('#addSeat').disabled = seats.length >= 6;
  $('#dropSeat').disabled = seats.length <= 2;
}

/* ---- table settings ---------------------------------------------------- */
const setupRules = {
  map: 'classic',
  startCash: 1500,
  x2Rent: true,
  vacationCash: true,
  auction: false,
  noRentInPrison: false,
  mortgage: true,
  evenBuild: true
};

const RULE_ROWS = [
  { key: 'x2Rent', icon: 'tax', title: 'Double rent on a full country',
    note: 'Owning every city in a country doubles the base rent on its undeveloped stops.' },
  { key: 'vacationCash', icon: 'vacation', title: 'Vacation cash',
    note: 'Taxes and fines pool on Vacation, and whoever lands there takes the lot.' },
  { key: 'auction', icon: 'treasure', title: 'Auction',
    note: 'A stop that is passed over goes to the highest bidder instead of staying with the bank.' },
  { key: 'noRentInPrison', icon: 'jail', title: 'No rent while in prison',
    note: 'An owner sitting in prison collects nothing on their stops.' },
  { key: 'mortgage', icon: 'power', title: 'Mortgage',
    note: 'Deeds can be mortgaged for half their price, and pay no rent until redeemed.' },
  { key: 'evenBuild', icon: 'house', title: 'Even build',
    note: 'Houses and hotels must go up, and come down, evenly across a country.' }
];

const CASH_CHOICES = [1000, 1500, 2000, 2500, 3000];

function renderMaps() {
  const host = $('#maps');
  host.innerHTML = Object.entries(MAPS).map(([id, m]) => {
    /* A map lists its countries either as sets or inside its own layout. */
    const groups = m.sets
      ? m.sets.map(set => set.group)
      : [...new Set(m.layout.filter(row => row[0] === 'city').map(row => row[2]))];
    const flags = groups.map(g => `<span class="flag">${FLAG_SVG[g]}</span>`).join('');
    return `<button type="button" class="map-card ${setupRules.map === id ? 'on' : ''}" data-map="${id}">
      <span class="map-name">${m.name}${m.luck ? '<em class="map-tag">luck</em>' : ''}</span>
      <span class="map-flags">${flags}</span>
    </button>`;
  }).join('');
  host.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
    setupRules.map = b.dataset.map;
    renderMaps();
  }));
}

function renderRules() {
  const host = $('#rules');
  host.innerHTML =
    RULE_ROWS.map(r => `
      <div class="rule">
        <span class="icon i-${r.icon}">${ICON_SVG[r.icon]}</span>
        <span class="rule-text"><b>${r.title}</b><small>${r.note}</small></span>
        <button type="button" class="switch ${setupRules[r.key] ? 'on' : ''}"
                data-rule="${r.key}" role="switch" aria-checked="${setupRules[r.key]}"
                aria-label="${r.title}"><i></i></button>
      </div>`).join('') +
    `<div class="rule">
       <span class="icon i-start">${ICON_SVG.start}</span>
       <span class="rule-text"><b>Starting cash</b><small>What every player has in hand on the first turn.</small></span>
       <select class="pick" id="startCash">
         ${CASH_CHOICES.map(v => `<option value="${v}" ${v === setupRules.startCash ? 'selected' : ''}>$${v}</option>`).join('')}
       </select>
     </div>`;

  host.querySelectorAll('[data-rule]').forEach(b => b.addEventListener('click', () => {
    setupRules[b.dataset.rule] = !setupRules[b.dataset.rule];
    renderRules();
  }));
  $('#startCash').addEventListener('change', e => { setupRules.startCash = Number(e.target.value); });
}

$('#addSeat').addEventListener('click', () => {
  const used = seats.filter(s => s.bot).length;
  seats.push({ name: BOT_NAMES[used % BOT_NAMES.length] || 'House', bot: true });
  renderSeats();
});
$('#dropSeat').addEventListener('click', () => { seats.pop(); renderSeats(); });
$('#startGame').addEventListener('click', () => {
  Object.assign(G.rules, setupRules);
  applyMap(setupRules.map);
  $('#setup').hidden = true;
  $('#app').hidden = false;
  if (typeof Net !== 'undefined' && Net.isHost()) {
    Rooms.started = true;
    Net.announceRoom();
    Rooms.announceMeta();
  }
  G.start(seats);
  if (typeof Net !== 'undefined' && Net.isHost()) Net.publish();
});
renderSeats();
renderMaps();
renderRules();

/* ====================================================================== */
/* Game state                                                              */
/* ====================================================================== */

const G = {
  players: [],
  tiles: [],
  turn: 0,
  round: 1,
  pot: 0,
  dice: [1, 1],
  doubleStreak: 0,
  lastDouble: false,
  phase: 'roll',
  debt: null,
  rentMultiplier: null,   // set by cards: 2x airport, 10x utility
  entries: [],
  entryId: 0,
  animating: false,
  seq: 0,
  walking: false,
  moverId: null,
  instant: false,          // tests switch this on to skip the walk timers
  litPlayer: null,
  clock: { key: null, deadline: 0, who: null },
  trades: [],
  tradeSeq: 0,
  auction: null,
  rules: {
    map: 'classic',
    startCash: 1500,
    x2Rent: true,
    vacationCash: true,
    auction: false,
    noRentInPrison: false,
    mortgage: true,
    evenBuild: true
  },

  start(seatList) {
    this.players = seatList.map((s, i) => ({
      id: i,
      name: (s.name || 'Player ' + (i + 1)).trim(),
      bot: s.bot,
      color: TOKEN_COLORS[i],
      cash: this.rules.startCash,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      pardons: 0,
      out: false,
      turns: 0,
      outRound: null,
      outOrder: null
    }));
    this.tiles = BOARD.map(() => ({ owner: null, houses: 0, mortgaged: false }));
    this.trades = [];
    this.turn = Math.floor(Math.random() * this.players.length);
    this.say('Play order was randomised. <b>' + this.cur().name + '</b> opens.', true);
    this.beginTurn();
  },

  cur() { return this.players[this.turn]; },
  /* The player the game is waiting on right now. */
  actor() {
    if (this.debt) return this.debt.player;
    return this.cur();
  },
  alive() { return this.players.filter(p => !p.out); },
  tile(i) { return this.tiles[i]; },

  say(html, big) {
    this.entries.unshift({ html, big, id: ++this.entryId });

  },

  /* ---- money ------------------------------------------------------- */
  credit(p, amt) {
    if (!this.instant && amt > 0) Sound.play('money');
    p.cash += amt;
    this.say(`<b>${p.name}</b> collected <span class="amt">${money(amt)}</span>.`);
  },

  /* Returns true when settled immediately. Opens a debt if it cannot be paid. */
  debit(p, amt, creditor, toPot) {
    if (amt <= 0) return true;
    if (p.cash >= amt) {
      p.cash -= amt;
      if (creditor) creditor.cash += amt;
      else if (toPot && this.rules.vacationCash) this.pot += amt;
      if (!this.instant) Sound.play('pay');
    this.say(`<b>${p.name}</b> paid <span class="amt">${money(amt)}</span>${creditor ? ' to <b>' + creditor.name + '</b>' : ''}.`);
      return true;
    }
    this.debt = { player: p, amount: amt, creditor: creditor || null, toPot: !!toPot };
    this.phase = 'debt';
    this.seq++;
    this.say(`<b>${p.name}</b> owes <span class="amt">${money(amt)}</span> and must raise funds.`, true);
    return false;
  },

  settleDebt() {
    this.touch();
    const d = this.debt;
    if (!d || d.player.cash < d.amount) return;
    d.player.cash -= d.amount;
    if (d.creditor) d.creditor.cash += d.amount;
    else if (d.toPot && this.rules.vacationCash) this.pot += d.amount;
    this.say(`<b>${d.player.name}</b> settled <span class="amt">${money(d.amount)}</span>${d.creditor ? ' with <b>' + d.creditor.name + '</b>' : ''}.`);
    this.debt = null;
    this.afterAction();
  },

  netWorth(p) {
    let w = p.cash;
    this.tiles.forEach((t, i) => {
      if (t.owner !== p.id) return;
      const def = BOARD[i];
      w += t.mortgaged ? Math.floor(def.price / 2) : def.price;
      if (t.houses) w += t.houses * Math.floor((def.house || 0) / 2);
    });
    return w;
  },

  bankrupt(p) {
    const ownDebt = this.debt && this.debt.player.id === p.id;
    const to = ownDebt && this.debt.creditor;
    this.tiles.forEach((t, i) => {
      if (t.owner !== p.id) return;
      t.houses = 0;
      if (to) t.owner = to.id;
      else { t.owner = null; t.mortgaged = false; }
    });
    if (to && p.cash > 0) to.cash += p.cash;
    p.cash = 0;
    p.out = true;
    p.outRound = this.round;
    p.outOrder = this.players.filter(x => x.out).length;
    if (ownDebt) this.debt = null;
    this.voidTradesFor(p.id);
    if (!this.instant) Sound.play('lose');
    this.say(`<b>${p.name}</b> is bankrupt${to ? ', and everything passes to <b>' + to.name + '</b>' : '; the holdings return to the bank'}.`, true);
    const left = this.alive();
    if (left.length === 1) {
      this.phase = 'over';
      if (!this.instant) Sound.play('win');
      this.say(`<b>${left[0].name}</b> wins the circuit.`, true);
      this.stopAll();
      render();
      showEndScreen(left[0]);
      return;
    }
    if (p.id === this.cur().id) this.endTurn();
    else if (ownDebt) this.afterAction();
  },

  /* ---- movement ---------------------------------------------------- */
  beginTurn() {
    const p = this.cur();
    this.seq++;
    if (p.out) return this.endTurn();
    p.turns++;
    this.doubleStreak = 0;
    this.lastDouble = false;
    p.triedTrade = false;
    this.rentMultiplier = null;
    this.phase = p.inJail ? 'jail' : 'roll';
    render();
    this.maybeBot();
  },

  rollDice() {
    if (this.animating) return;
    this.touch();
    const p = this.cur();
    const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
    this.animating = true;
    render();                       // buttons off while the cubes are in the air
    if (!this.instant) Sound.play('roll');
    throwDice([a, b]);
    setTimeout(() => {
      if (p.out || this.phase === 'over') return;
      this.animating = false;
      this.dice = [a, b];
      this.lastDouble = a === b;
      this.resolveRoll(p, a, b);
    }, this.instant ? 0 : ROLL_MS + 140);
  },

  resolveRoll(p, a, b) {
    if (!this.instant) Sound.play('land');
    const total = a + b;
    if (p.inJail) {
      if (a === b) {
        p.inJail = false; p.jailTurns = 0;
        this.say(`<b>${p.name}</b> rolled doubles and walks out of prison.`);
        this.lastDouble = false; // no bonus roll after a jail exit
        this.step(p, total);
        return;
      }
      p.jailTurns++;
      if (p.jailTurns >= 3) {
        this.say(`<b>${p.name}</b> served three turns and pays the $50 release.`);
        if (this.debit(p, 50, null, true)) {
          p.inJail = false; p.jailTurns = 0;
          this.step(p, total);
        } else { render(); this.maybeBot(); }
        return;
      }
      this.say(`<b>${p.name}</b> failed to roll doubles (${a} and ${b}).`);
      this.phase = 'end';
      render(); this.maybeBot();
      return;
    }

    if (a === b) {
      this.doubleStreak++;
      if (this.doubleStreak === 3) {
        this.say(`<b>${p.name}</b> rolled a third double in a row.`);
        this.sendToJail(p);
        this.phase = 'end';
        render(); this.maybeBot();
        return;
      }
    }
    this.say(`<b>${p.name}</b> rolled ${a} and ${b}${a === b ? ' (double)' : ''}.`);
    this.step(p, total);
  },

  /* The token glides square to square on its own layer above the board. */
  walk(p, steps, dir, credit, done) {
    if (steps <= 0) return done();

    const hop = () => {
      p.pos = (p.pos + dir + 40) % 40;
      if (credit && p.pos === 0) {
        p.cash += 200;
        this.say(`<b>${p.name}</b> passed Start and collected <span class="amt">$200</span>.`);
      }
    };

    if (this.instant) {
      for (let i = 0; i < steps; i++) hop();
      return done();
    }

    this.walking = true;
    this.moverId = p.id;
    render();                      // the token leaves its tile for the mover layer

    const path = [p.pos];
    for (let i = 1; i <= steps; i++) path.push((p.pos + dir * i + 40) % 40);
    const marks = path.map(tileCentre);
    const el = addMover(p);

    const t0 = performance.now();
    let applied = 0;
    const frame = () => {
      if (this.phase === 'over' || p.out) {   // forfeit or bankruptcy mid-walk
        removeMover(el);
        this.walking = false; this.moverId = null;
        return;
      }
      /* Position comes from elapsed time, so a dropped frame skips ahead
         rather than stretching the move out. */
      const progress = Math.min(steps, (performance.now() - t0) / HOP_MS);
      const leg = Math.min(steps - 1, Math.floor(progress));
      placeMover(el, marks[leg], marks[leg + 1], Math.min(1, progress - leg));
      let crossed = false;
      while (applied < Math.floor(progress)) { hop(); applied++; crossed = true; }
      if (crossed) renderPlayers();
      if (progress < steps) { this._walkFrame = requestAnimationFrame(frame); return; }
      while (applied < steps) { hop(); applied++; }
      removeMover(el);
      this.walking = false;
      this.moverId = null;
      renderPlayers();
      done();
    };
    this._walkFrame = requestAnimationFrame(frame);
  },

  step(p, steps) {
    this.walk(p, steps, 1, true, () => this.landOn(p));
  },

  moveTo(p, idx, collectPass) {
    if (collectPass) {
      this.walk(p, (idx - p.pos + 40) % 40, 1, true, () => this.landOn(p));
    } else {
      this.walk(p, (p.pos - idx + 40) % 40, -1, false, () => this.landOn(p));
    }
  },

  advanceToNearest(p, type) {
    let i = p.pos;
    for (let n = 1; n <= 40; n++) {
      i = (p.pos + n) % 40;
      if (BOARD[i].type === type) break;
    }
    this.rentMultiplier = type === 'airport' ? 2 : 10;
    this.moveTo(p, i, true);
  },

  sendToJail(p) {
    p.pos = 10; p.inJail = true; p.jailTurns = 0;
    this.lastDouble = false;
    if (!this.instant) Sound.play('jail');
    this.say(`<b>${p.name}</b> goes to prison.`, true);
  },

  buildingCount(p, perHouse, perHotel) {
    let sum = 0;
    this.tiles.forEach(t => {
      if (t.owner !== p.id) return;
      if (t.houses === 5) sum += perHotel;
      else sum += t.houses * perHouse;
    });
    return sum;
  },

  payAll(p, amt) {
    let total = 0;
    this.alive().forEach(o => { if (o.id !== p.id) total += amt; });
    this.say(`<b>${p.name}</b> pays every player <span class="amt">${money(amt)}</span>.`);
    if (!this.debit(p, total, null, true)) return;
    this.alive().forEach(o => { if (o.id !== p.id) o.cash += amt; });
  },

  takePot(p) {
    if (!this.rules.vacationCash || this.pot <= 0) {
      this.say(`The pot is empty.`);
      return;
    }
    p.cash += this.pot;
    this.say(`<b>${p.name}</b> swept the pot: <span class="amt">${money(this.pot)}</span>.`, true);
    this.pot = 0;
  },

  giveCheapestDeed(p) {
    let pick = -1;
    BOARD.forEach((def, i) => {
      if (this.tiles[i].owner !== null || !(def.price > 0)) return;
      if (pick === -1 || def.price < BOARD[pick].price) pick = i;
    });
    if (pick === -1) { this.say(`Nothing is left unclaimed.`); return; }
    this.tiles[pick].owner = p.id;
    this.say(`<b>${p.name}</b> was handed ${BOARD[pick].name} for nothing.`, true);
  },

  seizeRandomDeed(p) {
    const held = ownedIdx(p.id).filter(i => !this.tiles[i].houses);
    if (!held.length) { this.say(`<b>${p.name}</b> has nothing the bank can take.`); return; }
    const idx = held[Math.floor(Math.random() * held.length)];
    this.tiles[idx] = { owner: null, houses: 0, mortgaged: false };
    this.say(`<b>${p.name}</b> lost ${BOARD[idx].name} back to the bank.`, true);
  },

  swapWithLeader(p) {
    const leader = this.alive().reduce((best, o) => (o.cash > best.cash ? o : best), p);
    if (leader.id === p.id) { this.say(`<b>${p.name}</b> is already the one to beat.`); return; }
    const there = leader.pos;
    leader.pos = p.pos;
    p.pos = there;
    this.say(`<b>${p.name}</b> and <b>${leader.name}</b> changed places. No rent is due on the exchange.`, true);
  },

  collectFromAll(p, amt) {
    this.alive().forEach(o => {
      if (o.id === p.id) return;
      const take = Math.min(o.cash, amt);
      o.cash -= take; p.cash += take;
    });
    this.say(`<b>${p.name}</b> collected <span class="amt">${money(amt)}</span> from each player.`);
  },

  /* ---- landing ----------------------------------------------------- */
  landOn(p) {
    const idx = p.pos, def = BOARD[idx], t = this.tiles[idx];

    switch (def.type) {
      case 'start':
        this.credit(p, 100);
        this.say(`<b>${p.name}</b> landed squarely on Start for a $100 bonus.`);
        break;

      case 'jail':
        if (!p.inJail) this.say(`<b>${p.name}</b> is only visiting the prison.`);
        break;

      case 'gotojail':
        this.sendToJail(p);
        break;

      case 'vacation':
        if (!this.rules.vacationCash) {
          this.say(`<b>${p.name}</b> is on vacation. Nothing to collect.`);
        } else if (this.pot > 0) {
          p.cash += this.pot;
          this.say(`<b>${p.name}</b> took the vacation pot: <span class="amt">${money(this.pot)}</span>.`, true);
          this.pot = 0;
        } else this.say(`<b>${p.name}</b> is on vacation. The pot is empty.`);
        break;

      case 'tax': {
        const amt = def.flat || Math.min(def.cap, Math.round(this.netWorth(p) * def.rate));
        this.say(`<b>${p.name}</b> owes ${def.name} of <span class="amt">${money(amt)}</span>.`);
        if (!this.debit(p, amt, null, true)) { render(); this.maybeBot(); return; }
        break;
      }

      case 'refund':
        this.credit(p, def.amount);
        this.say(`<b>${p.name}</b> collected a tax refund.`);
        break;

      case 'surprise':
      case 'treasure':
      case 'fortune': {
        const deck = def.type === 'surprise' ? SURPRISE : def.type === 'treasure' ? TREASURE : FORTUNE;
        const card = deck[Math.floor(Math.random() * deck.length)];
        const line = typeof card.text === 'function' ? card.text() : card.text;
        const deckName = def.type === 'surprise' ? 'a Surprise' : def.type === 'treasure' ? 'a Treasure' : 'a Fortune';
        if (!this.instant) Sound.play('card');
        this.say(`<b>${p.name}</b> drew ${deckName}: ${line}`, true);
        card.act(p);
        if (this.walking) return;   // the walk calls landOn again on arrival
        break;
      }

      default: { // city, airport, utility
        if (t.owner === null) {
          if (p.cash >= def.price || this.rules.auction) { this.phase = 'decide'; render(); this.maybeBot(); return; }
          this.say(`<b>${p.name}</b> cannot afford ${def.name}.`);
        } else if (t.owner !== p.id && !t.mortgaged) {
          const owner = this.players[t.owner];
          if (owner.inJail && this.rules.noRentInPrison) {
            this.say(`<b>${owner.name}</b> is in prison, so ${def.name} collects nothing.`);
            break;
          }
          const rent = this.rentOf(idx);
          this.say(`<b>${p.name}</b> owes <b>${owner.name}</b> <span class="amt">${money(rent)}</span> for ${def.name}.`);
          if (!this.debit(p, rent, owner, false)) { render(); this.maybeBot(); return; }
        } else if (t.mortgaged && t.owner !== p.id) {
          this.say(`${def.name} is mortgaged, so no rent is due.`);
        }
      }
    }
    this.afterAction();
  },

  rentOf(idx) {
    const def = BOARD[idx], t = this.tiles[idx];
    const roll = this.dice[0] + this.dice[1];
    if (def.type === 'airport') {
      const n = countOwned(t.owner, 'airport');
      const base = AIRPORT_RENT[n - 1];
      return this.rentMultiplier === 2 ? base * 2 : base;
    }
    if (def.type === 'utility') {
      if (this.rentMultiplier === 10) return roll * 10;
      return roll * (countOwned(t.owner, 'utility') === 2 ? 10 : 4);
    }
    if (t.houses > 0) return def.rents[t.houses];
    return (this.rules.x2Rent && ownsGroup(t.owner, def.group)) ? def.rents[0] * 2 : def.rents[0];
  },

  buy(idx) {
    this.touch();
    const p = this.cur(), def = BOARD[idx];
    p.cash -= def.price;
    this.tiles[idx].owner = p.id;
    if (!this.instant) Sound.play('buy');
    this.say(`<b>${p.name}</b> bought ${def.name} for <span class="amt">${money(def.price)}</span>.`, true);
    this.afterAction();
  },

  decline() {
    this.touch();
    const p = this.cur();
    this.say(`<b>${p.name}</b> passed on ${BOARD[p.pos].name}.`);
    if (this.rules.auction) return this.startAuction(p.pos);
    this.afterAction();
  },

  afterAction() {
    this.seq++;
    if (this.phase === 'over') return;
    if (this.debt) { this.phase = 'debt'; render(); this.maybeBot(); return; }
    this.rentMultiplier = null;
    const p = this.cur();
    this.phase = (this.lastDouble && !p.inJail && !p.out) ? 'roll' : 'end';
    if (this.phase === 'roll') this.say(`Doubles for <b>${p.name}</b>. Another roll.`);
    render();
    this.maybeBot();
  },

  endTurn() {
    if (this.debt || this.walking || this.phase === 'over') return;
    this.touch();
    let guard = 0;
    do {
      this.turn = (this.turn + 1) % this.players.length;
      if (this.turn === 0) this.round++;
      guard++;
    } while (this.cur().out && guard < 20);
    this.beginTurn();
  },

  /* ---- property management ----------------------------------------- */
  canBuild(idx) {
    const def = BOARD[idx], t = this.tiles[idx];
    if (def.type !== 'city' || t.owner === null) return false;
    const p = this.players[t.owner];
    if (!ownsGroup(t.owner, def.group)) return false;
    if (groupIdx(def.group).some(i => this.tiles[i].mortgaged)) return false;
    if (t.houses >= 5) return false;
    if (this.rules.evenBuild) {
      const min = Math.min(...groupIdx(def.group).map(i => this.tiles[i].houses));
      if (t.houses > min) return false;
    }
    return p.cash >= def.house;
  },
  build(idx) {
    const def = BOARD[idx], t = this.tiles[idx];
    this.players[t.owner].cash -= def.house;
    t.houses++;
    this.say(`<b>${this.players[t.owner].name}</b> ${t.houses === 5 ? 'raised a hotel on' : 'built on'} ${def.name}.`);
    render();
  },
  canSell(idx) {
    const def = BOARD[idx], t = this.tiles[idx];
    if (def.type !== 'city' || !t.houses) return false;
    if (!this.rules.evenBuild) return true;
    const max = Math.max(...groupIdx(def.group).map(i => this.tiles[i].houses));
    return t.houses >= max;
  },
  sellHouse(idx) {
    const def = BOARD[idx], t = this.tiles[idx];
    t.houses--;
    this.players[t.owner].cash += Math.floor(def.house / 2);
    this.say(`<b>${this.players[t.owner].name}</b> sold a building on ${def.name} for <span class="amt">${money(Math.floor(def.house / 2))}</span>.`);
    render();
  },
  canMortgage(idx) {
    if (!this.rules.mortgage) return false;
    const t = this.tiles[idx], def = BOARD[idx];
    if (t.owner === null || t.mortgaged || t.houses) return false;
    if (def.type === 'city' && groupIdx(def.group).some(i => this.tiles[i].houses)) return false;
    return true;
  },
  mortgage(idx) {
    const t = this.tiles[idx], def = BOARD[idx];
    t.mortgaged = true;
    this.players[t.owner].cash += Math.floor(def.price / 2);
    this.say(`<b>${this.players[t.owner].name}</b> mortgaged ${def.name} for <span class="amt">${money(Math.floor(def.price / 2))}</span>.`);
    render();
  },
  canRedeem(idx) {
    const t = this.tiles[idx], def = BOARD[idx];
    return t.mortgaged && this.players[t.owner].cash >= Math.ceil(def.price * 0.55);
  },
  redeem(idx) {
    const t = this.tiles[idx], def = BOARD[idx];
    const cost = Math.ceil(def.price * 0.55);
    this.players[t.owner].cash -= cost;
    t.mortgaged = false;
    this.say(`<b>${this.players[t.owner].name}</b> redeemed ${def.name} for <span class="amt">${money(cost)}</span>.`);
    render();
  },

  /* ---- auctions ------------------------------------------------------ */
  /* A stop nobody bought goes under the hammer. Anyone may bid at any time;
     every bid resets a five second clock, and when it runs out the highest
     bid takes the deed. */
  AUCTION_MS: 5000,

  bidSteps(idx) {
    const price = BOARD[idx].price || 100;
    return [
      Math.max(2, Math.round(price * 0.01 / 2) * 2),
      Math.max(10, Math.round(price * 0.05 / 5) * 5),
      Math.max(100, Math.round(price * 0.5 / 10) * 10)
    ];
  },

  startAuction(idx) {
    this.auction = {
      idx, bid: 0, high: null,
      endsAt: Date.now() + this.AUCTION_MS,
      opened: Date.now()
    };
    this.phase = 'auction';
    this.seq++;
    this.say(`${BOARD[idx].name} goes under the hammer.`, true);
    render();
    this.runAuctionClock();
    this.botsConsider();
  },

  runAuctionClock() {
    clearInterval(this._auctionTimer);
    this._auctionTimer = setInterval(() => {
      const a = this.auction;
      if (!a) { clearInterval(this._auctionTimer); return; }
      if (G.remote) { renderAuction(); return; }        // guests only watch the clock
      if (Date.now() >= a.endsAt) this.closeAuction();
      else renderAuction();
    }, 120);
  },

  auctionLeft() {
    return this.auction ? Math.max(0, this.auction.endsAt - Date.now()) : 0;
  },

  /* level 0, 1, 2: a little more, rather more, a lot more */
  placeBid(playerId, level) {
    this.touch();
    const a = this.auction;
    if (!a) return;
    const p = this.players[playerId];
    if (!p || p.out) return;
    const amount = a.bid + this.bidSteps(a.idx)[level];
    if (amount <= a.bid || p.cash < amount) return;
    a.bid = amount;
    a.high = p.id;
    a.endsAt = Date.now() + this.AUCTION_MS;
    this.say(`<b>${p.name}</b> bid <span class="amt">${money(amount)}</span> for ${BOARD[a.idx].name}.`);
    render();
    this.botsConsider();
  },

  closeAuction() {
    const a = this.auction;
    if (!a) return;
    clearInterval(this._auctionTimer);
    clearTimeout(this._botBidTimer);
    this.auction = null;
    closeAuctionModal();
    if (a.high === null) {
      this.say(`Nobody bid for ${BOARD[a.idx].name}; it stays with the bank.`);
    } else {
      const winner = this.players[a.high];
      winner.cash -= a.bid;
      this.tiles[a.idx].owner = winner.id;
      this.say(`<b>${winner.name}</b> took ${BOARD[a.idx].name} at auction for <span class="amt">${money(a.bid)}</span>.`, true);
    }
    this.afterAction();
  },

  /* What a house player will go to for this deed. */
  botCeiling(bot, idx) {
    const def = BOARD[idx];
    const mates = def.type === 'city' ? groupIdx(def.group) : [];
    const mine = mates.filter(i => this.tiles[i].owner === bot.id).length;
    let ceiling = def.type === 'city'
      ? def.price * (mine && mine === mates.length - 1 ? 1.7 : mine ? 1.2 : 0.8)
      : def.price * 1.1;
    return Math.min(ceiling, bot.cash - 120);
  },

  botsConsider() {
    if (G.remote) return;
    clearTimeout(this._botBidTimer);
    const a = this.auction;
    if (!a) return;
    const steps = this.bidSteps(a.idx);
    const keen = this.alive().filter(p =>
      p.bot && p.id !== a.high && this.botCeiling(p, a.idx) >= a.bid + steps[0]);
    if (!keen.length) return;
    const bidder = keen[Math.floor(Math.random() * keen.length)];
    const wait = 700 + Math.random() * 1800;
    this._botBidTimer = setTimeout(() => {
      if (!this.auction || this.auction !== a) return;
      const room = this.botCeiling(bidder, a.idx) - a.bid;
      let level = 0;
      if (room > steps[2] * 1.4 && Math.random() < 0.35) level = 2;
      else if (room > steps[1] * 2) level = 1;
      this.placeBid(bidder.id, level);
    }, wait);
  },

  /* Cancel anything still in flight: bot timers, a walk, a pending offer. */
  stopAll() {
    clearTimeout(this._botTimer);
    if (this._walkFrame) cancelAnimationFrame(this._walkFrame);
    this.walking = false;
    this.moverId = null;
    this.clock.key = null;
  },

  restart() {
    this.stopAll();
    closeModal();
    this.entries = [];
    this.pot = 0;
    this.round = 1;
    this.debt = null;
    this.auction = null;
    this.trades = [];
    this.dice = [1, 1];
    this.litPlayer = null;
    applyMap(this.rules.map);
    this.start(seats);
  },

  backToLobby() {
    this.stopAll();
    this.phase = 'over';
    closeModal();
    $('#app').hidden = true;
    $('#setup').hidden = false;
  },

  /* ---- decision clock ------------------------------------------------ */
  /* Whoever must act has TURN_LIMIT to do it. Running out forfeits the game. */
  /* Any accepted action stops the clock immediately, so a player who has
     already moved cannot be timed out while the dice or token are still
     travelling. */
  touch() {
    this.clock.key = null;
    this.clock.grace = false;
  },

  syncClock() {
    const actor = this.actor();
    const live = this.phase !== 'over' && !this.auction && actor && !actor.bot && !actor.out;
    if (!live) { this.clock.key = null; paintClock(); return; }
    const key = `${actor.id}|${this.phase}|${this.seq}`;
    if (key !== this.clock.key) {
      this.clock.key = key;
      this.clock.who = actor.id;
      this.clock.grace = false;
      this.clock.deadline = Date.now() + TURN_LIMIT;
    }
    paintClock();
  },

  forfeit(p) {
    if (this.phase === 'over' || p.out) return;
    this.clock.key = null;
    this.say(`<b>${p.name}</b> ran out of time and forfeits.`, true);
    this.voidTradesFor(p.id);
    closeModal();
    this.bankrupt(p);
    render();
  },

  surrender(id) {
    const p = this.players[id];
    if (!p || p.out || this.phase === 'over') return;
    if (p.id === this.cur().id) {
      this.stopAll();
      this.animating = false;
      document.querySelectorAll('.mover').forEach(el => el.remove());
      clearInterval(this._auctionTimer);
      clearTimeout(this._botBidTimer);
      this.auction = null;
      closeAuctionModal();
    } else if (this.auction && this.auction.high === id) {
      this.auction.high = null;
      this.auction.bid = 0;
      this.auction.endsAt = Date.now() + this.AUCTION_MS;
    }
    this.say(`<b>${p.name}</b> surrendered.`, true);
    this.bankrupt(p);
    render();
  },

  /* ---- house players ------------------------------------------------ */
  maybeBot() {
    const p = this.cur();
    if (this.phase === 'over') return;
    const actor = this.actor();
    if (!actor.bot) return;
    clearTimeout(this._botTimer);
    this._botTimer = setTimeout(() => this.botStep(), 520);
  },

  botStep() {
    if (this.phase === 'over' || this.walking || this.animating) return;
    const p = this.cur();
    /* A timer queued before the state moved on must not act for a human. */
    const actor = this.actor();
    if (!actor.bot) return;

    if (this.auction) return;

    if (this.debt) {
      const d = this.debt;
      if (!d.player.bot) return;
      if (d.player.cash >= d.amount) return this.settleDebt();
      if (!this.raiseFunds(d.player, d.amount)) return this.bankrupt(d.player);
      render();
      return this.maybeBot();
    }

    if (this.phase === 'jail') {
      if (p.pardons > 0) {
        p.pardons--; p.inJail = false; p.jailTurns = 0;
        this.say(`<b>${p.name}</b> used release paperwork to leave prison.`);
        this.phase = 'roll'; render(); return this.maybeBot();
      }
      if (p.cash > 250 && p.jailTurns >= 1) {
        if (this.debit(p, 50, null, true)) { p.inJail = false; p.jailTurns = 0; this.phase = 'roll'; }
        render(); return this.maybeBot();
      }
      this.phase = 'roll'; return this.rollDice();
    }

    if (this.phase === 'roll') return this.rollDice();

    if (this.phase === 'decide') {
      const def = BOARD[p.pos];
      if (this.botWantsToBuy(p, p.pos)) this.buy(p.pos); else this.decline();
      void def;
      return;
    }

    if (this.phase === 'end') {
      if (!p.triedTrade) { p.triedTrade = true; if (this.botSeekTrade(p)) return; }
      if (this.botBuild(p)) { render(); return this.maybeBot(); }
      return this.endTurn();
    }
  },

  /* The house shops for the one deed that would finish a country. It puts an
     offer on the trades board and carries on; the answer can come any time. */
  botSeekTrade(p) {
    if (this.trades.some(t => t.status === 'open' && t.from === p.id)) return false;
    const wanted = [];
    BOARD.forEach((def, i) => {
      if (def.type !== 'city') return;
      const t = this.tiles[i];
      if (t.owner === null || t.owner === p.id || t.houses || t.mortgaged) return;
      const mates = groupIdx(def.group);
      const missing = mates.filter(j => this.tiles[j].owner !== p.id);
      if (missing.length === 1 && missing[0] === i) wanted.push(i);
    });
    if (!wanted.length) return false;
    wanted.sort((a, b) => BOARD[b].rents[3] - BOARD[a].rents[3]);
    const idx = wanted[0];
    const def = BOARD[idx];
    const offer = Math.round(def.price * 2.1);
    if (p.cash - offer < 300) return false;
    const holder = this.players[this.tiles[idx].owner];
    if (holder.out) return false;
    proposeTrade({ fromId: p.id, toId: holder.id, give: [], get: [idx], giveCash: offer, getCash: 0 });
    return false;                 // the offer stands; the turn carries on
  },

  /* An offer dies with either party. */
  voidTradesFor(id) {
    this.trades.forEach(t => {
      if (t.status === 'open' && (t.from === id || t.to === id)) t.status = 'void';
    });
  },

  botWantsToBuy(p, idx) {
    const def = BOARD[idx];
    const reserve = 120 + (this.round > 6 ? 100 : 0);
    if (p.cash - def.price < reserve) return false;
    if (def.type !== 'city') return true;
    const mates = groupIdx(def.group);
    const mine = mates.filter(i => this.tiles[i].owner === p.id).length;
    const theirs = mates.filter(i => this.tiles[i].owner !== null && this.tiles[i].owner !== p.id).length;
    if (mine > 0) return true;             // extends a country already started
    if (theirs === mates.length - 1) return true; // blocks an opponent's set
    return p.cash > def.price * 2.2;
  },

  botBuild(p) {
    const options = [];
    this.tiles.forEach((t, i) => {
      if (t.owner === p.id && this.canBuild(i) && p.cash - BOARD[i].house > 220) options.push(i);
    });
    if (!options.length) return false;
    options.sort((a, b) => BOARD[b].rents[3] - BOARD[a].rents[3]);
    this.build(options[0]);
    return true;
  },

  /* Sell buildings, then mortgage, until the target is met. */
  raiseFunds(p, target) {
    let guard = 0;
    while (p.cash < target && guard++ < 100) {
      const sellable = this.tiles.map((t, i) => i).filter(i => this.tiles[i].owner === p.id && this.canSell(i));
      if (sellable.length) {
        sellable.sort((a, b) => BOARD[a].rents[3] - BOARD[b].rents[3]);
        this.sellHouse(sellable[0]);
        continue;
      }
      const mortgageable = this.tiles.map((t, i) => i).filter(i => this.tiles[i].owner === p.id && this.canMortgage(i));
      if (mortgageable.length) {
        mortgageable.sort((a, b) => BOARD[a].price - BOARD[b].price);
        this.mortgage(mortgageable[0]);
        continue;
      }
      return false;
    }
    return p.cash >= target;
  }
};

/* ---- helpers ---------------------------------------------------------- */
function groupIdx(group) {
  const out = [];
  BOARD.forEach((d, i) => { if (d.type === 'city' && d.group === group) out.push(i); });
  return out;
}
function ownsGroup(ownerId, group) {
  if (ownerId === null) return false;
  return groupIdx(group).every(i => G.tiles[i].owner === ownerId);
}
function countOwned(ownerId, type) {
  let n = 0;
  BOARD.forEach((d, i) => { if (d.type === type && G.tiles[i].owner === ownerId) n++; });
  return n;
}
function ownedIdx(playerId) {
  const out = [];
  G.tiles.forEach((t, i) => { if (t.owner === playerId) out.push(i); });
  return out;
}
function propValue(idx) {
  const def = BOARD[idx], t = G.tiles[idx];
  let v = t.mortgaged ? def.price * 0.5 : def.price;
  if (t.houses) v += t.houses * def.house;
  if (def.type === 'city' && ownsGroup(t.owner, def.group)) v *= 1.6;
  return v;
}

/* ====================================================================== */
/* Rendering                                                               */
/* ====================================================================== */

function tileSide(i) {
  if (i <= 10) return 'bottom';
  if (i <= 19) return 'left';
  if (i <= 30) return 'top';
  return 'right';
}
function tilePlace(i) {
  if (i <= 10) return { col: 11 - i, row: 11 };
  if (i <= 19) return { col: 1, row: 11 - (i - 10) };
  if (i <= 30) return { col: i - 19, row: 1 };
  return { col: 11, row: (i - 30) + 1 };
}

function iconHTML(def, cls) {
  const key = def.icon;
  if (!key) return '';
  return `<span class="icon i-${key} ${cls || ''}" title="${KIND_LABEL[def.type] || def.name}">${ICON_SVG[key]}</span>`;
}

function flagHTML(group) {
  const svg = FLAG_SVG[group];
  if (!svg) return '';
  return `<span class="flag" title="${GROUPS[group].name}">${svg}</span>`;
}

const KIND_LABEL = {
  treasure: 'Treasure', surprise: 'Surprise', airport: 'Airport',
  fortune: 'Fortune', refund: 'Tax refund',
  utility: 'Utility', tax: 'Tax', vacation: 'Take the pot',
  start: 'Collect $200', jail: 'Just visiting', gotojail: 'Do not pass Start'
};

const HOP_MS = 190;          // time to cross one square
const MOVER_SIZE = 26;

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

function tileCentre(i) {
  const el = $(`.tile[data-idx="${i}"]`);
  if (!el) return { x: 0, y: 0 };
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
}

function addMover(p) {
  const el = document.createElement('div');
  el.className = 'mover';
  el.innerHTML = avatarSVG(p.color, p.id, MOVER_SIZE);
  $('#board').appendChild(el);
  return el;
}

function placeMover(el, from, to, frac) {
  const leg = from.x + ':' + from.y;
  if (el.dataset.soundLeg !== leg) { el.dataset.soundLeg = leg; Sound.play('step'); }
  const e = easeInOut(frac);
  const x = from.x + (to.x - from.x) * e;
  const y = from.y + (to.y - from.y) * e - Math.sin(Math.PI * frac) * 7;
  const lift = 1 + Math.sin(Math.PI * frac) * 0.16;
  el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px) scale(${lift})`;
}

function removeMover(el) { if (el && el.parentNode) el.remove(); }

/* Long city names step down a size so they stay inside their tile. */
function nameFit(name) {
  const longest = Math.max(...name.split(' ').map(w => w.length));
  if (longest <= 6) return '';
  if (longest <= 8) return ' s2';
  if (longest <= 9) return ' s3';
  return ' s4';
}

/* One house mark with a count, or a single hotel once the fifth is built. */
function housesHTML(n) {
  if (n === 5) return `<div class="houses"><span class="icon i-hotel" title="Hotel">${ICON_SVG.hotel}</span></div>`;
  return `<div class="houses"><span class="icon i-house" title="${n} house${n > 1 ? 's' : ''}">${ICON_SVG.house}</span>` +
         `${n > 1 ? `<span class="mult">&times;${n}</span>` : ''}</div>`;
}

function pawnsHTML(i) {
  const here = G.players.filter(p => !p.out && p.pos === i && p.id !== G.moverId);
  if (!here.length) return '';
  return `<div class="pawns">${here.map(p =>
    `<span class="pawn${p.id === G.cur().id && !G.walking && ['roll', 'jail'].includes(G.phase) ? ' awaiting-move' : ''}" title="${p.name}">${avatarSVG(p.color, p.id, 26)}</span>`
  ).join('')}</div>`;
}

/* Redraw only the tokens, so a walk does not rebuild the whole board. */
function renderPawns() {
  const board = $('#board');
  if (!board) return;
  board.classList.toggle('walking', G.walking);
  board.querySelectorAll('.tile').forEach(el => {
    const old = el.querySelector('.pawns');
    if (old) old.remove();
    const html = pawnsHTML(Number(el.dataset.idx));
    if (html) el.insertAdjacentHTML('beforeend', html);
  });
}

function renderBoard() {
  const board = $('#board');
  board.innerHTML = '';

  BOARD.forEach((def, i) => {
    const t = G.tiles[i];
    const side = tileSide(i);
    const place = tilePlace(i);
    const corner = [0, 10, 20, 30].includes(i);

    const el = document.createElement('div');
    el.className = `tile t-${side}${corner ? ' corner' : ''}${t.owner !== null ? ' owned' : ''}${t.mortgaged ? ' is-mortgaged' : ''}`;
    el.dataset.idx = i;
    el.style.gridColumn = place.col;
    el.style.gridRow = place.row;

    let inner = '';
    if (def.type === 'city') {
      inner += `<div class="band" style="background:${GROUPS[def.group].color}"></div>`;
    }
    const bits = [];
    if (def.type === 'city') {
      bits.push(`<div class="nm${nameFit(def.name)}">${def.name}</div>`);
      if (t.owner === null) bits.push(`<div class="pr">${money(def.price)}</div>`);
      if (t.houses) bits.push(housesHTML(t.houses));
    } else if (def.type === 'airport' || def.type === 'utility') {
      bits.push(iconHTML(def));
      bits.push(`<div class="nm${nameFit(def.name)}">${def.name}</div>`);
      if (t.owner === null) bits.push(`<div class="pr">${money(def.price)}</div>`);
    } else if (def.type === 'tax' || def.type === 'refund') {
      bits.push(iconHTML(def));
      bits.push(`<div class="nm${nameFit(def.name)}">${def.name}</div>`);
      bits.push(`<div class="pr">${def.type === 'refund' ? '+$' + def.amount : def.flat ? '$' + def.flat : '10%'}</div>`);
    } else {
      bits.push(iconHTML(def, corner ? 'big' : ''));
      bits.push(`<div class="nm">${def.name}</div>`);
      if (def.type === 'vacation') {
        bits.push(`<div class="pr vacation-amount" aria-label="Vacation pot: ${money(G.pot)}">${money(G.pot)}</div>`);
      } else if (KIND_LABEL[def.type] && corner) {
        bits.push(`<div class="kind">${KIND_LABEL[def.type]}</div>`);
      }
    }
    inner += `<div class="body">${bits.join('')}</div>`;
    if (def.type === 'city') inner += flagHTML(def.group);
    if (t.owner !== null) inner += `<span class="ownerbar" style="background:${G.players[t.owner].color}"></span>`;
    if (t.mortgaged) inner += `<span class="mortgage-x" title="Mortgaged">M</span>`;

    inner += pawnsHTML(i);

    el.innerHTML = inner;
    if (t.owner !== null || ['city', 'airport', 'utility'].includes(def.type)) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => openDeed(i));
    }
    board.appendChild(el);
  });

  const centre = document.createElement('div');
  centre.className = 'centre';
  centre.innerHTML =
    `<div class="wordmark">Grand Circuit</div>
     <div class="clock" id="clock" hidden>
       <span class="clock-who"></span>
       <span class="clock-time">3:00</span>
       <span class="clock-bar"><i></i></span>
     </div>
     <div class="dice" id="dice"></div>
     <div class="turnbox" id="turnbox"></div>
     <div class="centre-msg" id="centreMsg"></div>`;
  board.appendChild(centre);
  renderDice();
  renderCentreMsg();
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/* Cube faces: opposite sides sum to seven. */
const FACES = [
  { v: 1, cls: 'front' }, { v: 6, cls: 'back' },
  { v: 2, cls: 'right' }, { v: 5, cls: 'left' },
  { v: 3, cls: 'top' },   { v: 4, cls: 'bottom' }
];

/* Rotation that puts the rolled value on the upward-facing side. */
const FACE_ROT = {
  1: { x: 90, y: 0 }, 6: { x: 90, y: 180 },
  2: { x: 90, y: -90 }, 5: { x: 90, y: 90 },
  3: { x: 0, y: 0 }, 4: { x: 180, y: 0 }
};

const ROLL_MS = 1000;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function faceHTML(v) {
  const on = PIPS[v];
  const cells = Array.from({ length: 9 }, (_, k) => on.includes(k) ? '<b></b>' : '<i></i>').join('');
  return cells;
}

function restTransform(v) {
  const r = FACE_ROT[v];
  return `rotateX(${r.x}deg) rotateY(${r.y}deg)`;
}

/* A fixed light illuminates the rounded mesh as the cube tumbles. */
function lightDie(cube) {
  const tilt = new DOMMatrixReadOnly(getComputedStyle(cube.parentElement).transform);
  const rotation = new DOMMatrixReadOnly(getComputedStyle(cube).transform);
  drawRoundedDie(cube, tilt.multiply(rotation));
}

/* Two cubes at rest, showing the dice as they last fell. */
function renderDice() {
  const host = $('#dice');
  if (!host) return;
  host.innerHTML = G.dice.map((v, k) => `
    <div class="die-lift">
      <canvas class="die-surface" aria-hidden="true"></canvas>
      <div class="die-tilt">
        <div class="die3d" data-die="${k}" style="transform:${restTransform(v)}">
          ${FACES.map(f => `<div class="face ${f.cls}">${faceHTML(f.v)}</div>`).join('')}
        </div>
      </div>
    </div>`).join('');
  host.querySelectorAll('.die3d').forEach(lightDie);
}

/* Throw the cubes up, tumble them, and set them down on the rolled values. */
function throwDice(values) {
  const host = $('#dice');
  if (!host) return;
  const cubes = [...host.querySelectorAll('.die3d')];
  const lifts = [...host.querySelectorAll('.die-lift')];
  if (cubes.length < 2 || reducedMotion() || !cubes[0].animate) {
    G.dice = values.slice();
    renderDice();
    return;
  }

  values.forEach((v, k) => {
    const cube = cubes[k], lift = lifts[k];
    const start = cube.style.transform || restTransform(G.dice[k]);
    const r = FACE_ROT[v];
    const turnsX = 360 * (1 + Math.floor(Math.random() * 2));
    const turnsY = 360;
    const end = `rotateX(${r.x - turnsX}deg) rotateY(${r.y + turnsY}deg)`;
    const delay = k * 70;
    const restitution = 0.34;
    const flight = 1 / (1 + restitution + restitution ** 2);
    const firstImpact = flight;
    const secondImpact = flight * (1 + restitution);
    const height = lift.clientHeight * (1.45 + Math.random() * 0.15);
    const nearEnd = (angle) =>
      `rotateX(${r.x - turnsX + angle}deg) rotateY(${r.y + turnsY - angle / 2}deg)`;

    const tumble = cube.animate(
      [
        { transform: start, easing: 'linear' },
        { transform: nearEnd(18), offset: firstImpact, easing: 'ease-out' },
        { transform: nearEnd(3), offset: secondImpact, easing: 'ease-out' },
        { transform: end }
      ],
      { duration: ROLL_MS, delay, easing: 'linear', fill: 'backwards' }
    );

    /* Exact quadratic ascent/descent: constant gravity, with each impact
       retaining 34% of vertical speed (and 34% squared of bounce height).
       The outer lift stays in screen coordinates, outside the cube's tilt. */
    const liftFrames = [];
    let offset = 0;
    for (let bounce = 0; bounce < 3; bounce++) {
      const duration = flight * restitution ** bounce;
      liftFrames.push(
        { transform: 'translateY(0px)', offset,
          easing: 'cubic-bezier(.333333,.666667,.666667,1)' },
        { transform: `translateY(${-height * restitution ** (2 * bounce)}px)`,
          offset: offset + duration / 2,
          easing: 'cubic-bezier(.333333,0,.666667,.333333)' }
      );
      offset += duration;
    }
    liftFrames.push({ transform: 'translateY(0px)', offset: 1 });
    lift.animate(liftFrames, { duration: ROLL_MS, delay, easing: 'linear' });

    cube.style.transform = end;
    const lightFrame = () => {
      if (!cube.isConnected) return;
      lightDie(cube);
      if (tumble.playState !== 'finished' && tumble.playState !== 'idle') {
        requestAnimationFrame(lightFrame);
      }
    };
    lightFrame();
  });
}

function renderCentreMsg() {
  const host = $('#centreMsg');
  if (!host) return;
  const p = G.cur();
  const def = BOARD[p.pos];
  let msg;
  if (G.phase === 'over') msg = 'The circuit is closed.';
  else if (G.debt) msg = `<strong>${G.debt.player.name}</strong> must raise ${money(G.debt.amount)}.`;
  else if (G.auction) msg = `${BOARD[G.auction.idx].name} is under the hammer.`;
  else if (G.phase === 'decide') msg = `<strong>${p.name}</strong> landed on ${def.name}, unclaimed at ${money(def.price)}.`;
  else if (G.phase === 'jail') msg = `<strong>${p.name}</strong> is in prison, turn ${p.jailTurns + 1} of 3.`;
  else if (G.phase === 'roll') msg = `<strong>${p.name}</strong> to roll.`;
  else msg = `<strong>${p.name}</strong> is on ${def.name}.`;
  host.innerHTML = msg;
}

function renderPlayers() {
  const host = $('#players');
  host.innerHTML = G.players.map(p => {
    const holdings = ownedIdx(p.id).length;
    return `<li data-player="${p.id}" class="${p.id === G.turn && !p.out ? 'active' : ''}${p.out ? ' out' : ''}">
      <span class="disc">${avatarSVG(p.color, p.id, 30)}</span>
      <span class="who">
        <span class="nm">${p.name}</span>
        <span class="sub">${p.out ? 'Out' : (p.bot ? 'House' : 'Human')} &middot; ${holdings} held${p.inJail ? ' &middot; in prison' : ''}${p.pardons ? ' &middot; ' + p.pardons + ' pardon' : ''}</span>
      </span>
      <span class="cash">${money(p.cash)}</span>
      ${!p.out && G.phase !== 'over' && isMine(p) ? `<button class="btn danger surrender" type="button" onclick="surrenderPlayer(${p.id})">Surrender</button>` : ''}
    </li>`;
  }).join('');
  host.querySelectorAll('li[data-player]').forEach(li => {
    const id = Number(li.dataset.player);
    li.addEventListener('mouseenter', () => lightHoldings(id));
    li.addEventListener('mouseleave', () => lightHoldings(null));
    li.addEventListener('focus', () => lightHoldings(id));
    li.tabIndex = 0;
  });
  $('#roundLabel').textContent = 'Round ' + G.round;
}

const TURN_LIMIT = 180000;   // three minutes per decision
const GRACE_MS = 15000;      // and a final warning before the seat is lost

function clockText(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}

function paintClock() {
  const box = $('#clock');
  if (!box) return;
  if (!G.clock.key) { box.hidden = true; return; }
  const left = G.clock.deadline - Date.now();
  const grace = !!G.clock.grace;
  box.hidden = false;
  box.classList.toggle('urgent', grace || left <= 30000);
  box.classList.toggle('final', grace);
  box.querySelector('.clock-time').textContent = clockText(left);
  box.querySelector('.clock-bar i').style.width =
    Math.max(0, Math.min(100, (left / (grace ? GRACE_MS : TURN_LIMIT)) * 100)) + '%';
  box.querySelector('.clock-who').textContent = grace
    ? 'If you do not act, you lose the game'
    : G.players[G.clock.who].name + ' to act';
}

setInterval(() => {
  if (G.remote) { paintClock(); return; }     // the host owns the forfeit
  if (!G.clock.key) return;
  if (G.animating || G.walking) { paintClock(); return; }
  if (Date.now() < G.clock.deadline) { paintClock(); return; }
  if (!G.clock.grace) {
    /* Time is up, but nobody loses a game without a last warning. */
    G.clock.grace = true;
    G.clock.deadline = Date.now() + GRACE_MS;
    G.say(`<b>${G.players[G.clock.who].name}</b> is out of time and has ${GRACE_MS / 1000} seconds to act.`, true);
    render();
    return;
  }
  G.forfeit(G.players[G.clock.who]);
}, 250);

/* Hovering a player lights up every stop they hold. */
function lightHoldings(id) {
  G.litPlayer = id;
  applyLit();
}

function applyLit() {
  const board = $('#board');
  if (!board) return;
  board.querySelectorAll('.tile.lit').forEach(t => { t.classList.remove('lit'); t.style.removeProperty('--lit'); });
  document.querySelectorAll('.players li.lit-row').forEach(li => li.classList.remove('lit-row'));
  const id = G.litPlayer;
  if (id === null || id === undefined || !G.players[id]) { board.classList.remove('has-lit'); return; }
  const held = ownedIdx(id);
  board.classList.toggle('has-lit', held.length > 0);
  held.forEach(i => {
    const el = board.querySelector(`.tile[data-idx="${i}"]`);
    if (!el) return;
    el.classList.add('lit');
    el.style.setProperty('--lit', G.players[id].color);
  });
  const row = document.querySelector(`.players li[data-player="${id}"]`);
  if (row) row.classList.add('lit-row');
}

function renderTurn() {
  const host = $('#turnbox');
  const p = G.cur();
  const acting = G.debt ? G.debt.player : p;
  const humanTurn = isMine(acting) && G.phase !== 'over';
  let prompt = '', actions = '';

  if (G.walking) {
    prompt = '';
  } else if (G.auction) {
    prompt = 'The auction is open to the whole table.';
  } else if (G.phase === 'over') {
    prompt = 'The game is finished.';
    actions = `<button class="btn ghost" onclick="location.reload()">New game</button>`;
  } else if (G.debt) {
    const d = G.debt;
    prompt = `${d.player.name} owes ${money(d.amount)}${d.creditor ? ' to ' + d.creditor.name : ''}. Sell buildings or mortgage from Holdings to cover it.`;
    if (humanTurn) {
      actions =
        `<button class="btn solid xl" ${d.player.cash >= d.amount ? '' : 'disabled'} onclick="G.settleDebt(); render();">Pay ${money(d.amount)}</button>` +
        `<button class="btn danger" onclick="G.bankrupt(G.debt.player); render();">Declare bankruptcy</button>`;
    } else prompt += ' The house is raising funds.';
  } else if (isMine(p)) {
    if (G.phase === 'jail') {
      prompt = `${p.name} is in prison. Pay the $50 release, use paperwork, or roll for doubles.`;
      actions =
        `<button class="btn solid xl" ${p.cash >= 50 ? '' : 'disabled'} onclick="payRelease()">Get out for $50</button>` +
        (p.pardons ? `<button class="btn ghost" onclick="usePardon()">Use pardon</button>` : '') +
        `<button class="btn ghost" onclick="G.rollDice()">Roll for doubles</button>`;
    } else if (G.phase === 'roll') {
      prompt = G.lastDouble ? 'Doubles: you go again.' : '';
      actions = `<button class="btn solid xl" ${G.animating ? 'disabled' : ''} onclick="G.rollDice()">Roll the dice</button>`;
    } else if (G.phase === 'decide') {
      const def = BOARD[p.pos];
      const afford = p.cash >= def.price;
      prompt = afford ? '' : `${money(def.price)} is beyond you, so it can only go to auction.`;
      actions =
        (afford ? `<button class="btn solid xl" onclick="G.buy(${p.pos}); render();">Buy for ${money(def.price)}</button>` : '') +
        (G.rules.auction
          ? `<button class="btn ${afford ? 'ghost' : 'solid xl'}" onclick="G.decline(); render();">Auction</button>`
          : `<button class="btn ghost" onclick="G.decline(); render();">Pass</button>`) +
        `<button class="btn ghost" onclick="openDeed(${p.pos})">See the deed</button>`;
    } else {
      prompt = 'Build or mortgage during your turn. Trade at any time.';
      actions = `<button class="btn solid xl" onclick="G.endTurn()">End turn</button>`;
    }
  } else {
    prompt = '';
  }

  host.innerHTML = `<div class="actions">${actions}</div><p class="prompt">${prompt}</p>`;
  paintClock();
  $('#openTrade').disabled = G.phase === 'over' || !seated();
}

function renderHoldings() {
  const host = $('#holdings');
  const viewer = G.debt ? G.debt.player : G.cur();
  $('#holdingsWho').textContent = viewer.name;
  const mine = ownedIdx(viewer.id);
  if (!mine.length) {
    host.innerHTML = `<p class="empty">${viewer.name} holds nothing yet. Land on an unclaimed stop to start a portfolio.</p>`;
    return;
  }
  const byGroup = {};
  mine.forEach(i => {
    const def = BOARD[i];
    const key = def.type === 'city' ? def.group : def.type;
    (byGroup[key] = byGroup[key] || []).push(i);
  });

  host.innerHTML = Object.entries(byGroup).map(([key, list]) => {
    const g = GROUPS[key];
    const title = g ? g.name + (ownsGroup(viewer.id, key) ? ' &middot; complete' : ` &middot; ${list.length}/${groupIdx(key).length}`)
                    : (key === 'airport' ? 'Airports' : 'Utilities');
    const chip = g
      ? `${flagHTML(key)}<span class="chip" style="background:${g.color}"></span>`
      : `<span class="icon i-${key === 'airport' ? 'airport' : 'water'}">${ICON_SVG[key === 'airport' ? 'airport' : 'water']}</span>`;
    const rows = list.map(i => {
      const t = G.tiles[i], def = BOARD[i];
      const meta = t.mortgaged ? 'mortgaged'
        : def.type === 'city' ? (t.houses === 5
            ? `<span class="icon i-hotel">${ICON_SVG.hotel}</span>`
            : t.houses ? `<span class="icon i-house">${ICON_SVG.house}</span>${t.houses > 1 ? '&times;' + t.houses : ''}`
            : money(G.rentOf(i)))
        : def.type === 'airport' ? money(G.rentOf(i)) + ' rent'
        : countOwned(t.owner, 'utility') === 2 ? '10x roll' : '4x roll';
      return `<button class="hold ${t.mortgaged ? 'mortgaged' : ''}" onclick="openDeed(${i})">
                <span class="nm">${def.name}</span><span class="meta">${meta}</span>
              </button>`;
    }).join('');
    return `<div class="hold-group"><h4>${chip}${title}</h4>${rows}</div>`;
  }).join('');
}


let lastTopEntry = 0;

function renderLog() {
  const shown = G.entries;
  const top = shown.length ? shown[0].id : 0;
  const fresh = top !== lastTopEntry;
  lastTopEntry = top;
  const log = $('#log');
  const previousHeight = log.scrollHeight;
  const previousScroll = log.scrollTop;
  log.innerHTML = shown.map((e, k) =>
    `<li class="${e.big ? 'big' : ''}${fresh && k === 0 ? ' fresh' : ''}">${e.html}</li>`).join('');
  log.scrollTop = previousScroll > 0 && fresh ? previousScroll + log.scrollHeight - previousHeight : previousScroll;
}

function render() {
  renderBoard();
  renderPlayers();
  renderTurn();
  renderHoldings();
  renderTrades();
  renderLog();
  applyLit();
  G.syncClock();
  if (G.auction) renderAuction(); else closeAuctionModal();
}

/* ====================================================================== */
/* Modals                                                                  */
/* ====================================================================== */

function openModal(html) {
  $('#modalCard').classList.remove('is-end');
  $('#modalCard').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' && !e.target.classList.contains('locked')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('locked')) closeModal();
});

function openDeed(idx) {
  const def = BOARD[idx], t = G.tiles[idx];
  if (!['city', 'airport', 'utility'].includes(def.type)) return;
  const owner = t.owner === null ? null : G.players[t.owner];
  const bandColor = def.type === 'city' ? GROUPS[def.group].color : '#5c6773';
  const bandLabel = def.type === 'city' ? GROUPS[def.group].name : KIND_LABEL[def.type];

  let rows = '';
  if (def.type === 'city') {
    const labels = ['Rent', 'One house', 'Two houses', 'Three houses', 'Four houses', 'Hotel'];
    rows = def.rents.map((r, k) => `<tr><td>${labels[k]}</td><td>${money(r)}</td></tr>`).join('');
    rows += `<tr><td>Building cost</td><td>${money(def.house)}</td></tr>`;
  } else if (def.type === 'airport') {
    rows = AIRPORT_RENT.map((r, k) => `<tr><td>${k + 1} airport${k ? 's' : ''} held</td><td>${money(r)}</td></tr>`).join('');
  } else {
    rows = `<tr><td>One utility held</td><td>4x the roll</td></tr><tr><td>Both utilities held</td><td>10x the roll</td></tr>`;
  }
  rows += `<tr><td>Mortgage value</td><td>${money(Math.floor(def.price / 2))}</td></tr>`;
  rows += `<tr><td>Held by</td><td>${owner ? owner.name : 'the bank'}</td></tr>`;

  const viewer = G.debt ? G.debt.player : G.cur();
  const mineToManage = owner && owner.id === viewer.id && isMine(viewer);
  let manage = '';
  if (mineToManage) {
    manage =
      (G.canBuild(idx) ? `<button class="btn ghost" onclick="G.build(${idx}); openDeed(${idx});">Build ${money(def.house)}</button>` : '') +
      (G.canSell(idx) ? `<button class="btn ghost" onclick="G.sellHouse(${idx}); openDeed(${idx});">Sell building</button>` : '') +
      (G.canMortgage(idx) ? `<button class="btn ghost" onclick="G.mortgage(${idx}); openDeed(${idx});">Mortgage</button>` : '') +
      (G.canRedeem(idx) ? `<button class="btn ghost" onclick="G.redeem(${idx}); openDeed(${idx});">Redeem ${money(Math.ceil(def.price * 0.55))}</button>` : '');
  }

  openModal(
    `<h3>${def.name}</h3>
     <p class="sub">${def.type === 'city' ? 'Title deed' : KIND_LABEL[def.type]} &middot; list price ${money(def.price)}</p>
     <div class="deed">
       <div class="deed-band" style="background:${bandColor}">${def.type === 'city'
         ? `<span class="flag deed-flag">${FLAG_SVG[def.group]}</span>`
         : `<span class="icon deed-icon">${ICON_SVG[def.icon]}</span>`}${bandLabel}</div>
       <table>${rows}</table>
     </div>
     <div class="modal-actions">${manage}<button class="btn ghost" onclick="closeModal()">Close</button></div>`
  );
}

function payRelease() {
  const p = G.cur();
  G.touch();
  if (G.debit(p, 50, null, true)) { p.inJail = false; p.jailTurns = 0; G.phase = 'roll'; }
  render();
}
function usePardon() {
  const p = G.cur();
  G.touch();
  p.pardons--; p.inJail = false; p.jailTurns = 0;
  G.say(`<b>${p.name}</b> used release paperwork to leave prison.`);
  G.phase = 'roll';
  render();
}


/* ---- the auction window ------------------------------------------------ */
/* Open to everyone at the table and impossible to dismiss until the deed is
   sold, because everyone needs to see what it went for. */

function auctionBadge(def) {
  return def.type === 'city'
    ? `<span class="flag auc-flag">${FLAG_SVG[def.group]}</span>`
    : `<span class="icon auc-icon i-${def.icon}">${ICON_SVG[def.icon]}</span>`;
}

function auctionDeed(def) {
  let rows;
  if (def.type === 'city') {
    const labels = ['with rent', 'with one house', 'with two houses',
                    'with three houses', 'with four houses', 'with a hotel'];
    rows = def.rents.map((r, k) => `<tr><td>${labels[k]}</td><td>${money(r)}</td></tr>`).join('');
  } else if (def.type === 'airport') {
    rows = AIRPORT_RENT.map((r, k) =>
      `<tr><td>${k + 1} airport${k ? 's' : ''} held</td><td>${money(r)}</td></tr>`).join('');
  } else {
    rows = `<tr><td>one utility held</td><td>4x the roll</td></tr>
            <tr><td>both utilities held</td><td>10x the roll</td></tr>`;
  }
  const foot = def.type === 'city'
    ? `<span><small>Price</small>${money(def.price)}</span>
       <span><small>House</small>${money(def.house)}</span>
       <span><small>Hotel</small>${money(def.house)}</span>`
    : `<span><small>Price</small>${money(def.price)}</span>
       <span><small>Mortgage</small>${money(Math.floor(def.price / 2))}</span>`;
  return `<div class="auc-deed">
            <h4>${def.name}</h4>
            <table><thead><tr><th>when</th><th>get</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="auc-figures">${foot}</div>
          </div>`;
}

/* Who this browser bids for: your seat in a room, or the seat you pick at a
   shared keyboard. */
function auctionBidder() {
  const a = G.auction;
  if (!a) return null;
  if (typeof Net !== 'undefined' && Net.online()) return G.players[Net.seat] || null;
  const humans = G.alive().filter(p => !p.bot);
  if (!humans.length) return null;
  const picked = humans.find(p => p.id === a.localBidder);
  return picked || humans.find(p => p.id === G.cur().id) || humans[0];
}

function openAuctionModal() {
  const a = G.auction;
  const def = BOARD[a.idx];
  $('#modalCard').classList.remove('is-end');
  $('#modalCard').classList.add('is-auction');
  $('#modal').classList.add('locked');
  $('#modal').hidden = false;
  $('#modalCard').innerHTML =
    `<div class="auction">
       <p class="eyebrow">Auction</p>
       <div class="auc-head">${auctionBadge(def)}<h2>${def.name}</h2></div>
       <div class="auc-grid">
         <div class="auc-side" id="aucSide"></div>
         ${auctionDeed(def)}
       </div>
     </div>`;
  renderAuction();
}

function closeAuctionModal() {
  const card = $('#modalCard');
  if (!card.classList.contains('is-auction')) return;
  card.classList.remove('is-auction');
  $('#modal').classList.remove('locked');
  closeModal();
}

function renderAuction() {
  const a = G.auction;
  if (!a) { closeAuctionModal(); return; }
  if (!$('#modalCard').classList.contains('is-auction')) { openAuctionModal(); return; }

  const side = $('#aucSide');
  if (!side) return;
  const steps = G.bidSteps(a.idx);
  const left = G.auctionLeft();
  const secs = Math.ceil(left / 1000);
  const me = auctionBidder();
  const high = a.high === null ? null : G.players[a.high];
  const humans = G.alive().filter(p => !p.bot);
  const canPick = (typeof Net === 'undefined' || !Net.online()) && humans.length > 1;

  // Preserve pressed buttons and keyboard focus across clock ticks and bids.
  if (!side.querySelector('.auc-buttons')) {
    side.innerHTML = `<p class="auc-label">Current bid</p>
      <p class="auc-amount"></p><p class="auc-who"></p>
      <p class="auc-timer"></p><span class="auc-bar"><i></i></span>
      <div class="auc-controls"><p class="auc-label auc-bid-label"></p>
        <select class="pick auc-pick" id="aucAs" aria-label="Bidding as" hidden></select>
        <div class="auc-buttons">${steps.map((_, k) =>
          `<button type="button" class="btn auc-bid" onclick="bidNow(${k})"><span></span><small></small></button>`).join('')}</div>
      </div><p class="auc-note"></p>`;
    side.querySelector('#aucAs').addEventListener('change', e => {
      if (!G.auction) return;
      G.auction.localBidder = Number(e.target.value);
      renderAuction();
    });
  }
  side.querySelector('.auc-amount').textContent = a.bid ? money(a.bid) : 'no bids yet';
  const leader = high ? high.id + ':' + high.name + ':' + high.color : 'none';
  const who = side.querySelector('.auc-who');
  if (who.dataset.leader !== leader) {
    who.innerHTML = high
      ? `<span class="mini">${avatarSVG(high.color, high.id, 24)}</span> ${high.name} leads`
      : 'The floor is open.';
    who.dataset.leader = leader;
  }
  side.querySelector('.auc-timer').textContent = `Sold in ${secs}s`;
  const bar = side.querySelector('.auc-bar i');
  const percent = Math.min(100, Math.max(0, left / G.AUCTION_MS * 100));
  // Let the browser interpolate every frame instead of stepping at each
  // 120ms text-clock update. A new deadline restarts the bar immediately.
  if (bar.animate) {
    if (bar._auctionDeadline !== a.endsAt) {
      if (bar._countdownAnimation) bar._countdownAnimation.cancel();
      bar._auctionDeadline = a.endsAt;
      bar.style.width = '0%';
      bar._countdownAnimation = bar.animate(
        [{ width: percent + '%' }, { width: '0%' }],
        { duration: left, easing: 'linear', fill: 'forwards' }
      );
    }
  } else {
    bar.style.width = percent + '%';
  }
  side.querySelector('.auc-controls').hidden = !me;
  side.querySelector('.auc-bid-label').textContent = canPick ? 'Bidding as' : 'Your bid';
  const pick = side.querySelector('#aucAs');
  pick.hidden = !canPick;
  const options = JSON.stringify(humans.map(p => [p.id, p.name]));
  if (canPick && pick.dataset.options !== options) {
    pick.replaceChildren(...humans.map(p => new Option(p.name, String(p.id))));
    pick.dataset.options = options;
  }
  if (me && pick.value !== String(me.id)) pick.value = String(me.id);
  side.querySelectorAll('.auc-bid').forEach((button, k) => {
    const next = a.bid + steps[k];
    button.disabled = !me || me.cash < next;
    button.querySelector('span').textContent = money(next);
    button.querySelector('small').textContent = '+' + money(steps[k]);
  });
  side.querySelector('.auc-note').textContent = me
    ? `${me.name} holds ${money(me.cash)}.`
    : 'The house players are bidding.';
}

function bidNow(level) {
  const me = auctionBidder();
  if (!me) return;
  if (typeof Net !== 'undefined' && Net.online() && !Net.isHost()) {
    Net.send({ type: 'intent', name: 'auctionBid', args: [level] });
    return;
  }
  G.placeBid(me.id, level);
}

/* ---- the end screen ---------------------------------------------------- */
/* Standing order: the winner, then the others in reverse order of leaving. */
function finalStanding() {
  return G.players.slice().sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    if (a.out) return (b.outOrder || 0) - (a.outOrder || 0);
    return b.cash - a.cash;
  });
}

function showEndScreen(winner) {
  const table = finalStanding();
  const longest = Math.max(...table.map(p => p.turns), 1);
  const built = G.tiles.reduce((sum, t) => sum + (t.owner === winner.id ? t.houses : 0), 0);
  const held = ownedIdx(winner.id).length;

  const rows = table.map((p, k) => {
    const width = Math.max(6, Math.round((p.turns / longest) * 100));
    const note = p.out ? `out on round ${p.outRound}` : money(p.cash);
    return `<li class="stand-row${k === 0 ? ' won' : ''}">
      <span class="rank">${k + 1}</span>
      <span class="who">${avatarSVG(p.color, p.id, 26)}<span class="nm">${p.name}</span></span>
      <span class="bar"><i style="width:${width}%;background:${p.color}"></i>
        <b>${k === 0 ? 'winner' : p.turns + ' turns'}</b></span>
      <span class="note">${note}</span>
    </li>`;
  }).join('');

  openModal(
    `<div class="end">
       <p class="eyebrow">The circuit is closed</p>
       <h2 class="end-title">Game over</h2>

       <div class="end-winner">
         <span class="end-avatar">${avatarSVG(winner.color, winner.id, 76)}</span>
         <div>
           <p class="end-label">and the table belongs to</p>
           <p class="end-name">${winner.name}</p>
           <p class="end-sub">${money(winner.cash)} in hand &middot; ${held} deed${held === 1 ? '' : 's'}
             &middot; ${built} building${built === 1 ? '' : 's'} standing</p>
         </div>
       </div>

       <h3 class="end-head">Leaderboard &middot; turns survived</h3>
       <ol class="standing">${rows}</ol>

       <p class="end-foot">${MAPS[G.rules.map].name} map &middot; ${G.round} rounds
         &middot; ${G.players.length} seats &middot; ${money(G.rules.startCash)} to start</p>

       <div class="modal-actions end-actions">
         <button class="btn ghost" onclick="G.backToLobby()">Back to the lobby</button>
         <button class="btn solid xl" onclick="G.restart()">Another game</button>
       </div>
     </div>`
  );
  $('#modalCard').classList.add('is-end');
}

/* ====================================================================== */
/* Trades: an offer stands on the board until it is answered              */
/* ====================================================================== */

const EYE = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
  <path d="M1.9 12S5.7 5.7 12 5.7 22.1 12 22.1 12 18.3 18.3 12 18.3 1.9 12 1.9 12Z"
        fill="none" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="12" cy="12" r="2.7" fill="currentColor"/></svg>`;

const SWAP = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
  <path d="M4 9h13l-3.4-3.4M20 15H7l3.4 3.4" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STATUS_LABEL = {
  open: 'Awaiting an answer', accepted: 'Agreed', declined: 'Declined',
  withdrawn: 'Withdrawn', countered: 'Countered', void: 'No longer valid'
};

/* Whoever is at the keyboard: the player who has to act right now. */
function seated() {
  if (typeof Net !== 'undefined' && Net.online()) return G.players.find(p => p.id === Net.seat && !p.out && !p.bot);
  const actor = G.actor();
  return actor && !actor.bot && !actor.out ? actor : G.players.find(p => !p.bot && !p.out);
}

/* In a room, only the seat this browser holds gets buttons. */
function isMine(p) {
  if (!p) return false;
  if (typeof Net === 'undefined' || !Net.online()) return !p.bot;
  return p.id === Net.seat && !p.bot;
}
function canAnswer(t) { return t.status === 'open' && isMine(G.players[t.to]); }
function canWithdraw(t) { return t.status === 'open' && isMine(G.players[t.from]); }

function proposeTrade(opts) {
  const from = G.players[opts.fromId], to = G.players[opts.toId];
  if (!from || !to || from.out || to.out || from.id === to.id || G.phase === 'over') return;
  const parent = opts.parent || null;
  if (parent) {
    const original = G.trades.find(t => t.id === parent);
    if (!original || original.status !== 'open' || original.to !== from.id || original.from !== to.id) return;
    original.status = 'countered';
  }
  const t = {
    id: ++G.tradeSeq, from: from.id, to: to.id,
    give: (opts.give || []).slice(), get: (opts.get || []).slice(),
    giveCash: Math.max(0, Math.min(from.cash, opts.giveCash | 0)),
    getCash: Math.max(0, Math.min(to.cash, opts.getCash | 0)),
    status: 'open', round: G.round, parent,
    depth: parent ? ((G.trades.find(x => x.id === parent) || {}).depth || 0) + 1 : 0
  };
  G.trades.unshift(t);
  const settled = G.trades.filter(x => x.status !== 'open');
  if (settled.length > 20) G.trades = G.trades.filter(x => x.status === 'open' || settled.indexOf(x) < 20);
  G.say(`<b>${from.name}</b> ${parent ? 'countered' : 'offered'} a trade to <b>${to.name}</b>.`, !parent);
  render();
  if (to.bot) {
    if (G.instant) botAnswerTrade(t.id);          // tests run without timers
    else setTimeout(() => botAnswerTrade(t.id), 900);
  }
  return t;
}

/* Both sides must still hold what they promised, unbuilt, and afford the cash. */
function tradeLegal(t) {
  const from = G.players[t.from], to = G.players[t.to];
  if (from.out || to.out) return 'A player has left the game.';
  const held = (list, owner) => list.every(i => G.tiles[i].owner === owner);
  if (!held(t.give, t.from) || !held(t.get, t.to)) return 'A deed has changed hands since';
  const built = list => list.some(i => {
    const def = BOARD[i];
    return G.tiles[i].houses || (def.type === 'city' && groupIdx(def.group).some(j => G.tiles[j].houses));
  });
  if (built(t.give) || built(t.get)) return 'Buildings must be sold first';
  if (from.cash < t.giveCash || to.cash < t.getCash) return 'The cash is no longer there';
  return null;
}

function acceptTrade(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t || t.status !== 'open') return;
  const bad = tradeLegal(t);
  if (bad) {
    t.status = 'void'; t.note = bad;
    G.say(`A trade between <b>${G.players[t.from].name}</b> and <b>${G.players[t.to].name}</b> lapsed: ${bad.toLowerCase()}.`);
    closeModal(); render();
    return;
  }
  const from = G.players[t.from], to = G.players[t.to];
  t.give.forEach(i => { G.tiles[i].owner = to.id; });
  t.get.forEach(i => { G.tiles[i].owner = from.id; });
  from.cash += t.getCash - t.giveCash;
  to.cash += t.giveCash - t.getCash;
  t.status = 'accepted';
  G.say(`<b>${to.name}</b> accepted a trade from <b>${from.name}</b>: ${tradeSummary(t)}.`, true);
  closeModal();
  render();
}

function declineTrade(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t || t.status !== 'open') return;
  t.status = 'declined';
  G.say(`<b>${G.players[t.to].name}</b> declined a trade from <b>${G.players[t.from].name}</b>.`);
  closeModal(); render();
}

function withdrawTrade(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t || t.status !== 'open') return;
  t.status = 'withdrawn';
  G.say(`<b>${G.players[t.from].name}</b> withdrew a trade.`);
  closeModal(); render();
}

/* Countering answers one offer with another, the other way round. */
function counterTrade(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t || t.status !== 'open') return;
  openTradeBuilder({
    fromId: t.to, toId: t.from,
    give: t.get, get: t.give,
    giveCash: t.getCash, getCash: t.giveCash,
    parent: t.id
  });
}

function tradeSummary(t) {
  const side = (props, cash) => {
    const bits = props.map(i => BOARD[i].name);
    if (cash) bits.push(money(cash));
    return bits.length ? bits.join(', ') : 'nothing';
  };
  return `${side(t.give, t.giveCash)} for ${side(t.get, t.getCash)}`;
}

/* ---- the house answers ------------------------------------------------ */
function tradeValue(props, cash, forId) {
  let v = props.reduce((sum, i) => sum + propValue(i), 0) + cash;
  props.forEach(i => {
    const def = BOARD[i];
    if (def.type !== 'city') return;
    const mates = groupIdx(def.group);
    if (mates.filter(j => j !== i).every(j => G.tiles[j].owner === forId)) v *= 1.6;
  });
  return v;
}

function botAnswerTrade(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t || t.status !== 'open') return;
  const bot = G.players[t.to], other = G.players[t.from];
  if (bot.out || other.out) { t.status = 'void'; render(); return; }

  const incoming = tradeValue(t.give, t.giveCash, bot.id);
  const outgoing = tradeValue(t.get, t.getCash, other.id);
  const keepsCash = bot.cash - t.getCash >= 80;

  if (keepsCash && incoming >= outgoing * 1.1) return acceptTrade(t.id);

  /* Close enough to haggle over: ask for the difference in cash. */
  const patience = other.bot ? 1 : 3;
  const gap = Math.ceil(outgoing * 1.15 - incoming);
  if (keepsCash && incoming >= outgoing * 0.7 && t.depth < patience && gap > 0 &&
      other.cash >= t.giveCash + gap + 100) {
    t.status = 'countered';
    proposeTrade({
      fromId: bot.id, toId: other.id,
      give: t.get, get: t.give,
      giveCash: t.getCash, getCash: t.giveCash + gap,
      parent: t.id
    });
    return;
  }
  declineTrade(t.id);
}

/* ---- the trades panel -------------------------------------------------- */
function renderTrades() {
  const host = $('#trades');
  if (!host) return;
  const open = G.trades.filter(t => t.status === 'open');
  if (!open.length) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = open.map(t => {
    const from = G.players[t.from], to = G.players[t.to];
    const yours = canAnswer(t);
    const mine = yours && to.id === seated()?.id;
    return `<li class="trade-item${mine ? ' awaits' : ''}">
      <span class="pair">
        <span class="mini">${avatarSVG(from.color, from.id, 22)}</span>
        <span class="swap">${SWAP}</span>
        <span class="mini">${avatarSVG(to.color, to.id, 22)}</span>
        <span class="names">${from.name} and ${to.name}</span>
      </span>
      <span class="tag">${mine ? 'Your call' : yours ? to.name + ' to answer' : t.depth ? 'Countered' : 'Pending'}</span>
      <button class="eye" title="View this trade" aria-label="View the trade between ${from.name} and ${to.name}"
              onclick="openTradeView(${t.id})">${EYE}</button>
    </li>`;
  }).join('');
}

/* ---- the viewer, open to everyone at the table ------------------------- */
function openTradeView(id) {
  const t = G.trades.find(x => x.id === id);
  if (!t) return;
  const from = G.players[t.from], to = G.players[t.to];

  const column = (player, props, cash) => `
    <div class="tside">
      <h4><span class="mini">${avatarSVG(player.color, player.id, 22)}</span>${player.name} gives</h4>
      ${cash ? `<p class="tcash">${money(cash)}</p>` : ''}
      ${props.length ? props.map(i => {
        const def = BOARD[i];
        return `<button class="tchip" onclick="openDeed(${i})">
          ${def.type === 'city' ? `<span class="flag">${FLAG_SVG[def.group]}</span>` : iconHTML(def)}
          <span class="nm">${def.name}</span><span class="meta">${money(def.price)}</span></button>`;
      }).join('') : (cash ? '' : '<p class="tnone">Nothing</p>')}
    </div>`;

  let actions = `<button class="btn ghost" onclick="closeModal()">Close</button>`;
  if (canAnswer(t)) {
    actions =
      `<button class="btn ghost" onclick="declineTrade(${t.id})">Decline</button>` +
      `<button class="btn ghost" onclick="counterTrade(${t.id})">Counter</button>` +
      `<button class="btn solid" onclick="acceptTrade(${t.id})">Accept</button>` + actions;
  } else if (canWithdraw(t)) {
    actions = `<button class="btn danger" onclick="withdrawTrade(${t.id})">Withdraw</button>` + actions;
  }

  openModal(
    `<h3>${from.name} offers ${to.name}</h3>
     <p class="sub">${STATUS_LABEL[t.status]}${t.note ? ' &middot; ' + t.note : ''}.
       ${t.parent ? 'This answers an earlier offer. ' : ''}Anyone at the table can read the terms; only ${to.name} can answer.</p>
     <div class="tview">
       ${column(from, t.give, t.giveCash)}
       <span class="tview-arrow">${SWAP}</span>
       ${column(to, t.get, t.getCash)}
     </div>
     <div class="modal-actions">${actions}</div>`
  );
}

/* ---- the builder ------------------------------------------------------- */
$('#openTrade').addEventListener('click', () => openTradeBuilder({ fromId: seated().id }));

function openTradeBuilder(opts) {
  const me = G.players[opts.fromId];
  if (!me || !isMine(me) || me.out) return;
  const others = G.alive().filter(p => p.id !== me.id);
  if (!others.length) return;
  const toId = others.some(o => o.id === opts.toId) ? opts.toId : others[0].id;
  const partner = G.players[toId];
  const give = opts.give || [], get = opts.get || [];

  const list = (player, side, picked) => {
    const items = ownedIdx(player.id);
    if (!items.length) return `<div class="tlist"><label class="tnone">Nothing to offer</label></div>`;
    return `<div class="tlist">${items.map(i => {
      const tile = G.tiles[i], def = BOARD[i];
      const blocked = tile.houses || (def.type === 'city' && groupIdx(def.group).some(j => G.tiles[j].houses));
      const note = blocked ? ' (built up)' : tile.mortgaged ? ' (mortgaged)' : '';
      return `<label><input type="checkbox" data-side="${side}" value="${i}"
                ${blocked ? 'disabled' : ''} ${picked.includes(i) ? 'checked' : ''}>
                <span>${def.name}${note}</span><span class="meta">${money(def.price)}</span></label>`;
    }).join('')}</div>`;
  };

  openModal(
    `<h3>${opts.parent ? 'Counter the offer' : 'Create a trade'}</h3>
     <p class="sub">The offer stays on the table until it is accepted, declined or countered.
       Buildings must be sold before a deed can move.</p>
     ${!opts.parent && (typeof Net === 'undefined' || !Net.online()) ? '<div class="cashrow"><label for="tradeFrom">Trading as</label><select class="pick" id="tradeFrom">' + G.alive().filter(p => !p.bot).map(p => '<option value="' + p.id + '" ' + (p.id === me.id ? 'selected' : '') + '>' + p.name + '</option>').join('') + '</select></div>' : ''}
     <div class="cashrow" style="margin-bottom:16px">
       <label for="partnerSel">Trading with</label>
       <select class="pick" id="partnerSel" ${opts.parent ? 'disabled' : ''}>
         ${others.map(o => `<option value="${o.id}" ${o.id === toId ? 'selected' : ''}>${o.name}</option>`).join('')}
       </select>
     </div>
     <div class="trade">
       <div>
         <h4>${me.name} gives</h4>
         ${list(me, 'give', give)}
         <div class="cashrow"><label for="giveCash">Cash</label>
           <input id="giveCash" type="number" min="0" max="${me.cash}" value="${opts.giveCash || 0}"></div>
       </div>
       <div>
         <h4>${partner.name} gives</h4>
         ${list(partner, 'get', get)}
         <div class="cashrow"><label for="getCash">Cash</label>
           <input id="getCash" type="number" min="0" max="${partner.cash}" value="${opts.getCash || 0}"></div>
       </div>
     </div>
     <div class="modal-actions">
       <button class="btn ghost" onclick="closeModal()">Cancel</button>
       <button class="btn solid" onclick="submitTrade(${me.id}, ${opts.parent || 'null'})">Send offer</button>
     </div>`
  );

  const sel = $('#partnerSel');
  const fromSelect = $('#tradeFrom');
  if (fromSelect) fromSelect.addEventListener('change', e => openTradeBuilder({ fromId: Number(e.target.value) }));
  if (sel && !opts.parent) {
    sel.addEventListener('change', e => openTradeBuilder({ fromId: me.id, toId: Number(e.target.value) }));
  }
}

function submitTrade(fromId, parent) {
  const toId = Number($('#partnerSel').value);
  const give = [...document.querySelectorAll('[data-side="give"]:checked')].map(c => Number(c.value));
  const get = [...document.querySelectorAll('[data-side="get"]:checked')].map(c => Number(c.value));
  const giveCash = Number($('#giveCash').value) || 0;
  const getCash = Number($('#getCash').value) || 0;
  if (!give.length && !get.length && !giveCash && !getCash) return closeModal();
  proposeTrade({ fromId, toId, give, get, giveCash, getCash, parent });
  closeModal();
}

window.renderPawns = renderPawns;
window.render = render;
window.G = G;
window.openDeed = openDeed;
window.closeModal = closeModal;
window.submitTrade = submitTrade;
window.openTradeView = openTradeView;
window.showEndScreen = showEndScreen;
window.bidNow = bidNow;
window.renderAuction = renderAuction;
window.openTradeBuilder = openTradeBuilder;
window.acceptTrade = acceptTrade;
window.declineTrade = declineTrade;
window.counterTrade = counterTrade;
window.withdrawTrade = withdrawTrade;
window.payRelease = payRelease;
window.usePardon = usePardon;

function surrenderPlayer(id) {
  const player = G.players[id];
  if (!player || player.out || !isMine(player) || G.phase === 'over') return;
  if (typeof Net !== 'undefined' && Net.online() && !Net.isHost()) {
    Net.send({ type: 'intent', name: 'surrender', args: [] });
  } else G.surrender(id);
}
window.surrenderPlayer = surrenderPlayer;
