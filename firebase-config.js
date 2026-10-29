const FIREBASE_CONFIG={apiKey:"HIER_EINTRAGEN",authDomain:"HIER_EINTRAGEN",projectId:"fasnacht-bestellungen",appId:"1:489525283948:web:19ef3b6d791d84de881c49"};
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBj4SAeWRIGt2H4xXRVqhyfmDU37Vc1rPA",
  authDomain: "fasnacht-bestellungen.firebaseapp.com",
  projectId: "fasnacht-bestellungen",
  storageBucket: "fasnacht-bestellungen.firebasestorage.app",
  messagingSenderId: "489525283948",
  appId: "1:489525283948:web:19ef3b6d791d84de881c49"
};

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
