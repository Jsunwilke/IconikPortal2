import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaP796OVAklKVqukI6WPeT-xkQg0Usp3c",
  authDomain: "iconik-portal.firebaseapp.com",
  projectId: "iconik-portal",
  storageBucket: "iconik-portal.firebasestorage.app",
  messagingSenderId: "334527954412",
  appId: "1:334527954412:web:832582b3ffdb4a39ee94c9",
  measurementId: "G-FM0ZRSB957",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize functions with explicit region
export const functions = getFunctions(app, "us-central1");

export default app;
