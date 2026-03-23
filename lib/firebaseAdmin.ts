// import admin from "firebase-admin";

// let db: FirebaseFirestore.Firestore;

// try {
//   if (!admin.apps.length) {
//     console.log("🔥 Initializing Firebase Admin...");

//     const projectId = process.env.FIREBASE_PROJECT_ID;
//     const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
//     const privateKey = process.env.FIREBASE_PRIVATE_KEY;

//     console.log("📌 Project ID:", projectId);
//     console.log("📌 Client Email:", clientEmail);
//     console.log("📌 Private Key exists:", !!privateKey);

//     if (!projectId || !clientEmail || !privateKey) {
//       throw new Error("❌ Missing Firebase environment variables");
//     }

//     const app = admin.initializeApp({
//       credential: admin.credential.cert({
//         projectId,
//         clientEmail,
//         privateKey: privateKey.replace(/\\n/g, "\n"),
//       }),
//     });

//     console.log("✅ Firebase initialized successfully");

//     db = admin.firestore(app);

//     console.log("🔥 Firestore instance created");

//     db.settings({
//       ignoreUndefinedProperties: true,
//     });

//     console.log("✅ Firestore settings applied");

//   } else {
//     console.log("♻️ Firebase already initialized, reusing instance");

//     db = admin.firestore();
//   }

// } catch (error: any) {
//   console.error("❌ Firebase Init Error:", error.message);
//   throw error;
// }

// export { db };







import admin from "firebase-admin";

let db: FirebaseFirestore.Firestore;

if (!admin.apps.length) {
  console.log("🔥 Initializing Firebase Admin...");

  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    // ✅ Add this — explicitly point to your database
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });

  db = admin.firestore(app);
  db.settings({
    ignoreUndefinedProperties: true,
    // ✅ Add this — explicitly use the default database
    databaseId: "default",
  });

  console.log("✅ Firebase initialized");

} else {
  db = admin.firestore();
}

export { db };