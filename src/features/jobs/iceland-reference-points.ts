// Reference points for describing a pinned job to a driver before assignment,
// without revealing the exact spot. Names are in the nominative case so they
// can be printed without declension.

export interface ReferencePoint {
  name: string;
  latitude: number;
  longitude: number;
}

export interface LandmarkPoint extends ReferencePoint {
  highland: boolean;
}

// Cities, towns and villages from the imported place names (`iceland_places`
// categories city/town/village), with duplicate municipality entries removed.
export const SETTLEMENTS: readonly ReferencePoint[] = [
  { name: "Akureyri", latitude: 65.6826, longitude: -18.0913 },
  { name: "Reykjavík", latitude: 64.146, longitude: -21.9422 },
  { name: "Akranes", latitude: 64.3171, longitude: -22.0834 },
  { name: "Blönduós", latitude: 65.6601, longitude: -20.281 },
  { name: "Bolungarvík", latitude: 66.1576, longitude: -23.2507 },
  { name: "Borgarnes", latitude: 64.5383, longitude: -21.9202 },
  { name: "Dalvík", latitude: 65.9711, longitude: -18.5304 },
  { name: "Egilsstaðir", latitude: 65.262, longitude: -14.4035 },
  { name: "Eskifjörður", latitude: 65.0713, longitude: -14.0124 },
  { name: "Fáskrúðsfjörður", latitude: 64.93, longitude: -14.0084 },
  { name: "Garðabær", latitude: 64.088, longitude: -21.9194 },
  { name: "Garður", latitude: 64.0704, longitude: -22.6512 },
  { name: "Grindavík", latitude: 63.8442, longitude: -22.4317 },
  { name: "Grundarfjörður", latitude: 64.925, longitude: -23.2593 },
  { name: "Hafnarfjörður", latitude: 64.0695, longitude: -21.9576 },
  { name: "Hella", latitude: 63.8355, longitude: -20.3987 },
  { name: "Höfn", latitude: 64.2533, longitude: -15.208 },
  { name: "Húsavík", latitude: 66.0433, longitude: -17.341 },
  { name: "Hveragerði", latitude: 63.9976, longitude: -21.1868 },
  { name: "Hvolsvöllur", latitude: 63.7508, longitude: -20.2238 },
  { name: "Ísafjörður", latitude: 66.0727, longitude: -23.1194 },
  { name: "Keflavík", latitude: 63.9998, longitude: -22.5565 },
  { name: "Kópavogur", latitude: 64.1114, longitude: -21.9048 },
  { name: "Laugar", latitude: 65.7189, longitude: -17.3608 },
  { name: "Mosfellsbær", latitude: 64.1675, longitude: -21.6971 },
  { name: "Neskaupstaður", latitude: 65.1487, longitude: -13.6889 },
  { name: "Njarðvík", latitude: 63.9733, longitude: -22.5427 },
  { name: "Ólafsfjörður", latitude: 66.072, longitude: -18.648 },
  { name: "Ólafsvík", latitude: 64.8959, longitude: -23.7084 },
  { name: "Patreksfjörður", latitude: 65.5973, longitude: -24.0009 },
  { name: "Reyðarfjörður", latitude: 65.0341, longitude: -14.2085 },
  { name: "Sandgerði", latitude: 64.0388, longitude: -22.7059 },
  { name: "Sauðárkrókur", latitude: 65.7443, longitude: -19.6386 },
  { name: "Selfoss", latitude: 63.9368, longitude: -21.0035 },
  { name: "Seltjarnarnes", latitude: 64.1527, longitude: -21.988 },
  { name: "Seyðisfjörður", latitude: 65.2598, longitude: -14.0049 },
  { name: "Siglufjörður", latitude: 66.1505, longitude: -18.9096 },
  { name: "Stykkishólmur", latitude: 65.0743, longitude: -22.7303 },
  { name: "Vestmannaeyjar", latitude: 63.4401, longitude: -20.2786 },
  { name: "Vogar", latitude: 63.9832, longitude: -22.3874 },
  { name: "Vopnafjörður", latitude: 65.7541, longitude: -14.8295 },
  { name: "Þorlákshöfn", latitude: 63.8562, longitude: -21.3866 },
  { name: "Álftanes", latitude: 64.1056, longitude: -22.0202 },
  { name: "Bifröst", latitude: 64.7666, longitude: -21.5526 },
  { name: "Bíldudalur", latitude: 65.6859, longitude: -23.5989 },
  { name: "Borg í Grímsnesi", latitude: 64.0752, longitude: -20.7657 },
  { name: "Breiðdalsvík", latitude: 64.7929, longitude: -14.0064 },
  { name: "Búðardalur", latitude: 65.1098, longitude: -21.7668 },
  { name: "Djúpivogur", latitude: 64.6558, longitude: -14.2821 },
  { name: "Eyrarbakki", latitude: 63.863, longitude: -21.1481 },
  { name: "Fellabær", latitude: 65.2823, longitude: -14.4245 },
  { name: "Flateyri", latitude: 66.0488, longitude: -23.513 },
  { name: "Flúðir", latitude: 64.1306, longitude: -20.3209 },
  { name: "Grenivík", latitude: 65.9475, longitude: -18.1801 },
  { name: "Grundarhverfi", latitude: 64.2402, longitude: -21.8322 },
  { name: "Hellissandur", latitude: 64.9172, longitude: -23.8825 },
  { name: "Hnífsdalur", latitude: 66.1097, longitude: -23.1202 },
  { name: "Hofsós", latitude: 65.8975, longitude: -19.411 },
  { name: "Hólmavík", latitude: 65.7065, longitude: -21.6692 },
  { name: "Hrafnagil", latitude: 65.5735, longitude: -18.0945 },
  { name: "Hrísey", latitude: 65.9797, longitude: -18.3772 },
  { name: "Hvammstangi", latitude: 65.397, longitude: -20.944 },
  { name: "Hvanneyri", latitude: 64.5633, longitude: -21.7665 },
  { name: "Kirkjubæjarklaustur", latitude: 63.7931, longitude: -18.0419 },
  { name: "Kópasker", latitude: 66.3009, longitude: -16.4466 },
  { name: "Laugarvatn", latitude: 64.2172, longitude: -20.7334 },
  { name: "Raufarhöfn", latitude: 66.453, longitude: -15.9509 },
  { name: "Reykhólar", latitude: 65.4486, longitude: -22.2015 },
  { name: "Reykholt", latitude: 64.1783, longitude: -20.4461 },
  { name: "Reykjahlíð", latitude: 65.6416, longitude: -16.91 },
  { name: "Rif", latitude: 64.9219, longitude: -23.8223 },
  { name: "Skagaströnd", latitude: 65.8233, longitude: -20.3006 },
  { name: "Stöðvarfjörður", latitude: 64.8338, longitude: -13.8737 },
  { name: "Stokkseyri", latitude: 63.837, longitude: -21.0612 },
  { name: "Suðureyri", latitude: 66.1296, longitude: -23.5268 },
  { name: "Svalbarðseyri", latitude: 65.7459, longitude: -18.083 },
  { name: "Tálknafjörður", latitude: 65.6274, longitude: -23.8249 },
  { name: "Varmahlíð", latitude: 65.5532, longitude: -19.4475 },
  { name: "Vík", latitude: 63.4188, longitude: -19.0055 },
  { name: "Þingeyri", latitude: 65.8791, longitude: -23.4924 },
  { name: "Þórshöfn", latitude: 66.1981, longitude: -15.3359 },
];

// Places drivers know in the highlands and in remote lowland areas. Points
// without "imported" are approximate hut or site coordinates added by hand and
// should be confirmed by someone who knows the drivers' vocabulary.
export const LANDMARKS: readonly LandmarkPoint[] = [
  // Highlands — imported coordinates
  { name: "Landmannalaugar", latitude: 63.9905, longitude: -19.0605, highland: true }, // imported
  { name: "Kerlingarfjöll", latitude: 64.6841, longitude: -19.3017, highland: true }, // imported (Ásgarður)
  { name: "Veiðivötn", latitude: 64.12, longitude: -18.7876, highland: true }, // imported
  { name: "Eldgjá", latitude: 63.9644, longitude: -18.6122, highland: true }, // imported
  { name: "Jökulheimar", latitude: 64.3103, longitude: -18.2385, highland: true }, // imported
  { name: "Þórsmörk", latitude: 63.6852, longitude: -19.5145, highland: true }, // imported (Langidalur)
  { name: "Emstrur", latitude: 63.7662, longitude: -19.3733, highland: true }, // imported (Botnar)
  { name: "Kaldidalur", latitude: 64.5759, longitude: -20.807, highland: true }, // imported
  // Highlands — review
  { name: "Hveravellir", latitude: 64.867, longitude: -19.555, highland: true },
  { name: "Hrauneyjar", latitude: 64.197, longitude: -19.279, highland: true },
  { name: "Nýidalur", latitude: 64.736, longitude: -18.073, highland: true },
  { name: "Askja", latitude: 65.042, longitude: -16.598, highland: true },
  { name: "Herðubreiðarlindir", latitude: 65.192, longitude: -16.223, highland: true },
  { name: "Kverkfjöll", latitude: 64.748, longitude: -16.628, highland: true },
  { name: "Laki", latitude: 64.067, longitude: -18.233, highland: true },
  { name: "Laugafell", latitude: 65.027, longitude: -18.332, highland: true },
  { name: "Hvítárnes", latitude: 64.617, longitude: -19.75, highland: true },
  { name: "Hrafntinnusker", latitude: 63.933, longitude: -19.168, highland: true },
  { name: "Álftavatn", latitude: 63.857, longitude: -19.227, highland: true },
  { name: "Snæfell", latitude: 64.797, longitude: -15.563, highland: true },
  { name: "Kárahnjúkar", latitude: 64.93, longitude: -15.78, highland: true },
  // Remote lowland reference points
  { name: "Skaftafell", latitude: 64.0165, longitude: -16.9665, highland: false }, // imported
  { name: "Möðrudalur", latitude: 65.3746, longitude: -15.882, highland: false }, // imported
  { name: "Jökulsárlón", latitude: 64.048, longitude: -16.18, highland: false },
  { name: "Skógar", latitude: 63.527, longitude: -19.511, highland: false },
  { name: "Húsafell", latitude: 64.699, longitude: -20.869, highland: false },
  { name: "Geysir", latitude: 64.31, longitude: -20.302, highland: false },
  { name: "Gullfoss", latitude: 64.327, longitude: -20.121, highland: false },
  { name: "Þingvellir", latitude: 64.256, longitude: -21.13, highland: false },
  { name: "Dettifoss", latitude: 65.815, longitude: -16.385, highland: false },
  { name: "Ásbyrgi", latitude: 66.02, longitude: -16.5, highland: false },
  { name: "Landeyjahöfn", latitude: 63.53, longitude: -20.12, highland: false },
];

export interface DistrictPoint extends ReferencePoint {
  town: string;
}

// City districts from the imported place names (category suburb). District
// names repeat between towns, so each carries its town explicitly.
export const DISTRICTS: readonly DistrictPoint[] = [
  { town: "Reykjavík", name: "Kjalarnes", latitude: 64.2422, longitude: -21.8315 },
  { town: "Reykjavík", name: "Grafarvogur", latitude: 64.1483, longitude: -21.792 },
  { town: "Reykjavík", name: "Vesturbær", latitude: 64.1444, longitude: -21.958 },
  { town: "Reykjavík", name: "Laugardalur", latitude: 64.142, longitude: -21.8715 },
  { town: "Reykjavík", name: "Miðborg", latitude: 64.1364, longitude: -21.9376 },
  { town: "Reykjavík", name: "Hlíðar", latitude: 64.1316, longitude: -21.9104 },
  { town: "Reykjavík", name: "Grafarholt og Úlfarsárdalur", latitude: 64.1259, longitude: -21.7356 },
  { town: "Reykjavík", name: "Háaleiti og Bústaðir", latitude: 64.1241, longitude: -21.8722 },
  { town: "Reykjavík", name: "Árbær", latitude: 64.1144, longitude: -21.7952 },
  { town: "Reykjavík", name: "Breiðholt", latitude: 64.1028, longitude: -21.8309 },
  { town: "Mosfellsbær", name: "Leirvogstunga", latitude: 64.1822, longitude: -21.6874 },
  { town: "Mosfellsbær", name: "Mosfellsdalur", latitude: 64.1803, longitude: -21.6189 },
  { town: "Kópavogur", name: "Kársnes", latitude: 64.1105, longitude: -21.9221 },
  { town: "Kópavogur", name: "Digranes", latitude: 64.1112, longitude: -21.8781 },
  { town: "Kópavogur", name: "Smárar", latitude: 64.1017, longitude: -21.884 },
  { town: "Kópavogur", name: "Fífuhvammur", latitude: 64.0958, longitude: -21.863 },
  { town: "Kópavogur", name: "Vatnsendi", latitude: 64.082, longitude: -21.8197 },
  { town: "Garðabær", name: "Urriðaholt", latitude: 64.07, longitude: -21.9027 },
  { town: "Hafnarfjörður", name: "Norðurbær", latitude: 64.078, longitude: -21.9606 },
  { town: "Hafnarfjörður", name: "Vesturbær", latitude: 64.0726, longitude: -21.9593 },
  { town: "Hafnarfjörður", name: "Hraun", latitude: 64.0712, longitude: -21.947 },
  { town: "Hafnarfjörður", name: "Miðbær", latitude: 64.0674, longitude: -21.9558 },
  { town: "Hafnarfjörður", name: "Setberg", latitude: 64.066, longitude: -21.9315 },
  { town: "Hafnarfjörður", name: "Suðurbær", latitude: 64.062, longitude: -21.9521 },
  { town: "Hafnarfjörður", name: "Holt", latitude: 64.0574, longitude: -21.979 },
  { town: "Hafnarfjörður", name: "Ásland", latitude: 64.0548, longitude: -21.9463 },
  { town: "Hafnarfjörður", name: "Vellir", latitude: 64.0475, longitude: -21.9748 },
  { town: "Hafnarfjörður", name: "Skarðshlíð", latitude: 64.0452, longitude: -21.9568 },
  { town: "Hafnarfjörður", name: "Hellur", latitude: 64.041, longitude: -22.0024 },
  { town: "Reykjanesbær", name: "Ytri-Njarðvík", latitude: 63.9887, longitude: -22.5505 },
  { town: "Reykjanesbær", name: "Innri-Njarðvík", latitude: 63.9733, longitude: -22.5087 },
  { town: "Reykjanesbær", name: "Ásbrú", latitude: 63.9716, longitude: -22.5734 },
  { town: "Akureyri", name: "Holtahverfi", latitude: 65.694, longitude: -18.1106 },
  { town: "Akureyri", name: "Síðuhverfi", latitude: 65.6938, longitude: -18.1382 },
  { town: "Akureyri", name: "Hlíðarhverfi", latitude: 65.6908, longitude: -18.1167 },
  { town: "Akureyri", name: "Oddeyri", latitude: 65.6869, longitude: -18.0892 },
  { town: "Akureyri", name: "Giljahverfi", latitude: 65.6849, longitude: -18.1369 },
  { town: "Akureyri", name: "Norðurbrekkan", latitude: 65.6828, longitude: -18.102 },
  { town: "Akureyri", name: "Gerðahverfi", latitude: 65.6805, longitude: -18.1173 },
  { town: "Akureyri", name: "Suðurbrekkan", latitude: 65.676, longitude: -18.1021 },
  { town: "Akureyri", name: "Lundarhverfi", latitude: 65.6744, longitude: -18.1157 },
  { town: "Akureyri", name: "Teigahverfi", latitude: 65.6706, longitude: -18.1012 },
  { town: "Akureyri", name: "Innbærinn", latitude: 65.6705, longitude: -18.0874 },
  { town: "Akureyri", name: "Naustahverfi", latitude: 65.6633, longitude: -18.0985 },
];
