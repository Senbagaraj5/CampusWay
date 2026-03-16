
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

console.log("🚀 CAMPUSWAY FIREBASE UPDATE SCRIPT");
console.log("Run this in your browser console on the CampusWay app or use Firebase Admin SDK.");

/*
// CODE TO RUN IN BROWSER CONSOLE:
const BUS_DATA = [ ... PASTE ABOVE DATA ... ];
const dbRef = firebase.database().ref('buses');

BUS_DATA.forEach(bus => {
  const busId = `bus_${bus.busNumber}`;
  dbRef.child(busId).update({
    busNumber: bus.busNumber,
    registrationNumber: bus.reg,
    route: bus.route,
    password: bus.reg, // Registration number is the default password
    isDefaultPassword: true,
    status: "offline",
    updatedAt: Date.now()
  });
});
console.log("✅ All buses updated in Firebase!");
*/

export default BUS_DATA;
