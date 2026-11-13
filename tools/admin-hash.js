// Tar fram ett nytt adminlösenord och hashen som ska in i Heroku (config var ADMIN_HASH).
//   node tools/admin-hash.js              – slumpar ett starkt lösenord
//   node tools/admin-hash.js "lösenord"   – hashar ett eget lösenord
// Skriv aldrig lösenordet eller hashen i repot. Se admin-server.js.
const crypto = require("crypto");
const pass = process.argv[2] || crypto.randomBytes(18).toString("base64url");
const salt = crypto.randomBytes(16), N = 16384, r = 8, p = 1;
const hash = crypto.scryptSync(pass, salt, 64, { N, r, p });
console.log("Lösenord:   " + pass);
console.log("ADMIN_HASH: " + ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$"));
