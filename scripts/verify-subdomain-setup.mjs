#!/usr/bin/env node
/**
 * Verifica DNS e HTTPS de subdomínios de clínica (*.flowmed.app).
 * Uso: node scripts/verify-subdomain-setup.mjs [slug]
 */

import { execSync } from "node:child_process";
import tls from "node:tls";

const slug = process.argv[2] ?? "clinica-saude";
const apex = "flowmed.app";
const subdomain = `${slug}.${apex}`;

function nslookup(host) {
  try {
    return execSync(`nslookup ${host}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    return err.stdout?.toString?.() ?? err.message;
  }
}

function checkTls(host) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: true },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        resolve({ ok: true, validTo: cert.valid_to });
      }
    );
    socket.setTimeout(10000);
    socket.on("error", (err) => resolve({ ok: false, error: err.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS handshake timeout" });
    });
  });
}

async function main() {
  console.log(`\n=== Verificação: ${subdomain} ===\n`);

  const lookup = nslookup(subdomain);
  console.log("DNS:", lookup.trim());
  const dnsOk = /vercel/i.test(lookup);
  console.log(dnsOk ? "✓ DNS aponta para Vercel\n" : "✗ DNS não aponta para Vercel\n");

  const tlsResult = await checkTls(subdomain);
  if (tlsResult.ok) {
    console.log(`✓ TLS OK — válido até ${tlsResult.validTo}\n`);
  } else {
    console.log(`✗ TLS falhou: ${tlsResult.error}\n`);
  }

  try {
    const homeRes = await fetch(`https://${subdomain}`);
    console.log(`Home: ${homeRes.status} ${homeRes.statusText}`);
    const bookRes = await fetch(`https://${subdomain}/agendar`);
    console.log(`Agendar: ${bookRes.status} ${bookRes.statusText}`);
    if (homeRes.ok && bookRes.ok) {
      console.log("✓ Subdomínio e agendamento respondem\n");
    }
  } catch (err) {
    console.log(`✗ Fetch falhou: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (!dnsOk || !tlsResult.ok) process.exitCode = 1;
}

main();
