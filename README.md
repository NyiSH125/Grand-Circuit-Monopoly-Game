# Grand Circuit

A browser property-trading game for two to six players around one table, with
optional house (computer) players. No build step, no dependencies: three files
and an `index.html`.

## Running it

```bash
node server.js
```

Then visit `http://localhost:8123`. The console also prints the addresses your
machine can be reached on, which is what other players need.

Opening `index.html` on its own still works for a game at one keyboard; the
server is what lets other people join.

## Playing with other people

The first screen offers two doors.

**Create a game** opens the settings: seats, board map, gameplay rules and
starting cash. Press **Open a room** and you get a five-letter key and an invite
link, plus a **Public table** switch:

- *Public* lists the table in the lobby for anyone looking for a game.
- *Private* keeps it to whoever has the key or the link.

Send the link (it carries the key as `?room=KEY`) or read the key out. Joiners
appear in your seat list as *Joined*; any seat nobody claims stays a house
player. Start when everyone is in. The key and invite stay in the left column
while you play, and the table drops off the public list once the game begins.

**Join a game** takes a key or finds you a table:

- Type the five-letter key a friend sent you, or
- Pick a public table from the list, which shows the host, the map and how many
  are seated, or
- **Join a random table** and let it choose for you.

Either way you land on the join card: type a name, take a seat, and wait for the
host to start. An invite link skips the doors and goes straight there.

One browser hosts. It runs the game and publishes the state after every change;
everyone else draws that state and sends back what they want to do. The host
checks each move belongs to the seat that sent it before playing it.

Where the link reaches:

- **Same machine** works with no server at all: extra tabs join over a
  BroadcastChannel.
- **Same network** works as soon as `node server.js` is running. The invite link
  is rewritten to your network address automatically.
- **Over the internet** needs that address to be reachable from outside, so
  you would put a tunnel or a port forward in front of it. Nothing in the game
  depends on the tunnel; it only needs the port.

Details worth knowing:

- The host's browser is the game. If it closes, the room ends.
- A guest who reloads keeps their seat: the browser remembers who it was.
- The three-minute clock still applies, so a player who wanders off forfeits
  rather than stalling the table.
- Seats are claimed in order, filling house players first, up to six.

## Maps

A map is eight country sets, four airports and two companies poured into the
same forty-stop frame. The price ladder, rent tables and card decks are shared,
so both maps play identically and only the geography changes. Cards name
whichever stop sits on the square, so they follow the map in play.

| Map | Shape | Countries |
| --- | --- | --- |
| **Classic** | 22 cities, 8 countries | Brazil, Israel, Italy, Germany, China, France, the UK, the USA |
| **Meridian** | 22 cities, 8 countries | Mexico, Turkey, Korea, Japan, China, Myanmar, Spain, the USA |
| **Fortune** | 16 cities in pairs, cards everywhere | Mexico, Turkey, Italy, Japan, Brazil, Korea, the UK, the USA |

### Fortune

The luck map. Half the deeds and twice the cards: sixteen cities in eight pairs,
so countries complete quickly and the building war starts early, and fifteen
card stops instead of six.

- **Six Surprise and five Treasure** stops, the usual decks.
- **Three Fortune stops** draw from a deck of their own, with far bigger swings
  than the ordinary cards: a $300 windfall, a $150 collapse, everyone pays you
  $75, you buy a round for the table, the bank hands you its cheapest unclaimed
  deed or takes one of yours back, a charter to a random stop, changing places
  with whoever holds the most cash, straight to prison, or the whole vacation
  pot.
- **A tax refund stop** that pays $50 instead of charging you.
- No companies: on this map every non-city stop is either an airport or a card.

Building costs follow the position on the loop rather than the country, so the
same city set is priced correctly wherever it appears.

Meridian runs Guadalajara and Mexico City, then Izmir, Ankara and Istanbul,
Busan, Incheon and Seoul, Osaka, Kyoto and Tokyo, the Chinese set, Nay Pyi Taw,
Mandalay and Yangon, Valencia, Barcelona and Madrid, and finally San Francisco
and New York. Its airports are IST, HND, RGN and JFK.

To add a map, append a spec to `MAPS` in `data.js`. Two shapes are supported:

- **Standard frame** a name, a blurb, four airport names and eight sets listed
  cheapest first. The forty stops are laid out for you.
- **Own layout** a `layout` of forty short rows (`['city', 'Rome', 'italy']`,
  `['fortune', 'Fortune']`, `['refund', 'Tax Refund', 50]`, and so on) plus the
  `prices` for its cities in order. Rents and building costs are derived from
  the price. Mark it `luck: true` to badge it in the picker.

## The board

Forty stops: twenty-two cities in eight countries, four airports, two companies,
two taxes, Surprise and Treasure decks, a prison, and a Vacation stop.

## Table settings

Set before the game starts, next to the seats:

- **Board map** Classic or Meridian.
- **Starting cash** $1,000 to $3,000.
- **Double rent on a full country** off makes a complete set worth no more per
  landing until it is built on.
- **Vacation cash** off sends taxes and fines to the bank, and Vacation becomes
  an ordinary rest stop.
- **Auction** on turns every unclaimed stop into a choice: **Buy** it at the
  asking price, or send it to **Auction**. Short of the price, auction is the
  only door.
- **No rent while in prison** on means an owner sitting in prison collects
  nothing.
- **Mortgage** off removes mortgaging entirely, so buildings are the only way to
  raise cash in a hurry.
- **Even build** off lets houses go up on one stop of a country without
  spreading them across the rest.

## Rules in force

- Everyone starts on $1,500. Passing Start pays $200; landing on it pays $100.
- Rent doubles on an undeveloped country once one player holds all of it.
- Airports pay $25 / $50 / $100 / $200 by how many the owner holds. Utilities
  pay four times the roll, or ten times if the owner holds both.
- Building is even across a country and needs the full set unmortgaged.
  A built stop carries a house mark with its count beside it, and the fifth
  house replaces the row with a single hotel mark. Selling returns half the
  building cost.
- Mortgaging pays half the list price; redeeming costs 55%.
- Taxes and fines fall into the Vacation pot. Whoever lands on Vacation takes it.
- Three doubles in a row sends you to prison. Leaving costs $50, a release card,
  or doubles within three turns.
- A player who cannot cover a debt sells buildings and mortgages deeds, or goes
  bankrupt. Their holdings pass to the creditor, or back to the bank.
- **Three minutes per decision.** The clock above the dice starts whenever a
  human has to act (roll, buy, settle a debt, answer an offer, end a turn) and
  stops the moment they act. Run it to zero and you get a final fifteen seconds
  under a red banner reading *If you do not act, you lose the game*. Act inside
  that window and nothing happens; sit through it and the seat is lost there and
  then, its holdings back to the bank. House players are never on the clock, and
  nobody can be timed out while their dice or token are still moving.
- Last player solvent wins.

## Auctions

With the rule on, a stop nobody buys goes under the hammer in front of the whole
table.

- A window opens for **every player** and cannot be dismissed until the deed is
  sold. It carries the country's flag, the stop's name, the full rent ladder from
  bare ground to hotel, and the price of the deed and its buildings.
- **Anyone may bid at any moment.** There are no turns.
- Each bid **resets a five second clock**. Outbid the leader inside it or the
  deed is theirs when it runs out. If nobody bids at all, the bank keeps it.
- Three bid sizes, scaled to the asking price: a little more, rather more, or a
  lot more. Anything beyond your cash is greyed out.
- House players set a ceiling from how badly they want the country, then answer
  bids at human speed inside the window rather than instantly.
- At one keyboard, a picker says which seat is bidding; in a room you bid as
  your own seat.

## Trading

Offers live in the **Trades** panel and stay there until they are answered, so
play carries on around them.

- **Create** opens the builder: pick deeds from either side, add cash to either
  side, send it. Buildings must be sold before a deed can move.
- An offer sits on the board as an open row until the recipient accepts,
  declines or counters it. Nothing expires on its own and no turn is blocked
  waiting for one.
- **Countering** answers an offer with the sides reversed and prefilled, so a
  negotiation can go back and forth. The original is marked as countered and the
  reply takes its place.
- The **eye** on any row opens the trade for reading: both sides, the cash, the
  status, and every deed clickable through to its title deed. Anyone at the
  table can read any offer; only the recipient sees Accept, Counter and Decline,
  and only the proposer sees Withdraw.
- House players answer within a second or so. They accept when the incoming
  value clearly beats what they part with, haggle once with another house and up
  to three times with a person by asking for the difference in cash, and decline
  outright when the gap is too wide. They open their own offers the same way when
  they want a deed you hold.
- An offer that has been overtaken by events, a deed sold, a house built, the
  cash spent, lapses when someone tries to accept it and says why.

## Reading the table

- Every seat gets its own character token. It sits in the player list and walks
  the board one square at a time, so you can follow the route it takes and see
  it cross Start rather than appearing at the destination. Card moves walk too,
  backwards when the card sends you back. Prison is the one instant trip.
- The dice use rounded 3D geometry, drawn on canvas with soft directional lighting.
  Their top faces appear broad, with narrower shaded sides. Rolling throws them
  straight into the air, tumbles them at a steady speed until impact, and drops
  them under gravity with two smaller bounces before they settle square on
  the rolled face. The result is decided first and the throw lands on it.
- A moving token lifts onto its own layer above the board and glides square to
  square with a small arc, easing in and out of each one. Movement is paced by
  the clock rather than by frame count, so a slow or backgrounded tab catches up
  instead of dragging a roll out.
- Turns are taken in the middle of the board: the clock sits above the dice and
  the action you owe sits right under them as one large button, with the lesser
  choices beside it. The right-hand column is left to players, trades and
  holdings.
- When the last rival goes bankrupt the board hands over to an end screen: the
  winner with their character, cash, deeds and buildings, then a leaderboard of
  turns survived drawn as bars in each player's own colour, and a line naming the
  map, the round count, the seats and the starting cash. From there, **Another
  game** deals the same table again and **Back to the lobby** returns to the
  settings with your seats and rules intact.
- The game log keeps the last seven moves. The newest slides in at full strength
  and each older line sits fainter than the one above it, so the trail falls away
  rather than piling up.
- Countries carry their real flag, drawn as inline SVG in a round badge on the
  tile, in the holdings list and across the top of each title deed. Badges stay
  upright on every edge of the board rather than turning with the tile, so they
  always face the player.
- Every stop without a flag wears a drawn mark instead: a plane for the airports,
  a filament lamp and a droplet for the two companies, a banded chest for
  Treasure, a question mark for Surprise, a filed return for the taxes, and for
  the corners a pair of chevrons, barred windows, a padlock and a parasol. All
  are inline SVG line work tinted by the tile, and they carry through to the
  deeds, the holdings list and the trade viewer. On the two side columns the
  icons lie down with the name they sit beside, while the flag badges stay
  upright.
- Hover a player in the list to light up every stop they hold and dim the rest.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell: setup screen, three-column game layout, modal |
| `styles.css` | Full visual system, board grid, responsive rules |
| `data.js` | Board definition, rent tables, card decks, palette |
| `game.js` | Game state, rules, rendering, house-player logic |
