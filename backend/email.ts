import nodemailer from "nodemailer";
import crypto from "node:crypto";

const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";
const EMAIL_NAME = process.env.EMAIL_NAME || "Krinyx Music";
const mailer = nodemailer.createTransport({ service: "gmail", auth: { user: EMAIL_USER, pass: EMAIL_PASS } });

export function emailConfigured() { return Boolean(EMAIL_USER && EMAIL_PASS); }
export function hashEmailToken(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function makeEmailToken() { return crypto.randomBytes(32).toString("hex"); }
export async function sendVerificationEmail(to: string, name: string, url: string) {
  if (!emailConfigured()) { console.warn("[EMAIL] EMAIL_USER / EMAIL_PASS manquants : email non envoyé."); return false; }
  const safeName = name.replace(/[<>]/g, "");
  await mailer.sendMail({ from: `"${EMAIL_NAME}" <${EMAIL_USER}>`, to, subject: "Vérifiez votre adresse email — Krinyx Music", html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f7f4;font-family:Arial,sans-serif;color:#17251c"><div style="max-width:460px;margin:auto;background:#fff;border:1px solid #dfe8df;border-radius:16px;padding:28px"><div style="font-size:18px;font-weight:800;letter-spacing:2px">KRINYX MUSIC</div><h2 style="margin:28px 0 10px">Confirmez votre adresse</h2><p>Bonjour ${safeName}, cliquez sur le bouton pour activer votre compte Krinyx.</p><p><a href="${url}" style="display:inline-block;margin-top:14px;background:#173d2a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Vérifier mon email</a></p><p style="color:#758177;font-size:12px">Ce lien expire dans 24 heures.</p></div></body></html>` });
  return true;
}
