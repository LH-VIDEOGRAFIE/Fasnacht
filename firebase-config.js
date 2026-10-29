// ============================================================
//  HIER DEINE FIREBASE-DATEN EINTRAGEN (siehe ANLEITUNG.md)
// ============================================================

export const firebaseConfig = {
  apiKey: "HIER_API_KEY_EINTRAGEN",
  authDomain: "dein-projekt.firebaseapp.com",
  projectId: "dein-projekt",
  storageBucket: "dein-projekt.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// E-Mail des Personal-Kontos, das du in Firebase → Authentication angelegt hast.
// Das Personal gibt in der App nur das PASSWORT ein, die E-Mail steht hier fest.
// WICHTIG: Dieselbe E-Mail muss auch in den Firestore-Regeln stehen (firestore.rules).
export const STAFF_EMAIL = "personal@meinverein.de";
