import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyBX2FcNzvvCEGk7IKCECLLUnGcutas2GuQ",
    authDomain: "campusway-mzcet.firebaseapp.com",
    databaseURL: "https://campusway-mzcet-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "campusway-mzcet",
    storageBucket: "campusway-mzcet.firebasestorage.app",
    messagingSenderId: "794379773462",
    appId: "1:794379773462:web:9ba07bed33d37c30317737",
    measurementId: "G-63EZSB20EY"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const db = database; // Alias for consistency with user request
export default app;
