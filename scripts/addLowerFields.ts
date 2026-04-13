import * as admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });
}

const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true,
  databaseId: 'default',
});

async function addLowerFields() {
  console.log('Starting... fetching playershome collection');

  const snapshot = await db.collection("playershome").get();

  if (snapshot.empty) {
    console.log('No documents found in playershome collection.');
    return;
  }

  console.log(`Found ${snapshot.docs.length} documents. Processing...`);

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.playerName && !data.playerNameLower) {
      batch.update(doc.ref, {
        playerNameLower: data.playerName.toLowerCase()
      });
      count++;
      console.log(`  → "${data.playerName}" → playerNameLower: "${data.playerName.toLowerCase()}"`);
    }
  }

  if (count === 0) {
    console.log('✅ All documents already have playerNameLower. Nothing to update.');
    return;
  }

  await batch.commit();
  console.log(`\n✅ Done! Added playerNameLower to ${count} documents.`);
}

addLowerFields().catch(console.error);