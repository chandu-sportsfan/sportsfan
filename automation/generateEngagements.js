const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ─── Load Environment Variables ────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    }
  });
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true,
  databaseId: "(default)",
});

// ─── Content Banks ────────────────────────────────────────────────────────────

// 1. Trivia and Poll Bank
const POLL_TEMPLATES = [
  {
    title: "Who is currently the most complete all-rounder in modern cricket?",
    type: "poll",
    options: [
      { label: "Ravindra Jadeja", isCorrect: false },
      { label: "Ben Stokes", isCorrect: false },
      { label: "Hardik Pandya", isCorrect: false },
      { label: "Shakib Al Hasan", isCorrect: false },
    ],
  },
  {
    title: "Which team will dominate the IPL powerplay overs this season?",
    type: "poll",
    options: [
      { label: "Mumbai Indians", isCorrect: false },
      { label: "Chennai Super Kings", isCorrect: false },
      { label: "Royal Challengers Bengaluru", isCorrect: false },
      { label: "Kolkata Knight Riders", isCorrect: false },
    ],
  },
  {
    title: "Who is your pick for the best finisher in limited-overs cricket right now?",
    type: "poll",
    options: [
      { label: "Heinrich Klaasen", isCorrect: false },
      { label: "Rinku Singh", isCorrect: false },
      { label: "Liam Livingstone", isCorrect: false },
      { label: "Tim David", isCorrect: false },
    ],
  },
  {
    title: "Which team is the strongest contender for the UEFA Champions League title?",
    type: "poll",
    options: [
      { label: "Real Madrid", isCorrect: false },
      { label: "Manchester City", isCorrect: false },
      { label: "Bayern Munich", isCorrect: false },
      { label: "Arsenal", isCorrect: false },
    ],
  },
  {
    title: "Who holds the record for the fastest century in ODI cricket history?",
    type: "quiz",
    options: [
      { label: "AB de Villiers (31 balls)", isCorrect: true },
      { label: "Corey Anderson (36 balls)", isCorrect: false },
      { label: "Shahid Afridi (37 balls)", isCorrect: false },
      { label: "Brian Lara (45 balls)", isCorrect: false },
    ],
  },
  {
    title: "Which country has won the most FIFA World Cup titles?",
    type: "quiz",
    options: [
      { label: "Brazil (5 titles)", isCorrect: true },
      { label: "Germany (4 titles)", isCorrect: false },
      { label: "Italy (4 titles)", isCorrect: false },
      { label: "Argentina (3 titles)", isCorrect: false },
    ],
  },
  {
    title: "In which year did India win its first ever Cricket World Cup?",
    type: "quiz",
    options: [
      { label: "1975", isCorrect: false },
      { label: "1979", isCorrect: false },
      { label: "1983", isCorrect: true },
      { label: "1987", isCorrect: false },
    ],
  },
];

// 2. Fan Battle Quiz Bank
const QUIZ_BANK = {
  Cricket: {
    easy: [
      { question: "How many players are there on a cricket field from one team?", options: ["9", "10", "11", "12"], correctAnswer: "11", points: 10 },
      { question: "What is the length of a standard cricket pitch in yards?", options: ["20 yards", "22 yards", "24 yards", "26 yards"], correctAnswer: "22 yards", points: 10 },
      { question: "Which tournament is played between England and Australia?", options: ["Border-Gavaskar", "The Ashes", "Asia Cup", "Ranji Trophy"], correctAnswer: "The Ashes", points: 10 },
      { question: "What is the maximum number of overs a bowler can bowl in an ODI match?", options: ["8", "10", "12", "15"], correctAnswer: "10", points: 10 },
      { question: "Which country won the 2011 ICC Cricket World Cup?", options: ["Sri Lanka", "India", "Australia", "England"], correctAnswer: "India", points: 10 },
    ],
    medium: [
      { question: "Who was the first batsman to score a double century in ODI cricket?", options: ["Virender Sehwag", "Sachin Tendulkar", "Rohit Sharma", "Chris Gayle"], correctAnswer: "Sachin Tendulkar", points: 15 },
      { question: "Which bowler has taken the most wickets in Test cricket history?", options: ["Shane Warne", "Muthiah Muralidaran", "James Anderson", "Anil Kumble"], correctAnswer: "Muthiah Muralidaran", points: 15 },
      { question: "In which country did the first day-night Test match take place?", options: ["England", "Australia", "New Zealand", "South Africa"], correctAnswer: "Australia", points: 15 },
      { question: "Who was India's captain during the 2007 ICC World T20 victory?", options: ["Sourav Ganguly", "Rahul Dravid", "MS Dhoni", "Virender Sehwag"], correctAnswer: "MS Dhoni", points: 15 },
      { question: "Which venue is famously called the 'Home of Cricket'?", options: ["MCG", "Lord's", "The Oval", "Eden Gardens"], correctAnswer: "Lord's", points: 15 },
    ],
    difficult: [
      { question: "Who is the only player to score 100 international centuries?", options: ["Sachin Tendulkar", "Virat Kohli", "Ricky Ponting", "Jacques Kallis"], correctAnswer: "Sachin Tendulkar", points: 20 },
      { question: "Who bowled the famous 'Ball of the Century' to Mike Gatting in 1993?", options: ["Shane Warne", "Glenn McGrath", "Wasim Akram", "Curtly Ambrose"], correctAnswer: "Shane Warne", points: 20 },
      { question: "Which country hosted the first ever official Cricket World Cup in 1975?", options: ["Australia", "England", "West Indies", "India"], correctAnswer: "England", points: 20 },
      { question: "Which cricketer holds the record for the highest individual score in Test history?", options: ["Donald Bradman", "Brian Lara", "Matthew Hayden", "Mahela Jayawardene"], correctAnswer: "Brian Lara", points: 20 },
      { question: "Who is the fastest bowler to reach 250 wickets in Test matches?", options: ["Dennis Lillee", "Dale Steyn", "Ravichandran Ashwin", "Muttiah Muralitharan"], correctAnswer: "Dale Steyn", points: 20 },
    ],
  },
  Football: {
    easy: [
      { question: "How long is a standard professional football match?", options: ["80 minutes", "90 minutes", "100 minutes", "120 minutes"], correctAnswer: "90 minutes", points: 10 },
      { question: "Which player is famously known as 'CR7'?", options: ["Lionel Messi", "Cristiano Ronaldo", "Neymar Jr", "Kylian Mbappe"], correctAnswer: "Cristiano Ronaldo", points: 10 },
      { question: "What is the maximum number of players on the field for one team?", options: ["10", "11", "12", "15"], correctAnswer: "11", points: 10 },
      { question: "Which country won the FIFA World Cup in 2022?", options: ["France", "Croatia", "Argentina", "Brazil"], correctAnswer: "Argentina", points: 10 },
      { question: "What card does the referee show to expel a player from the game?", options: ["Yellow Card", "Red Card", "Green Card", "Blue Card"], correctAnswer: "Red Card", points: 10 },
    ],
    medium: [
      { question: "Which club has won the most UEFA Champions League titles?", options: ["AC Milan", "FC Barcelona", "Liverpool", "Real Madrid"], correctAnswer: "Real Madrid", points: 15 },
      { question: "Who is the all-time top scorer in FIFA World Cup history?", options: ["Miroslav Klose", "Ronaldo Nazario", "Pele", "Lionel Messi"], correctAnswer: "Miroslav Klose", points: 15 },
      { question: "Which country hosted the 2014 FIFA World Cup?", options: ["Germany", "South Africa", "Brazil", "Russia"], correctAnswer: "Brazil", points: 15 },
      { question: "Who won the Ballon d'Or in 2023?", options: ["Erling Haaland", "Lionel Messi", "Kylian Mbappe", "Karim Benzema"], correctAnswer: "Lionel Messi", points: 15 },
      { question: "Which Premier League club is known as the 'Red Devils'?", options: ["Liverpool", "Arsenal", "Chelsea", "Manchester United"], correctAnswer: "Manchester United", points: 15 },
    ],
    difficult: [
      { question: "Which country won the first ever FIFA World Cup in 1930?", options: ["Argentina", "Uruguay", "Brazil", "Italy"], correctAnswer: "Uruguay", points: 20 },
      { question: "Who is the youngest player to score in a FIFA World Cup final?", options: ["Pele", "Kylian Mbappe", "Lionel Messi", "Ronaldo Nazario"], correctAnswer: "Pele", points: 20 },
      { question: "Which player has won the most UEFA Champions League trophies?", options: ["Cristiano Ronaldo", "Paco Gento", "Lionel Messi", "Luka Modric"], correctAnswer: "Paco Gento", points: 20 },
      { question: "Which country has reached the most World Cup finals without ever winning?", options: ["Netherlands", "Hungary", "Sweden", "Croatia"], correctAnswer: "Netherlands", points: 20 },
      { question: "Who is the all-time top goalscorer for the England national team?", options: ["Wayne Rooney", "Harry Kane", "Bobby Charlton", "Gary Lineker"], correctAnswer: "Harry Kane", points: 20 },
    ],
  },
};

// Default quiz bank fallback for other categories
const DEFAULT_QUIZ_BANK = {
  easy: [
    { question: "Which sport uses a shuttlecock?", options: ["Tennis", "Badminton", "Squash", "Table Tennis"], correctAnswer: "Badminton", points: 10 },
    { question: "How many rings are there on the Olympic flag?", options: ["4", "5", "6", "7"], correctAnswer: "5", points: 10 },
    { question: "Which sport is played on ice with a puck?", options: ["Ice Hockey", "Curling", "Figure Skating", "Bobsleigh"], correctAnswer: "Ice Hockey", points: 10 },
    { question: "What is the highest score possible with a single dart throw?", options: ["50", "60", "80", "100"], correctAnswer: "60", points: 10 },
    { question: "Which grand slam is played on clay courts?", options: ["Wimbledon", "French Open", "US Open", "Australian Open"], correctAnswer: "French Open", points: 10 },
  ],
  medium: [
    { question: "Who is the legendary sprinter with the world record in 100m?", options: ["Tyson Gay", "Yohan Blake", "Usain Bolt", "Justin Gatlin"], correctAnswer: "Usain Bolt", points: 15 },
    { question: "In basketball, how high is the rim of the hoop from the floor?", options: ["9 feet", "10 feet", "11 feet", "12 feet"], correctAnswer: "10 feet", points: 15 },
    { question: "Which sport uses a mallet to hit a ball through wickets on a lawn?", options: ["Polo", "Croquet", "Golf", "Lacrosse"], correctAnswer: "Croquet", points: 15 },
    { question: "Who has won the most Grand Slam men's singles titles?", options: ["Roger Federer", "Rafael Nadal", "Novak Djokovic", "Pete Sampras"], correctAnswer: "Novak Djokovic", points: 15 },
    { question: "Which country won the most gold medals at the 2020 Tokyo Olympics?", options: ["USA", "China", "Japan", "Great Britain"], correctAnswer: "USA", points: 15 },
  ],
  difficult: [
    { question: "What is the distance of a standard marathon race in miles?", options: ["24.2 miles", "25 miles", "26.2 miles", "27.5 miles"], correctAnswer: "26.2 miles", points: 20 },
    { question: "Which country won the first Hockey World Cup in 1971?", options: ["India", "Pakistan", "Spain", "Netherlands"], correctAnswer: "Pakistan", points: 20 },
    { question: "In tennis, what is the maximum number of sets played in a men's Grand Slam match?", options: ["3", "4", "5", "6"], correctAnswer: "5", points: 20 },
    { question: "Which country hosted the first Olympic Games in the modern era?", options: ["France", "USA", "Greece", "United Kingdom"], correctAnswer: "Greece", points: 20 },
    { question: "What is the length of an Olympic swimming pool in meters?", options: ["25m", "50m", "75m", "100m"], correctAnswer: "50m", points: 20 },
  ],
};

// 3. Battles Templates
const BATTLE_PLAYERS_TEMPLATES = [
  { battleName: "Virat Kohli vs Rohit Sharma", selectedPlayers: ["virat_kohli_id", "rohit_sharma_id"] },
  { battleName: "Jasprit Bumrah vs Mitchell Starc", selectedPlayers: ["jasprit_bumrah_id", "mitchell_starc_id"] },
  { battleName: "Lionel Messi vs Cristiano Ronaldo", selectedPlayers: ["messi_id", "ronaldo_id"] },
  { battleName: "LeBron James vs Stephen Curry", selectedPlayers: ["lebron_james_id", "stephen_curry_id"] },
  { battleName: "Hardik Pandya vs Ben Stokes", selectedPlayers: ["hardik_pandya_id", "ben_stokes_id"] },
];

const BATTLE_CLUBS_TEMPLATES = [
  { battleName: "Chennai Super Kings vs Mumbai Indians", selectedClubs: ["csk_id", "mi_id"] },
  { battleName: "Royal Challengers Bengaluru vs Kolkata Knight Riders", selectedClubs: ["rcb_id", "kkr_id"] },
  { battleName: "Real Madrid vs FC Barcelona", selectedClubs: ["real_madrid_id", "barcelona_id"] },
  { battleName: "Manchester City vs Liverpool", selectedClubs: ["man_city_id", "liverpool_id"] },
  { battleName: "India vs Pakistan", selectedClubs: ["india_cricket_id", "pakistan_cricket_id"] },
];

// 4. Match Predictions Bank
const PREDICTION_TEMPLATES = [
  { question: "Who will win the match?", options: ["Home Team", "Away Team", "Draw/No Result"] },
  { question: "Will any player score a fifty in this match?", options: ["Yes", "No"] },
  { question: "How many wickets will fall in the first 10 overs?", options: ["0 to 1", "2 to 3", "4 or more"] },
  { question: "Will the team winning the toss choose to bat first?", options: ["Yes", "No"] },
  { question: "Which team will hit the most sixes?", options: ["Home Team", "Away Team", "Equal number of sixes"] },
];

// ─── Core Automation Functions ───────────────────────────────────────────────

// 1. Generate Poll
async function generateDailyPoll() {
  console.log("Generating daily poll...");
  const template = POLL_TEMPLATES[Math.floor(Math.random() * POLL_TEMPLATES.length)];

  // Check if poll with similar title exists
  const existing = await db
    .collection("polls")
    .where("title", "==", template.title)
    .get();

  if (!existing.empty) {
    console.log("⏭️  Poll already exists. Skipping.");
    return;
  }

  const options = template.options.map((o, i) => ({
    id: `opt_${i + 1}`,
    label: o.label,
    votes: 0,
    ...(template.type === "quiz" ? { isCorrect: o.isCorrect } : {}),
  }));

  const now = admin.firestore.Timestamp.now();
  // Expiry is 24 hours from now
  const endsAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const newPoll = {
    title: template.title,
    type: template.type,
    options,
    active: true,
    endsAt,
    createdAt: now,
  };

  const docRef = await db.collection("polls").add(newPoll);
  console.log(`✅ Poll created successfully! ID: ${docRef.id}`);
}

// 2. Generate Fan Battle Quizzes
async function generateFanBattleQuizzes() {
  console.log("Generating Fan Battle Quizzes...");
  const levels = ["easy", "medium", "difficult"];
  const categories = ["Cricket", "Football", "General"];

  for (const level of levels) {
    const category = categories[Math.floor(Math.random() * categories.length)];

    // Pull 5 questions from the appropriate bank
    let questionPool = [];
    if (QUIZ_BANK[category] && QUIZ_BANK[category][level]) {
      questionPool = QUIZ_BANK[category][level];
    } else {
      questionPool = DEFAULT_QUIZ_BANK[level];
    }

    // Shuffle pool to pick 5 questions randomly
    const shuffled = [...questionPool].sort(() => 0.5 - Math.random()).slice(0, 5);

    const questionsMapped = shuffled.map((q, i) => ({
      questionNumber: i + 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      points: q.points,
    }));

    const newQuiz = {
      level,
      category,
      questions: questionsMapped,
      totalQuestions: questionsMapped.length,
      totalPoints: questionsMapped.reduce((sum, q) => sum + q.points, 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("fanBattleQuizzes").add(newQuiz);
    console.log(`✅ Fan Battle Quiz (${level} - ${category}) created! ID: ${docRef.id}`);
  }
}

// 3. Generate Fan Battles
async function generateFanBattles() {
  console.log("Generating Fan Battles (Player/Club battles)...");
  const types = ["PLAYERS", "CLUBS"];

  for (const type of types) {
    let template;
    if (type === "PLAYERS") {
      template = BATTLE_PLAYERS_TEMPLATES[Math.floor(Math.random() * BATTLE_PLAYERS_TEMPLATES.length)];
    } else {
      template = BATTLE_CLUBS_TEMPLATES[Math.floor(Math.random() * BATTLE_CLUBS_TEMPLATES.length)];
    }

    const existing = await db
      .collection("fanBattles")
      .where("battleName", "==", template.battleName)
      .get();

    if (!existing.empty) {
      console.log(`⏭️  Battle "${template.battleName}" already exists. Skipping.`);
      continue;
    }

    const newBattle = {
      battleName: template.battleName,
      battleType: type,
      selectedPlayers: template.selectedPlayers ?? [],
      selectedClubs: template.selectedClubs ?? [],
      invitedFriends: [],
      userId: "admin",
      userName: "Admin User",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("fanBattles").add(newBattle);
    console.log(`✅ Fan Battle (${type}) created! ID: ${docRef.id} - ${template.battleName}`);
  }
}

// 4. Generate Predictions for Active Matches
async function generatePredictionsForActiveMatches() {
  console.log("Checking active matches for prediction generation...");
  const matchesSnapshot = await db.collection("watchAlongMatches").get();

  if (matchesSnapshot.empty) {
    console.log("⚠️  No matches found in watchAlongMatches. Skipping predictions.");
    return;
  }

  let predictionsAddedCount = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const matchId = matchDoc.id;
    const matchData = docData(matchDoc);

    // Let's check if match is active/live (if field exists and is live/active)
    // For simplicity, let's auto-create predictions for match docs where predictions subcollection is empty
    const predictionsSnap = await matchDoc.ref.collection("predictions").limit(1).get();

    if (predictionsSnap.empty) {
      console.log(`Generating predictions for match: ${matchId}`);
      // Pick 3 random prediction templates
      const shuffledTemplates = [...PREDICTION_TEMPLATES].sort(() => 0.5 - Math.random()).slice(0, 3);

      for (const t of shuffledTemplates) {
        // Resolve home and away team names if available in the match doc
        let question = t.question;
        let options = [...t.options];

        if (matchData.homeTeam && matchData.awayTeam) {
          question = question
            .replace("Home Team", matchData.homeTeam)
            .replace("Away Team", matchData.awayTeam);
          options = options.map((opt) =>
            opt
              .replace("Home Team", matchData.homeTeam)
              .replace("Away Team", matchData.awayTeam)
          );
        }

        const votes = {};
        options.forEach((opt) => {
          votes[opt] = 0;
        });

        const newPrediction = {
          question,
          options,
          votes,
          totalVotes: 0,
          closesAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours from now
          isOpen: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await matchDoc.ref.collection("predictions").add(newPrediction);
      }
      predictionsAddedCount++;
      console.log(`✅ 3 Predictions created for match: ${matchId}`);
    }
  }

  console.log(`Done! Predictions generated for ${predictionsAddedCount} matches.`);
}

function docData(doc) {
  return doc.data() || {};
}

// ─── Orchestrator / Entry ─────────────────────────────────────────────────────
async function runEngagementAutomation() {
  try {
    console.log("\n🚀 Starting Automated Engagement Content Ingestion");
    console.log("=".repeat(60));

    await generateDailyPoll();
    await generateFanBattleQuizzes();
    await generateFanBattles();
    await generatePredictionsForActiveMatches();

    console.log("=".repeat(60));
    console.log("🎉 Automation Run Complete!");
  } catch (error) {
    console.error("❌ Automation Ingestion Error:", error);
  }
}

// Simple scheduling logic (once every 24 hours)
const intervalMs = 24 * 60 * 60 * 1000;
setInterval(runEngagementAutomation, intervalMs);

// Trigger on start
runEngagementAutomation();
