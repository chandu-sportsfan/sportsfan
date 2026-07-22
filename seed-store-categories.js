const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Load env files manually
const envLocalPath = path.resolve(__dirname, './.env.local');
const envPath = path.resolve(__dirname, './.env');

const loadEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    console.log("Loading env from:", filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const firstEq = line.indexOf('=');
      if (firstEq === -1) return;
      const key = line.slice(0, firstEq).trim();
      let val = line.slice(firstEq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      val = val.replace(/\\n/g, '\n');
      process.env[key] = val;
    });
  }
};

loadEnvFile(envPath);
loadEnvFile(envLocalPath);

// 2. Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
}

const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true,
  databaseId: "(default)",
});

const categories = [
    { key: 'coaches', label: 'Coaches', icon: 'Users', route: '/MainModules/AtheleteStore/StoreCoachListing', color: '#c9115f', bgOpacity: 0.12 },
    { key: 'experiences', label: 'Experiences', icon: 'Ticket', route: '/MainModules/AtheleteStore/StoreExperiences', color: '#cd620e', bgOpacity: 0.12 },
    { key: 'events', label: 'Events', icon: 'Trophy', route: '/MainModules/AtheleteStore/StoreTicketedEvents', color: '#FFD700', bgOpacity: 0.10 },
    { key: 'auctions', label: 'Auctions', icon: 'Gavel', route: '/MainModules/AtheleteStore/StoreAuctions', color: '#ff4444', bgOpacity: 0.12 },
    { key: 'athletes', label: 'Athletes', icon: 'Zap', route: '/MainModules/AtheleteStore/StoreAthelete', color: '#0ea5e9', bgOpacity: 0.12 },
    { key: 'memorabilia', label: 'Merch', icon: 'Gem', route: '/MainModules/AtheleteStore/StoreMemorabilia', color: '#d97706', bgOpacity: 0.12 },
    { key: 'brands', label: 'Brands', icon: 'ShoppingBag', route: '/MainModules/AtheleteStore/StoreBrands', color: '#8b5cf6', bgOpacity: 0.12 },
    { key: 'digital', label: 'Digital', icon: 'BookOpen', route: '/MainModules/AtheleteStore/StoreDigital', color: '#10b981', bgOpacity: 0.12 },
    { key: 'memberships', label: 'Members', icon: 'Award', route: '/MainModules/AtheleteStore/StoreMemberships', color: '#ec4899', bgOpacity: 0.12 },
    { key: 'dolly', label: 'AI Dolly', icon: 'Cpu', route: '/MainModules/AtheleteStore/StoreDolly', color: '#7c3aed', bgOpacity: 0.12 },
];

async function seed() {
  console.log("Seeding store categories...");
  const batch = db.batch();
  categories.forEach((cat) => {
    const ref = db.collection("storeCategories").doc(cat.key);
    batch.set(ref, {
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      route: cat.route,
      color: cat.color,
      bgOpacity: cat.bgOpacity,
      sport: 'athlete',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  console.log("Seeding store categories successfully complete!");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
