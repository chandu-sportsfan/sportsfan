import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// ─── Data Banks ───────────────────────────────────────────────────────────────

const POLL_TEMPLATES = [
  {
    title: "Who is currently the most complete all-rounder in modern cricket?",
    type: "poll" as const,
    options: [
      { label: "Ravindra Jadeja", isCorrect: false },
      { label: "Ben Stokes", isCorrect: false },
      { label: "Hardik Pandya", isCorrect: false },
      { label: "Shakib Al Hasan", isCorrect: false },
    ],
  },
  {
    title: "Which team will dominate the IPL powerplay overs this season?",
    type: "poll" as const,
    options: [
      { label: "Mumbai Indians", isCorrect: false },
      { label: "Chennai Super Kings", isCorrect: false },
      { label: "Royal Challengers Bengaluru", isCorrect: false },
      { label: "Kolkata Knight Riders", isCorrect: false },
    ],
  },
  {
    title: "Who is your pick for the best finisher in limited-overs cricket right now?",
    type: "poll" as const,
    options: [
      { label: "Heinrich Klaasen", isCorrect: false },
      { label: "Rinku Singh", isCorrect: false },
      { label: "Liam Livingstone", isCorrect: false },
      { label: "Tim David", isCorrect: false },
    ],
  },
  {
    title: "Which team is the strongest contender for the UEFA Champions League title?",
    type: "poll" as const,
    options: [
      { label: "Real Madrid", isCorrect: false },
      { label: "Manchester City", isCorrect: false },
      { label: "Bayern Munich", isCorrect: false },
      { label: "Arsenal", isCorrect: false },
    ],
  },
  {
    title: "Who holds the record for the fastest century in ODI cricket history?",
    type: "quiz" as const,
    options: [
      { label: "AB de Villiers (31 balls)", isCorrect: true },
      { label: "Corey Anderson (36 balls)", isCorrect: false },
      { label: "Shahid Afridi (37 balls)", isCorrect: false },
      { label: "Brian Lara (45 balls)", isCorrect: false },
    ],
  },
  {
    title: "Which country has won the most FIFA World Cup titles?",
    type: "quiz" as const,
    options: [
      { label: "Brazil (5 titles)", isCorrect: true },
      { label: "Germany (4 titles)", isCorrect: false },
      { label: "Italy (4 titles)", isCorrect: false },
      { label: "Argentina (3 titles)", isCorrect: false },
    ],
  },
];

const QUIZ_BANK = {
  Cricket: {
    easy: [
      { question: "How many players are there on a cricket field from one team?", options: ["9", "10", "11", "12"], correctAnswer: "11", points: 10 },
      { question: "What is the length of a standard cricket pitch in yards?", options: ["20 yards", "22 yards", "24 yards", "26 yards"], correctAnswer: "22 yards", points: 10 },
      { question: "Which tournament is played between England and Australia?", options: ["Border-Gavaskar", "The Ashes", "Asia Cup", "Ranji Trophy"], correctAnswer: "The Ashes", points: 10 },
    ],
    medium: [
      { question: "Who was the first batsman to score a double century in ODI cricket?", options: ["Virender Sehwag", "Sachin Tendulkar", "Rohit Sharma", "Chris Gayle"], correctAnswer: "Sachin Tendulkar", points: 15 },
      { question: "Which bowler has taken the most wickets in Test cricket history?", options: ["Shane Warne", "Muthiah Muralidaran", "James Anderson", "Anil Kumble"], correctAnswer: "Muthiah Muralidaran", points: 15 },
    ],
    difficult: [
      { question: "Who is the only player to score 100 international centuries?", options: ["Sachin Tendulkar", "Virat Kohli", "Ricky Ponting", "Jacques Kallis"], correctAnswer: "Sachin Tendulkar", points: 20 },
      { question: "Who bowled the famous 'Ball of the Century' to Mike Gatting in 1993?", options: ["Shane Warne", "Glenn McGrath", "Wasim Akram", "Curtly Ambrose"], correctAnswer: "Shane Warne", points: 20 },
    ],
  },
  Football: {
    easy: [
      { question: "How long is a standard professional football match?", options: ["80 minutes", "90 minutes", "100 minutes", "120 minutes"], correctAnswer: "90 minutes", points: 10 },
      { question: "Which player is famously known as 'CR7'?", options: ["Lionel Messi", "Cristiano Ronaldo", "Neymar Jr", "Kylian Mbappe"], correctAnswer: "Cristiano Ronaldo", points: 10 },
    ],
    medium: [
      { question: "Which club has won the most UEFA Champions League titles?", options: ["AC Milan", "FC Barcelona", "Liverpool", "Real Madrid"], correctAnswer: "Real Madrid", points: 15 },
    ],
    difficult: [
      { question: "Which country won the first ever FIFA World Cup in 1930?", options: ["Argentina", "Uruguay", "Brazil", "Italy"], correctAnswer: "Uruguay", points: 20 },
    ],
  },
};

const DEFAULT_QUIZ_BANK = {
  easy: [
    { question: "Which sport uses a shuttlecock?", options: ["Tennis", "Badminton", "Squash", "Table Tennis"], correctAnswer: "Badminton", points: 10 },
    { question: "How many rings are there on the Olympic flag?", options: ["4", "5", "6", "7"], correctAnswer: "5", points: 10 },
  ],
  medium: [
    { question: "Who is the legendary sprinter with the world record in 100m?", options: ["Tyson Gay", "Yohan Blake", "Usain Bolt", "Justin Gatlin"], correctAnswer: "Usain Bolt", points: 15 },
  ],
  difficult: [
    { question: "What is the distance of a standard marathon race in miles?", options: ["24.2 miles", "25 miles", "26.2 miles", "27.5 miles"], correctAnswer: "26.2 miles", points: 20 },
  ],
};

const BATTLE_PLAYERS_TEMPLATES = [
  { battleName: "Virat Kohli vs Rohit Sharma", selectedPlayers: ["virat_kohli_id", "rohit_sharma_id"] },
  { battleName: "Jasprit Bumrah vs Mitchell Starc", selectedPlayers: ["jasprit_bumrah_id", "mitchell_starc_id"] },
  { battleName: "Lionel Messi vs Cristiano Ronaldo", selectedPlayers: ["messi_id", "ronaldo_id"] },
];

const BATTLE_CLUBS_TEMPLATES = [
  { battleName: "Chennai Super Kings vs Mumbai Indians", selectedClubs: ["csk_id", "mi_id"] },
  { battleName: "Royal Challengers Bengaluru vs Kolkata Knight Riders", selectedClubs: ["rcb_id", "kkr_id"] },
];

const PREDICTION_TEMPLATES = [
  { question: "Who will win the match?", options: ["Home Team", "Away Team", "Draw/No Result"] },
  { question: "Will any player score a fifty in this match?", options: ["Yes", "No"] },
  { question: "How many wickets will fall in the first 10 overs?", options: ["0 to 1", "2 to 3", "4 or more"] },
];

// ─── Route Handlers ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  return handleAutomation();
}

export async function POST(req: NextRequest) {
  return handleAutomation();
}

async function handleAutomation() {
  try {
    const results = {
      pollCreated: false,
      quizzesCreated: 0,
      battlesCreated: 0,
      matchesPredicted: 0,
    };

    // 1. Generate Poll
    const pollTemplate = POLL_TEMPLATES[Math.floor(Math.random() * POLL_TEMPLATES.length)];
    const existingPoll = await db
      .collection("polls")
      .where("title", "==", pollTemplate.title)
      .get();

    if (existingPoll.empty) {
      const options = pollTemplate.options.map((o, i) => ({
        id: `opt_${i + 1}`,
        label: o.label,
        votes: 0,
        ...(pollTemplate.type === "quiz" ? { isCorrect: o.isCorrect } : {}),
      }));

      const now = Timestamp.now();
      const endsAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

      await db.collection("polls").add({
        title: pollTemplate.title,
        type: pollTemplate.type,
        options,
        active: true,
        endsAt,
        createdAt: now,
      });
      results.pollCreated = true;
    }

    // 2. Generate Fan Battle Quizzes
    const levels = ["easy", "medium", "difficult"] as const;
    const categories = ["Cricket", "Football"] as const;

    for (const level of levels) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      let questionPool = [];

      if (QUIZ_BANK[category] && QUIZ_BANK[category][level]) {
        questionPool = QUIZ_BANK[category][level];
      } else {
        questionPool = DEFAULT_QUIZ_BANK[level];
      }

      const shuffled = [...questionPool].sort(() => 0.5 - Math.random()).slice(0, 5);
      const questionsMapped = shuffled.map((q, i) => ({
        questionNumber: i + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
      }));

      if (questionsMapped.length > 0) {
        await db.collection("fanBattleQuizzes").add({
          level,
          category,
          questions: questionsMapped,
          totalQuestions: questionsMapped.length,
          totalPoints: questionsMapped.reduce((sum, q) => sum + q.points, 0),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.quizzesCreated++;
      }
    }

    // 3. Generate Fan Battles
    const types = ["PLAYERS", "CLUBS"] as const;
    for (const type of types) {
      const template = type === "PLAYERS"
        ? BATTLE_PLAYERS_TEMPLATES[Math.floor(Math.random() * BATTLE_PLAYERS_TEMPLATES.length)]
        : BATTLE_CLUBS_TEMPLATES[Math.floor(Math.random() * BATTLE_CLUBS_TEMPLATES.length)];

      const existingBattle = await db
        .collection("fanBattles")
        .where("battleName", "==", template.battleName)
        .get();

      if (existingBattle.empty) {
        await db.collection("fanBattles").add({
          battleName: template.battleName,
          battleType: type,
          selectedPlayers: "selectedPlayers" in template ? template.selectedPlayers : [],
          selectedClubs: "selectedClubs" in template ? template.selectedClubs : [],
          invitedFriends: [],
          userId: "admin",
          userName: "Admin User",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.battlesCreated++;
      }
    }

    // 4. Generate Predictions for Active Matches
    const matchesSnapshot = await db.collection("watchAlongMatches").get();
    for (const matchDoc of matchesSnapshot.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data() || {};
      const predictionsSnap = await matchDoc.ref.collection("predictions").limit(1).get();

      if (predictionsSnap.empty) {
        const shuffledTemplates = [...PREDICTION_TEMPLATES].sort(() => 0.5 - Math.random()).slice(0, 3);

        for (const t of shuffledTemplates) {
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

          const votes: Record<string, number> = {};
          options.forEach((opt) => {
            votes[opt] = 0;
          });

          await matchDoc.ref.collection("predictions").add({
            question,
            options,
            votes,
            totalVotes: 0,
            closesAt: Date.now() + 12 * 60 * 60 * 1000,
            isOpen: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        results.matchesPredicted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Automated engagements created successfully!",
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
