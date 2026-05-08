import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBd76jJc9q9nVGGAhwYsiFaZNiAZSoxmLI",
  authDomain: "leadership-b2f38.firebaseapp.com",
  projectId: "leadership-b2f38",
  storageBucket: "leadership-b2f38.firebasestorage.app",
  messagingSenderId: "375126149086",
  appId: "1:375126149086:web:ad14c27ae9dc8205d83f4f",
  measurementId: "G-GK5QF4XP2H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  app,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
};
