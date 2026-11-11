// Städer och mittpunktsberäkning för onlinespel.

/* ---------- Städer (alla på land, så gubben alltid bor på land) ---------- */
// [namn, landskod, världsdel, latitud, longitud]
const CITIES = [
["Stockholm","SE","eu",59.33,18.07],["Göteborg","SE","eu",57.71,11.97],["Malmö","SE","eu",55.6,13],["Uppsala","SE","eu",59.86,17.64],["Umeå","SE","eu",63.83,20.26],["Luleå","SE","eu",65.58,22.15],["Kiruna","SE","eu",67.86,20.23],
["Oslo","NO","eu",59.91,10.75],["Bergen","NO","eu",60.39,5.32],["Skien","NO","eu",59.21,9.61],["Tromsø","NO","eu",69.65,18.96],["København","DK","eu",55.68,12.57],["Aarhus","DK","eu",56.16,10.2],
["Helsinki","FI","eu",60.17,24.94],["Mariehamn","AX","eu",60.1,19.94],["Reykjavík","IS","eu",64.15,-21.94],["Tórshavn","FO","eu",62.01,-6.77],
["London","GB","eu",51.51,-0.13],["Edinburgh","GB","eu",55.95,-3.19],["Dublin","IE","eu",53.35,-6.26],["Paris","FR","eu",48.86,2.35],["Lyon","FR","eu",45.76,4.84],["Marseille","FR","eu",43.3,5.37],
["Madrid","ES","eu",40.42,-3.7],["Barcelona","ES","eu",41.39,2.17],["Sevilla","ES","eu",37.39,-5.98],["Lisboa","PT","eu",38.72,-9.14],["Ponta Delgada","PT","eu",37.74,-25.67],
["Berlin","DE","eu",52.52,13.4],["Hamburg","DE","eu",53.55,9.99],["München","DE","eu",48.14,11.58],["Wien","AT","eu",48.21,16.37],["Zürich","CH","eu",47.38,8.54],["Amsterdam","NL","eu",52.37,4.9],["Bruxelles","BE","eu",50.85,4.35],
["Roma","IT","eu",41.9,12.5],["Milano","IT","eu",45.46,9.19],["Athína","GR","eu",37.98,23.73],["Warszawa","PL","eu",52.23,21.01],["Praha","CZ","eu",50.08,14.44],["Budapest","HU","eu",47.5,19.04],
["Tallinn","EE","eu",59.44,24.75],["Riga","LV","eu",56.95,24.11],["Vilnius","LT","eu",54.69,25.28],["Kyiv","UA","eu",50.45,30.52],["Bucureşti","RO","eu",44.43,26.1],["İstanbul","TR","eu",41.01,28.98],["Moskva","RU","eu",55.76,37.62],
["Kairo","EG","af",30.04,31.24],["Casablanca","MA","af",33.57,-7.59],["Tunis","TN","af",36.81,10.18],["Dakar","SN","af",14.72,-17.47],["Timbuktu","ML","af",16.77,-3.01],["Agadez","NE","af",16.97,7.99],
["Lagos","NG","af",6.52,3.38],["Accra","GH","af",5.6,-0.19],["Khartoum","SD","af",15.5,32.56],["Addis Abeba","ET","af",9.03,38.74],["Nairobi","KE","af",-1.29,36.82],["Kinshasa","CD","af",-4.44,15.27],
["Dar es Salaam","TZ","af",-6.79,39.21],["Windhoek","NA","af",-22.56,17.08],["Johannesburg","ZA","af",-26.2,28.05],["Kapstaden","ZA","af",-33.92,18.42],["Antananarivo","MG","af",-18.88,47.51],
["Tokyo","JP","as",35.68,139.69],["Osaka","JP","as",34.69,135.5],["Seoul","KR","as",37.57,126.98],["Beijing","CN","as",39.9,116.4],["Shanghai","CN","as",31.23,121.47],["Ürümqi","CN","as",43.83,87.62],["Lhasa","CN","as",29.65,91.12],
["Hong Kong","HK","as",22.32,114.17],["Taipei","TW","as",25.03,121.57],["Bangkok","TH","as",13.76,100.5],["Hà Nội","VN","as",21.03,105.85],["Singapore","SG","as",1.35,103.82],["Jakarta","ID","as",-6.21,106.85],["Manila","PH","as",14.6,120.98],
["Delhi","IN","as",28.61,77.21],["Mumbai","IN","as",19.08,72.88],["Bengaluru","IN","as",12.97,77.59],["Kathmandu","NP","as",27.72,85.32],["Dhaka","BD","as",23.81,90.41],["Karachi","PK","as",24.86,67.01],
["Dubai","AE","as",25.2,55.27],["Tehran","IR","as",35.69,51.39],["Riyadh","SA","as",24.71,46.68],["Almaty","KZ","as",43.24,76.89],["Ulaanbaatar","MN","as",47.89,106.91],
["Novosibirsk","RU","as",55.01,82.93],["Irkutsk","RU","as",52.29,104.28],["Jakutsk","RU","as",62.03,129.73],
["New York","US","na",40.71,-74.01],["Boston","US","na",42.36,-71.06],["Chicago","US","na",41.88,-87.63],["Denver","US","na",39.74,-104.99],["Austin","US","na",30.27,-97.74],["Miami","US","na",25.76,-80.19],
["Los Angeles","US","na",34.05,-118.24],["San Francisco","US","na",37.77,-122.42],["Seattle","US","na",47.61,-122.33],["Anchorage","US","na",61.22,-149.9],["Honolulu","US","oc",21.31,-157.86],
["Toronto","CA","na",43.65,-79.38],["Montréal","CA","na",45.5,-73.57],["Vancouver","CA","na",49.28,-123.12],["Winnipeg","CA","na",49.9,-97.14],["Iqaluit","CA","na",63.75,-68.52],["St. John’s","CA","na",47.56,-52.71],
["Nuuk","GL","na",64.18,-51.69],["Hamilton","BM","na",32.29,-64.78],["Ciudad de México","MX","na",19.43,-99.13],["La Habana","CU","na",23.11,-82.37],["Panamá","PA","na",8.98,-79.52],
["São Paulo","BR","sa",-23.55,-46.63],["Rio de Janeiro","BR","sa",-22.91,-43.17],["Brasília","BR","sa",-15.79,-47.88],["Manaus","BR","sa",-3.12,-60.02],["Buenos Aires","AR","sa",-34.6,-58.38],
["Santiago","CL","sa",-33.45,-70.67],["Lima","PE","sa",-12.05,-77.04],["Bogotá","CO","sa",4.71,-74.07],["Quito","EC","sa",-0.18,-78.47],["Puerto Ayora","EC","sa",-0.74,-90.31],["Caracas","VE","sa",10.48,-66.9],["Montevideo","UY","sa",-34.9,-56.16],["La Paz","BO","sa",-16.5,-68.15],
["Sydney","AU","oc",-33.87,151.21],["Melbourne","AU","oc",-37.81,144.96],["Brisbane","AU","oc",-27.47,153.03],["Perth","AU","oc",-31.95,115.86],["Alice Springs","AU","oc",-23.7,133.88],
["Auckland","NZ","oc",-36.85,174.76],["Wellington","NZ","oc",-41.29,174.78],["Suva","FJ","oc",-18.14,178.44],["Nouméa","NC","oc",-22.28,166.46],["Papeete","PF","oc",-17.54,-149.57],["Port Moresby","PG","oc",-9.44,147.18]
];
const CONTS = ["eu","as","af","na","sa","oc"];
const cityKey = c => c[0] + "|" + c[1];
const findCity = k => CITIES.find(c => cityKey(c) === k);
const DEFAULT_CITY = { sv:"Stockholm|SE", en:"London|GB", fr:"Paris|FR", es:"Madrid|ES", de:"Berlin|DE" };
function countryName(cc) {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(cc) || cc; } catch (e) { return cc; }
}
function placeLabel(key) { const c = findCity(key); return c ? `${c[0]}, ${countryName(c[1])}` : ""; }

// Mittpunkt på jordklotet, sedan närmaste stad i listan (alltid på land)
function midpointCity(keys) {
  const list = keys.map(findCity).filter(Boolean);
  if (!list.length) return DEFAULT_CITY[lang];
  let x = 0, y = 0, z = 0;
  for (const c of list) {
    const la = c[3] * Math.PI / 180, lo = c[4] * Math.PI / 180;
    x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la);
  }
  const best = { d: Infinity, c: list[0] };
  for (const c of CITIES) {
    const la = c[3] * Math.PI / 180, lo = c[4] * Math.PI / 180;
    const cx = Math.cos(la) * Math.cos(lo), cy = Math.cos(la) * Math.sin(lo), cz = Math.sin(la);
    const n = Math.hypot(x, y, z) || 1;
    const d = (cx - x / n) ** 2 + (cy - y / n) ** 2 + (cz - z / n) ** 2;
    if (d < best.d) { best.d = d; best.c = c; }
  }
  return cityKey(best.c);
}
function fillCitySelect(sel, value) {
  sel.innerHTML = "";
  for (const ct of CONTS) {
    const g = document.createElement("optgroup"); g.label = t(ct);
    CITIES.filter(c => c[2] === ct).sort((a, b) => a[0].localeCompare(b[0])).forEach(c => {
      const o = document.createElement("option"); o.value = cityKey(c); o.textContent = `${c[0]}, ${countryName(c[1])}`; g.appendChild(o);
    });
    sel.appendChild(g);
  }
  sel.value = value || DEFAULT_CITY[lang];
}
