// import admin from "firebase-admin";

// let db: FirebaseFirestore.Firestore;

// if (!admin.apps.length) {
//   console.log(" Initializing Firebase Admin...");

//   const app = admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//     }),
//     //  Add this — explicitly point to your database
//     databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
//   });

//   db = admin.firestore(app);
//   db.settings({
//     ignoreUndefinedProperties: true,
//     //  Add this — explicitly use the default database
//     databaseId: "default",
//   });

//   console.log(" Firebase initialized");

// } else {
//   db = admin.firestore();
// }

// export { db };




import admin from "firebase-admin";

let db: FirebaseFirestore.Firestore;

if (!admin.apps.length) {
  console.log("Initializing Firebase Admin...");

  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  db = admin.firestore(app);
  db.settings({
    ignoreUndefinedProperties: true,
    databaseId: "(default)", // ✅ fix: parentheses required
  });

  console.log("Firebase initialized, project:", process.env.FIREBASE_PROJECT_ID);
} else {
  console.log("Reusing existing Firebase app");
  db = admin.firestore(admin.apps[0]!); // ✅ fix: reuse the specific app, not a new instance
}

export { db };