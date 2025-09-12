// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjmLZo7Xsf4jFxzo174ImhBhq1qWtIm-Y",
  authDomain: "atendimento-f2f9f.firebaseapp.com",
  projectId: "atendimento-f2f9f",
  storageBucket: "atendimento-f2f9f.firebasestorage.app",
  messagingSenderId: "366497129323",
  appId: "1:366497129323:web:77328a945a4c111296a22e",
  measurementId: "G-H4Q69ZG9DP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics only in browser environment and catch errors
let analytics = null;
try {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.warn('Analytics não pôde ser inicializado:', error);
}

export { analytics };
export default app;
