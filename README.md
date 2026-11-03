# Hearth · Scrabble Night

A personal, browser-hosted Scrabble game with a shared table display and private phone racks.

**Play:** https://mcnoren.github.io/hearth-scrabble/

## Game night

1. Open the app on the shared computer and create a table.
2. Choose **Invite friends** to display the QR code and six-character table code.
3. Each player opens the link on their phone and takes a seat. The shared computer can join as a player too, or stay in Table view.
4. Start with 2–4 players. Tap or drag tiles onto the board and choose **Play word**.
5. Reopen a saved table to resume. Your phone remembers your seat. **Keep my seat** gives you a private recovery key for another device.

## No hosting subscription

GitHub Pages serves the static application. PeerJS's public PeerServer is used for signaling; the game state is not stored there. There is no application server, cloud database, paid account, API key, or billing configuration. Fonts are loaded from Google Fonts with local fallbacks.

This uses the public PeerJS service on a best-effort basis. No free third-party service can be guaranteed to remain available forever. Direct WebRTC connections may be blocked by some corporate networks, VPNs, carrier NATs, or firewalls. Try the same Wi-Fi or a different network. PeerJS discontinued its bundled TURN relay service in 2023. The app uses live STUN services for direct connections; it does not claim the retired TURN endpoints are working relays. Networks that block direct WebRTC need a separately configured TURN relay, which can be a free account-based service. No paid plan or billing has been enabled. You can configure your own PeerServer or ICE servers in `src/network.ts` if needed.

## How saving and host takeover work

- A browser hosts the room and validates commands. It saves the complete game synchronously to `localStorage` after each accepted change.
- The host replicates a snapshot, including unfinished tile placements, to connected devices. Each device saves a recovery copy locally. When other peers are connected, actions made directly on the host wait for a saved-copy acknowledgment; if none arrives, the app warns you to keep the host open.
- If the host exits, peers compete for the same room ID on PeerServer. That registration acts as an election lock. One becomes the next host; the others reconnect to the same table code.
- A short recovery window lets reconnecting peers provide a newer snapshot before the new host starts accepting actions. Older saved copies cannot overwrite a higher accepted version of the same game.
- If every browser is closed, play pauses. Opening a saved table on any device with a copy resumes hosting. Nobody needs to keep the original computer open.
- Reloading the original host rejoins the current host, preserving seats, racks, board, history, and turn order.
- A disconnected player's seat remains reserved. A connected player or table host can skip their turn after one minute if they are still disconnected.
- Export/import JSON backups are available. Backups contain the full game, including all racks and seat recovery keys. Keep them private.
- Browser data is scoped to the site's origin. Clearing it removes local saves; private browsing may discard saves when its session closes. Keep an exported backup if you want an independent copy.
- If a host dies before a change reaches another device, its latest unreplicated local change can only be recovered by reopening that device. The UI reports when an action was not confirmed. There is no cloud copy or offline background server.
- Room codes are connection addresses, not security boundaries. This is a friendly personal game: racks are private in the UI, but complete snapshots are replicated to other browsers to support takeover. It is not an anti-cheat system.

## Rules

15×15 board with the classic English 100-tile distribution and premium layout. Implements first-word center coverage, straight contiguous placements, connectivity, all crosswords, one-use premiums, blanks worth zero, seven-tile 50-point bonus, pass, exchanges when at least seven tiles remain in the bag, six consecutive scoreless turns, empty-bag go-out scoring, rack deductions, resignation, history, and rematches. Turn order is randomized at the start.

Standard games validate words against **ENABLE**, a public-domain word list. It is not a licensed current NASPA or Collins tournament lexicon. Friendly tables can disable word validation before creation. With automatic validation, there is no challenge phase or tournament clock.

Keyboard: click an empty square and type letters, arrows move the cursor, the direction control switches across/down, Backspace recalls a tile at the cursor, Enter submits, Escape clears rack selection. Phones support tapping a tile then a square. The board measures its available viewport and stays fully visible without page scrolling. The classic English board uses the familiar cream squares, red/pink/blue premiums, center star, printed distribution chart, and the classic SCRABBLE wordmark. Focus on board hides the surrounding controls to maximize the display. Move history and final scores are available in dialogs.

## Development

Requires Node.js 22.18+ (Node 24 recommended).

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run build` typechecks and generates `docs/`. GitHub Pages serves `main` → `/docs`. Commit rebuilt `docs/` when changing source. All asset paths are relative so the project works under a GitHub Pages repository path.

`tests/engine.test.ts` covers scoring, legality, tile distribution/conservation, blanks, crosswords, exchanges, endgame, and turns.

Open `http://127.0.0.1:5173/tests/network.html` while the dev server is running for live PeerJS integration checks: joining independent seats, snapshot replication, preserving a draft and racks during host loss, continuing play, recovery keys, stale-host rejoin, and reopening after every peer closes. These checks use the actual public signaling service and direct local WebRTC data channels. They are not included in the production app.

## Assets and acknowledgments

Board, tiles, and layout are drawn in CSS/SVG for this project. The classic SCRABBLE wordmark is the Hasbro public-domain text logo sourced from Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Scrabble_American_logo.svg); trademark ownership remains with its owner. Icons: Lucide (ISC). PeerJS (MIT), QRCode (MIT), React (MIT). ENABLE dictionary: https://github.com/dolph/dictionary/blob/master/enable1.txt (public-domain source; see `THIRD_PARTY_NOTICES.md`). Typography: DM Sans and Libre Caslon Display via Google Fonts, with system fallbacks.

Unofficial personal project. SCRABBLE is a trademark of its respective owners. This project is not affiliated with or endorsed by Hasbro, Mattel, NASPA, or Collins.
