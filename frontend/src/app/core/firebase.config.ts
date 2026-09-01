import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Configuración de prueba para ambiente de desarrollo / staging de TRAMA SUR
export const firebaseConfig = {
  apiKey: 'AIzaSyDemoKeyTramaSurSparkPlan2026',
  authDomain: 'trama-sur-qa-staging.firebaseapp.com',
  projectId: 'trama-sur-qa-staging',
  storageBucket: 'trama-sur-qa-staging.appspot.com',
  messagingSenderId: '100200300400',
  appId: '1:100200300400:web:abcdef1234567890'
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    try {
      // Habilitar persistencia offline con IndexedDB para optimizar cuotas Spark (0 lecturas repetidas)
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      // Si ya está inicializado en otra instancia
      db = initializeFirestore(firebaseApp, {});
    }
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}
