
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, update } from 'firebase/database';

// Firebase Configuration
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
const database = getDatabase(app);

const BUS_DATA = [
  { busNumber: "2", reg: "TN63AJ8602", route: "Neivasal" },
  { busNumber: "3", reg: "TN63AK1260", route: "SS.Kottai" },
  { busNumber: "4", reg: "TN63AK1264", route: "Illupakudi" },
  { busNumber: "6", reg: "TN63AJ8845", route: "Senjai" },
  { busNumber: "7", reg: "TN63AL8220", route: "Thirupathur Pudhu Theru" },
  { busNumber: "8", reg: "TN63AJ8903", route: "Singampunari" },
  { busNumber: "9", reg: "TN63AL8156", route: "Spare" },
  { busNumber: "11", reg: "TN63AL9236", route: "Spare" },
  { busNumber: "12", reg: "TN63AJ8611", route: "Spare" },
  { busNumber: "13", reg: "TN63AJ8570", route: "Spare" },
  { busNumber: "14", reg: "TN63BA0058", route: "Velangudi" },
  { busNumber: "15", reg: "TN63BA0204", route: "Karaikudi" },
  { busNumber: "16", reg: "TN63BA3179", route: "Eriyur" },
  { busNumber: "17", reg: "TN63BC3589", route: "Akilmanai, Thirupathur" },
  { busNumber: "18", reg: "TN63BC3805", route: "Sembanur" },
  { busNumber: "19", reg: "TN63BD8042", route: "Kotaiyur" },
  { busNumber: "20", reg: "TN63BE0936", route: "Keelasevalpatti" },
  { busNumber: "34", reg: "TN55AC5864", route: "Kallutimedu" },
  { busNumber: "50", reg: "TN55BC5526", route: "Elanthaimangalam" }
];

async function updateBuses() {
  console.log("🚀 Starting Firebase Fleet Update...");
  
  const updates = {};
  
  BUS_DATA.forEach(bus => {
    const busId = `bus_${bus.busNumber}`;
    updates[`buses/${busId}`] = {
      busNumber: bus.busNumber,
      registrationNumber: bus.reg,
      route: bus.route,
      password: bus.reg,
      mustChangePassword: true,
      status: "offline",
      updatedAt: Date.now()
    };
  });

  try {
    await update(ref(database), updates);
    console.log("✅ All 19 buses updated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating buses:", error);
    process.exit(1);
  }
}

updateBuses();
