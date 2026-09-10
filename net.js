/* Rooms: one player hosts, the rest join by link or code.

   The host's browser runs the game and publishes the whole state after every
   change. Guests draw that state and send back what they want to do; the host
   checks it belongs to them, plays it, and publishes again.

   Two ways to carry the messages:
     relay   the room server (server.js), so other machines can join
     local   BroadcastChannel, so extra tabs on this machine can join with no
             server at all
*/

const Net = {
  code: null,
  id: (() => {
    let id = null;
    try { id = sessionStorage.getItem('gc-peer'); } catch (e) {}
    if (!id) {
      id = 'p' + Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem('gc-peer', id); } catch (e) {}
    }
    return id;
  })(),
  role: 'solo',           // solo | host | guest
  seat: null,             // which seat this browser plays
  transport: null,        // 'relay' | 'local'
  peers: [],              // host's view of who has joined
  connected: false,
  lastSnapshot: null,
  onchange: () => {},

  online() { return this.role !== 'solo'; },
  isHost() { return this.role === 'host'; },

  /* A short code that is easy to read out. No vowels, no look-alikes. */
  makeCode() {
    const alphabet = 'BCDFGHJKLMNPQRSTVWXZ23456789';
    let out = '';
    for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  },

  link() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', this.code);
    return url.toString();
  },

  /* ---- transports ----------------------------------------------------- */
  async open(code, role) {
    this.code = code;
    this.role = role;
    const relay = await this.relayAvailable();
    this.transport = relay ? 'relay' : 'local';
    if (relay) this.openRelay(); else this.openLocal();
  },

  async relayAvailable() {
    try {
      const res = await fetch('/room/exists?code=' + encodeURIComponent(this.code), { cache: 'no-store' });
      return res.ok;
    } catch (e) { return false; }
  },

  openRelay() {
    const src = new EventSource(`/room/events?code=${encodeURIComponent(this.code)}&id=${this.id}`);
    this.source = src;
    src.onmessage = e => {
      let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      this.receive(msg);
    };
    src.onopen = () => { this.connected = true; this.onchange(); };
    src.onerror = () => { this.connected = false; this.onchange(); };
  },

  openLocal() {
    const ch = new BroadcastChannel('grand-circuit-' + this.code);
    this.channel = ch;
    ch.onmessage = e => this.receive(e.data);
    this.connected = true;
    setTimeout(() => this.onchange(), 0);
  },

  send(payload) {
    payload.from = this.id;
    if (this.transport === 'relay') {
      fetch('/room/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: this.code, from: this.id, payload })
      }).catch(() => {});
    } else if (this.channel) {
      this.channel.postMessage(payload);
    }
  },

  /* ---- messages ------------------------------------------------------- */
  receive(msg) {
    if (!msg || msg.from === this.id) return;

    switch (msg.type) {
      case 'hello':
        this.connected = true;
        this.onchange();
        break;

      case 'peer-joined':
        /* A new listener: the host re-announces so late arrivals catch up. */
        if (this.isHost()) this.announceRoom();
        break;

      case 'peer-left':
        break;

      case 'join-request':
        if (!this.isHost()) return;
        Rooms.acceptJoin(msg.name, msg.from);
        break;

      case 'seat':
        /* The host telling one guest which seat is theirs. */
        if (msg.to !== this.id) return;
        this.seat = msg.seat;
        Rooms.onSeated(msg);
        break;

      case 'room':
        if (this.isHost()) return;
        Rooms.onRoomState(msg);
        break;

      case 'state':
        if (this.isHost()) return;
        this.lastSnapshot = msg.state;
        Rooms.applyState(msg.state);
        break;

      case 'intent':
        if (!this.isHost()) return;
        Rooms.runIntent(msg);
        break;

      case 'chat':
        Rooms.onChat(msg);
        break;
    }
  },

  announceRoom() {
    if (!this.isHost()) return;
    this.send({ type: 'room', seats: Rooms.seatList(), rules: setupRules, started: Rooms.started });
  },

  publish() {
    if (!this.isHost()) return;
    this.send({ type: 'state', state: Rooms.snapshot() });
  }
};
