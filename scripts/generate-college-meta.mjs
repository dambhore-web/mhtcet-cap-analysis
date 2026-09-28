// One-time script: generates data/processed/2026/college-meta.json
// containing district and collegeType for all 387 colleges.
// Sources:
//   - district: FRA portal data (same source as generate-fees.mjs)
//   - collegeType: derived from institutes.json status field
//   - district fallback: inferred from college name for govt colleges not in FRA
// Run: node scripts/generate-college-meta.mjs
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const institutes = JSON.parse(readFileSync(join(root, "data/processed/2026/institutes.json"), "utf-8"));

// ── District from FRA data ──────────────────────────────────────────────────
// Same EN* entries as generate-fees.mjs. Only district and instId are used here.
const FRA_DISTRICTS = [
  ["EN03143","Mumbai-Suburban"],["EN05249","Jalgaon"],["EN05370","Ahilyanagar"],
  ["EN05513","Nandurbar"],["EN05545","Dhule"],["EN06007","Sangli"],
  ["EN06714","Kolhapur"],["EN1101","Buldhana"],["EN1105","Amravati"],
  ["EN1107","Amravati"],["EN1114","Amravati"],["EN1116","Akola"],
  ["EN1117","Yavatmal"],["EN1119","Buldhana"],["EN1120","Yavatmal"],
  ["EN1121","Amravati"],["EN1123","Amravati"],["EN1125","Buldhana"],
  ["EN1126","Amravati"],["EN1127","Yavatmal"],["EN1128","Amravati"],
  ["EN1130","Buldhana"],["EN1180","Washim"],["EN1182","Buldhana"],
  ["EN1265","Buldhana"],["EN1276","Akola"],["EN16121","Kolhapur"],
  ["EN2111","Chhatrapati Sambhaji Nagar"],["EN2112","Chhatrapati Sambhaji Nagar"],
  ["EN2113","Chhatrapati Sambhaji Nagar"],["EN2114","Chhatrapati Sambhaji Nagar"],
  ["EN2116","Nanded"],["EN2127","Nanded"],["EN2129","Latur"],
  ["EN2130","Dharashiv"],["EN2131","Dharashiv"],["EN2133","Beed"],
  ["EN2134","Chhatrapati Sambhaji Nagar"],["EN2135","Chhatrapati Sambhaji Nagar"],
  ["EN2136","Beed"],["EN2137","Beed"],["EN2138","Jalna"],
  ["EN2146","Dharashiv"],["EN2250","Chhatrapati Sambhaji Nagar"],
  ["EN2252","Parbhani"],["EN2254","Latur"],["EN2282","Beed"],
  ["EN2516","Chhatrapati Sambhaji Nagar"],["EN2522","Latur"],
  ["EN2533","Chhatrapati Sambhaji Nagar"],["EN2637","Nanded"],
  ["EN2641","Dharashiv"],["EN2666","Chhatrapati Sambhaji Nagar"],
  ["EN3025","Mumbai-Suburban"],["EN3135","Mumbai-Suburban"],
  ["EN3139","Mumbai-City"],["EN3146","Raigad"],["EN3147","Raigad"],
  ["EN3148","Mumbai-Suburban"],["EN3154","Raigad"],["EN3175","Raigad"],
  ["EN3176","Mumbai-Suburban"],["EN3182","Mumbai-City"],["EN3183","Mumbai-City"],
  ["EN3184","Mumbai-Suburban"],["EN3185","Mumbai-Suburban"],["EN3187","Thane"],
  ["EN3188","Mumbai-City"],["EN3189","Thane"],["EN3190","Thane"],
  ["EN3192","Thane"],["EN3193","Thane"],["EN3194","Palghar"],
  ["EN3196","Thane"],["EN3197","Thane"],["EN3198","Raigad"],
  ["EN3199","Mumbai-City"],["EN3200","Ratnagiri"],["EN3201","Mumbai-Suburban"],
  ["EN3202","Ratnagiri"],["EN3203","Mumbai-Suburban"],["EN3204","Mumbai-Suburban"],
  ["EN3206","Sindhudurg"],["EN3207","Raigad"],["EN3208","Mumbai-Suburban"],
  ["EN3209","Mumbai-City"],["EN3210","Thane"],["EN3211","Thane"],
  ["EN3212","Thane"],["EN3214","Mumbai-City"],["EN3215","Mumbai-Suburban"],
  ["EN3216","Ratnagiri"],["EN3217","Thane"],["EN3218","Palghar"],
  ["EN3219","Thane"],["EN3220","Raigad"],["EN3221","Palghar"],
  ["EN3222","Palghar"],["EN3223","Raigad"],["EN3224","Raigad"],
  ["EN3257","Thane"],["EN3277","Thane"],["EN3351","Thane"],
  ["EN3353","Raigad"],["EN3423","Thane"],["EN3440","Sindhudurg"],
  ["EN3445","Thane"],["EN3447","Raigad"],["EN3462","Ratnagiri"],
  ["EN3470","Sindhudurg"],["EN3471","Thane"],["EN3475","Thane"],
  ["EN3477","Raigad"],["EN3503","Thane"],["EN3546","Thane"],
  ["EN3721","Buldhana"],["EN4116","Nagpur"],["EN4123","Nagpur"],
  ["EN4133","Nagpur"],["EN4134","Nagpur"],["EN4135","Nagpur"],
  ["EN4137","Nagpur"],["EN4138","Nagpur"],["EN4139","Nagpur"],
  ["EN4141","Nagpur"],["EN4142","Nagpur"],["EN4143","Bhandara"],
  ["EN4144","Nagpur"],["EN4145","Nagpur"],["EN4147","Nagpur"],
  ["EN4151","Nagpur"],["EN4163","Chandrapur"],["EN4167","Nagpur"],
  ["EN4172","Nagpur"],["EN4174","Nagpur"],["EN4175","Wardha"],
  ["EN4177","Nagpur"],["EN4181","Nagpur"],["EN4188","Chandrapur"],
  ["EN4190","Chandrapur"],["EN4193","Nagpur"],["EN4196","Nagpur"],
  ["EN4197","Wardha"],["EN4302","Bhandara"],["EN4304","Nagpur"],
  ["EN4613","Nagpur"],["EN4648","Wardha"],["EN4649","Wardha"],
  ["EN4679","Bhandara"],["EN4703","Chandrapur"],["EN5103","Dhule"],
  ["EN5104","Jalgaon"],["EN5106","Jalgaon"],["EN5108","Nashik"],
  ["EN5109","Nashik"],["EN5121","Nashik"],["EN5124","Nashik"],
  ["EN5125","Nashik"],["EN5139","Ahilyanagar"],["EN5160","Ahilyanagar"],
  ["EN5161","Ahilyanagar"],["EN5162","Ahilyanagar"],["EN5164","Nandurbar"],
  ["EN5168","Jalgaon"],["EN5169","Dhule"],["EN5170","Jalgaon"],
  ["EN5171","Jalgaon"],["EN5172","Dhule"],["EN5173","Nashik"],
  ["EN5177","Nashik"],["EN5179","Ahilyanagar"],["EN5180","Nashik"],
  ["EN5181","Nashik"],["EN5182","Nashik"],["EN5184","Nashik"],
  ["EN5244","Nashik"],["EN5256","Nashik"],["EN5263","Nashik"],
  ["EN5303","Ahilyanagar"],["EN5322","Nandurbar"],["EN5330","Nashik"],
  ["EN5331","Nashik"],["EN5365","Dhule"],["EN5380","Ahilyanagar"],
  ["EN5381","Dhule"],["EN5382","Ahilyanagar"],["EN5390","Nashik"],
  ["EN5396","Jalgaon"],["EN5399","Nashik"],["EN5401","Nashik"],
  ["EN5408","Ahilyanagar"],["EN5409","Ahilyanagar"],["EN5411","Nashik"],
  ["EN5418","Nashik"],["EN5433","Dhule"],["EN6122","Pune"],
  ["EN6138","Pune"],["EN6139","Pune"],["EN6141","Pune"],
  ["EN6144","Pune"],["EN6145","Pune"],["EN6146","Pune"],
  ["EN6149","Pune"],["EN6155","Pune"],["EN6156","Pune"],
  ["EN6175","Pune"],["EN6177","Pune"],["EN6178","Pune"],
  ["EN6179","Pune"],["EN6182","Pune"],["EN6183","Pune"],
  ["EN6184","Pune"],["EN6185","Pune"],["EN6187","Pune"],
  ["EN6203","Pune"],["EN6206","Pune"],["EN6207","Pune"],
  ["EN6214","Sangli"],["EN6217","Kolhapur"],["EN6219","Solapur"],
  ["EN6220","Solapur"],["EN6222","Kolhapur"],["EN6223","Solapur"],
  ["EN6250","Kolhapur"],["EN6265","Solapur"],["EN6267","Kolhapur"],
  ["EN6268","Kolhapur"],["EN6269","Sangli"],["EN6270","Satara"],
  ["EN6271","Pune"],["EN6272","Pune"],["EN6273","Pune"],
  ["EN6274","Pune"],["EN6275","Pune"],["EN6276","Pune"],
  ["EN6277","Kolhapur"],["EN6278","Pune"],["EN6281","Pune"],
  ["EN6282","Pune"],["EN6283","Sangli"],["EN6284","Pune"],
  ["EN6285","Pune"],["EN6288","Kolhapur"],["EN6293","Solapur"],
  ["EN6298","Pune"],["EN6303","Satara"],["EN6304","Sangli"],
  ["EN6305","Satara"],["EN6307","Pune"],["EN6308","Solapur"],
  ["EN6310","Pune"],["EN6311","Pune"],["EN6313","Sangli"],
  ["EN6315","Kolhapur"],["EN6317","Kolhapur"],["EN6318","Satara"],
  ["EN6319","Pune"],["EN6320","Pune"],["EN6321","Solapur"],
  ["EN6322","Pune"],["EN6324","Pune"],["EN6325","Pune"],
  ["EN6326","Solapur"],["EN6402","Kolhapur"],["EN6444","Solapur"],
  ["EN6466","Satara"],["EN6468","Kolhapur"],["EN6545","Satara"],
  ["EN6609","Pune"],["EN6622","Pune"],["EN6625","Pune"],
  ["EN6628","Pune"],["EN6632","Pune"],["EN6634","Pune"],
  ["EN6635","Pune"],["EN6640","Solapur"],["EN6643","Solapur"],
  ["EN6644","Sangli"],["EN6649","Pune"],["EN6732","Pune"],
  ["EN6754","Pune"],["EN6755","Pune"],["EN6756","Solapur"],
  ["EN6757","Satara"],["EN6758","Pune"],["EN6759","Pune"],
  ["EN6762","Sangli"],["EN6766","Satara"],["EN6767","Pune"],
  ["EN6768","Pune"],["EN6769","Pune"],["EN6770","Pune"],
  ["EN6771","Pune"],["EN6772","Pune"],["EN6780","Kolhapur"],
  ["EN6781","Solapur"],["EN6782","Solapur"],["EN6794","Pune"],
  ["EN6796","Pune"],["EN6797","Satara"],["EN6799","Sangli"],
  ["EN6803","Kolhapur"],["EN6808","Pune"],["EN6811","Kolhapur"],
  ["EN6815","Pune"],["EN6822","Pune"],["EN6834","Pune"],
  ["EN6839","Kolhapur"],["EN6878","Kolhapur"],["EN6901","Solapur"],
  ["EN6938","Solapur"],["EN6991","Pune"],
];

// Build district map: capCode → district
const fraDistrictMap = new Map();
for (const [instId, district] of FRA_DISTRICTS) {
  const digits = instId.replace(/^EN/, "");
  const capCode = digits.padStart(5, "0");
  fraDistrictMap.set(capCode, district);
}

// ── District inference from college name ──────────────────────────────────
// For govt colleges not in FRA portal, city names appear at end of college name.
// Manual overrides for colleges not matchable by name pattern
const MANUAL_DISTRICT = {
  "02008": "Chhatrapati Sambhaji Nagar", // GCE Chhatrapati Sambhajinagar (spelling variant)
  "03014": "Mumbai-Suburban",             // SPCE Andheri
  "03033": "Raigad",                      // DBATU Lonere
  "03436": "Thane",                       // BRH College Ambernath
  "03439": "Raigad",                      // Kalsekar Tech Campus
  "03724": "Mumbai-Suburban",             // Thakur Shree DPS
  "03726": "Mumbai-Suburban",             // Imperial College of Engineering
  "04026": "Nagpur",                      // University Institute of Technology (RTM)
  "04104": "Nagpur",                      // Kavi Kulguru Institute Ramtek
  "04118": "Wardha",                      // Bapurao Deshmukh College Sevagram
  "04762": "Chandrapur",                  // Mata Mahakali CoE Warora
  "04766": "Nagpur",                      // Arun Motghare CoE
  "06004": "Pune",                        // GCE Avasari Khurd
  "06005": "Satara",                      // GCE Karad
  "06028": "Kolhapur",                    // Shivaji University School of Engg
  "06795": "Pune",                        // Someshwar Nagar is Pune district
  "16006": "Pune",                        // COEP Technological University
  "16351": "Pune",                        // Vidya Niketan, Lakhewadi
  "16352": "Pune",                        // Yashoda Mahadeo Kakade, Talegaon
  "16355": "Pune",                        // ASM Nextgen Technical Campus
  "16357": "Pune",                        // MES Mukunddas Lohia CoE
  "16371": "Pune",                        // Nirmalatai Pingle Institute
  "16372": "Pune",                        // Sawkar Women's Institute
  "16373": "Pune",                        // SJVPM CoE
  // Colleges with no recognisable city in name; district from code prefix + manual lookup
  "01268": "Buldhana",   // Siddhivinayak TC, Shirasgon, Nile (Buldhana taluka)
  "01347": "Amravati",   // DR. D. B. DOD College (01xxx = Amravati division)
  "02634": "Jalna",      // Eaglewood Polytechnic, A.P Phulepimpalgaon (Jalna)
  "02758": "Chhatrapati Sambhaji Nagar", // Sant Eknath CoE (02xxx Marathwada)
  "02770": "Beed",       // Mahesh Institute, Ashti (Ashti is in Beed district)
  "02771": "Beed",       // Amolak CoE, Kada (Kada is in Beed district)
  "02777": "Nanded",     // CDS CoE (02xxx Marathwada)
  "02779": "Hingoli",    // NKSPT Institute, Pathrikar Campus (Hingoli)
  "02805": "Hingoli",    // Urvara Pathrikar CoE (Hingoli)
  "05223": "Jalgaon",    // Chopda is in Jalgaon
  "05239": "Nandurbar",  // JAMIA Institute of Technology (Nandurbar)
  "05395": "Nashik",     // Ashok Institute of Engineering (05xxx N. Maharashtra)
  "05509": "Ahilyanagar",// Malwadi-Bota (Bota, Ahmednagar dist)
  "05597": "Nashik",     // Vamanrao Ithape CoE (05xxx N. Maharashtra)
  "05682": "Nashik",     // Sai College of Engineering (05xxx)
  "05683": "Nashik",     // Saptashrungi CoE (Saptashrungi is near Nashik)
  "05686": "Nashik",     // Loknete Suhas Kande CoE (05xxx)
  "05688": "Ahilyanagar",// MES Institute Sonai (Sonai, Ahmednagar)
};

const CITY_DISTRICT = [
  [/\bAmravati\b/i, "Amravati"],
  [/\bAkola\b/i, "Akola"],
  [/\bYavatmal\b/i, "Yavatmal"],
  [/\bBuldhana?\b/i, "Buldhana"],
  [/\bWashim\b/i, "Washim"],
  [/\bNagpur\b/i, "Nagpur"],
  [/\bWardha\b/i, "Wardha"],
  [/\bChandrapur\b/i, "Chandrapur"],
  [/\bBhandara\b/i, "Bhandara"],
  [/\bGondia\b/i, "Gondia"],
  [/\bGadchiroli\b/i, "Gadchiroli"],
  [/Sambhajinagar|Sambhaji Nagar|Aurangabad/i, "Chhatrapati Sambhaji Nagar"],
  [/\bNanded\b/i, "Nanded"],
  [/\bLatur\b/i, "Latur"],
  [/\bOsmanabad\b/i, "Dharashiv"],
  [/\bDharashiv\b/i, "Dharashiv"],
  [/\bBeed\b/i, "Beed"],
  [/\bJalna\b/i, "Jalna"],
  [/\bHingoli\b/i, "Hingoli"],
  [/\bParbhani\b/i, "Parbhani"],
  [/Bandra|Byculla|Sion\b|Wadala\b|Vile Parle\b|Andheri\b|Borivali\b|Malad\b|Kandivali\b/i, "Mumbai-City"],
  [/\bMumbai\b/i, "Mumbai-Suburban"],
  [/Navi Mumbai|Kopar Khairane|Nerul\b|Vashi\b|Airoli\b|Belapur\b|New Panvel\b|Kharghar\b/i, "Thane"],
  [/\bThane\b/i, "Thane"],
  [/\bPalghar\b|Vasai\b|Boisar\b|\bShahapur\b/i, "Palghar"],
  [/\bRaigad\b|Panvel\b|Karjat\b|Rasayani\b|Lonere\b/i, "Raigad"],
  [/\bRatnagiri\b/i, "Ratnagiri"],
  [/\bSindhudurg\b/i, "Sindhudurg"],
  [/\bNashik\b/i, "Nashik"],
  [/\bDhule\b/i, "Dhule"],
  [/\bJalgaon\b/i, "Jalgaon"],
  [/Ahmednagar|Kopargaon\b|Sangamner\b|Sonai\b|Shrigonda\b/i, "Ahilyanagar"],
  [/\bNandurbar\b/i, "Nandurbar"],
  [/\bKolhapur\b/i, "Kolhapur"],
  [/Sangli\b|Ichalkaranji\b|Walva\b|Jaysingpur\b|Miraj\b/i, "Sangli"],
  [/\bSatara\b|Karad\b/i, "Satara"],
  [/\bSolapur\b|Pandharpur\b/i, "Solapur"],
  [/\bPune\b/i, "Pune"],
];

function inferDistrict(name) {
  for (const [re, district] of CITY_DISTRICT) {
    if (re.test(name)) return district;
  }
  return null;
}

// ── College type from status ───────────────────────────────────────────────
function deriveType(status) {
  if (!status) return null;
  if (status.includes("Deemed University")) return "Deemed University";
  if (status.startsWith("University")) return "Government";
  if (status.includes("Government-Aided")) return "Government-Aided";
  if (status.includes("Government")) return "Government";
  if (status.includes("Un-Aided")) return "Unaided";
  return null;
}

// ── Build college-meta.json ────────────────────────────────────────────────
const meta = {};
let fraCount = 0, inferredCount = 0, missingDistrict = 0;

for (const inst of institutes) {
  const fraDistrict = fraDistrictMap.get(inst.code);
  const district = fraDistrict ?? MANUAL_DISTRICT[inst.code] ?? inferDistrict(inst.name);
  const collegeType = deriveType(inst.status);

  if (fraDistrict) fraCount++;
  else if (district) inferredCount++;
  else missingDistrict++;

  meta[inst.code] = { district, collegeType };
}

const outPath = join(root, "packages/pipeline/data/college-meta-2026.json");
writeFileSync(outPath, JSON.stringify(meta, null, 2) + "\n");

console.log(`Written ${Object.keys(meta).length} entries to college-meta.json`);
console.log(`  District from FRA portal: ${fraCount}`);
console.log(`  District inferred from name: ${inferredCount}`);
console.log(`  District missing: ${missingDistrict}`);

// Show missing ones
const missing = institutes.filter(i => !meta[i.code]?.district);
if (missing.length) {
  console.log("\nMissing district:");
  missing.forEach(i => console.log(`  ${i.code}  ${i.name}`));
}
