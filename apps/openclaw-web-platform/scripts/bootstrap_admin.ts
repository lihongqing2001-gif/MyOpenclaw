import fs from "node:fs";
import path from "node:path";
import { authenticator } from "otplib";
import { loadDatabase, saveDatabase, ensureWebPlatformStorage, createId } from "../src/server/store";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run bootstrap-admin -- <email>");
  process.exit(1);
}

ensureWebPlatformStorage();
const db = loadDatabase();
const existing = db.users.find((user) => user.email === email);
const secret = authenticator.generateSecret();
if (existing) {
  existing.role = "super_admin";
  existing.twoFactorEnabled = true;
  existing.twoFactorSecret = secret;
} else {
  db.users.push({
    id: createId("user"),
    email,
    role: "super_admin",
    twoFactorEnabled: true,
    twoFactorSecret: secret,
    createdAt: new Date().toISOString(),
  });
}
saveDatabase(db);
console.log(JSON.stringify({
  email,
  secret,
  otpauth: authenticator.keyuri(email, "Forge Hub", secret),
}, null, 2));
