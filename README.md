# Zaman Football Quiz ⚽

A team football quiz game for **Zaman Smartphone Repair Academy, Valanchery**, fully in Malayalam and made for phones.
It's free to host and run: GitHub Pages for the site, and the free Firebase Spark plan (Realtime Database, the same project as Zaman Cricket Quiz) for rooms and chat.

**Live:** https://zamanenterprises555-sketch.github.io/zaman-football-quiz/

## Game rules
- **Room:** create a room and share the 6-character code or a WhatsApp link.
  - There are two teams, A and B, with **at most 11 players each**. Everyone else is a spectator.
  - Each team has a captain ⭐ who can rename the team.
  - The app rejoins automatically when you reopen it, and each player also gets a personal rejoin link.
- **Toss:** the host tosses once in the lobby, and the toss winner kicks off first.
- **Match:** 30 questions (4-option "OPTIONAL QUESTIONS" sets).
  - Questions are asked automatically, in a random order picked from the chosen set. Option order is shuffled too.
  - **No question repeats** within a match.
  - Half time comes after 15 questions, and the teams swap sides on the field picture.
- **Each question:**
  - First comes a calm 3-second reading time.
  - Then the ball holder has **10 seconds** to do one of these:
    - **Correct answer:** a goal for their team.
    - **Pass** to a teammate of their choice. You can't pass to anyone who has already had this question.
    - **Wrong answer:** the ball goes automatically to the next teammate who hasn't tried yet, and the player who was wrong can't answer again.
  - **Holding the ball past 10 s without answering or passing is a SELF GOAL** (a goal for the other team).
  - If nobody in the team can answer, the ball goes to the other team, who play the same way. The last player of a team can also tap «അറിയില്ല».
  - If both teams fail, there's no goal.
  - After every question, the correct answer is shown to everyone.
- **Kick-offs:** kick-off alternates between the teams for every question, and inside a team the starter rotates.
- **Draw after 30 questions:** a **penalty shootout**.
  - Each team gets 5 kicks, alternating. A kick is one player and one question in 10 s, with no pass.
  - A wrong answer or a time-out is a miss.
  - The shootout stops early once one team can't catch up. If it's still level, it goes to sudden death.
- **Offline players:** a captain or the host can replace an offline player with a spectator, or remove them from the team. Offline players are skipped automatically when the ball moves on.
- **Solo vs computer:** 1 to 5 per side, made up of you, computer teammates and a computer team. It has all the same rules.
- **After the match:** the result shows the scorers, a review of your wrong answers with the correct answers, a list of all questions and answers, and a small academy ad.
- **Malayalam voice** reads the question (🔊/📢 toggles) when the phone has a Malayalam voice.
- **Chat:** free text chat. It is **locked while a question is on screen**, both in the app and in the Firebase rules.
- **Calm screen:** a still field picture, a scoreboard, and a ball spot that only changes on a pass or a goal. There's no animation while a question is shown.
- **Sounds:** whistle and goal sounds are made in code with Web Audio, so there are no sound files.
- **Pictures:** there are no pictures of people or animals, only the ball, goal, field, trophy and coin.

## Files
| File | What |
|---|---|
| `questions.js` | Exactly the same file as Zaman Cricket Quiz (not edited) |
| `engine.js` | Pure match rules (turns, pass, self goal, half time, penalties), used by both Solo and multiplayer |
| `app.js` | UI, rooms, chat, voice, sounds, solo computer players |
| `database.rules.json` | Merged Firebase rules: cricket `rooms`/`chat` and rally `rallyRooms`/`rallyChat` are unchanged, plus `footballRooms`/`footballChat` |
| `sw.js`, `manifest.json` | PWA (installable, works offline after the first visit) |
| `tests/` | `engine.test.js` (node), plus `multi.e2e.js` (2 v 2 + spectator, Firebase emulator) and `solo.e2e.js` (Playwright, 390×844) |

## Firebase
Data lives under `footballRooms/{CODE}` and `footballChat/{CODE}`. The rules work like this:
- Nobody can list rooms; you can only read one room by its code.
- A team can have at most 11 players.
- Chat is locked during a question.
- A room can be deleted only after 24 h. The app removes rooms older than 24 h automatically.

**Multiplayer needs these rules published:** Firebase console → project zaman-6587f → Realtime Database → Rules → paste `database.rules.json` → Publish. Solo works without them.

## How the match stays fair if a phone drops
Every move (answer, pass, give up, self goal, next question) is a Firebase **transaction** that runs the same `engine.js` rules, so only one phone can move the match on at a time.

Deadlines use Firebase server time, and any phone in the room can resolve a missed deadline: the host first, then the others a little later. So the match never gets stuck when the host or the ball holder goes offline.

## Testing
`?test=1&q=6&pen=2` makes a short match (6 questions, 2 penalties) for testing only.
