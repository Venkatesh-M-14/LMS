# Tier 0 deployment — $0/month

The fully-free stack. Every piece has a genuinely free tier; the price you pay
is doing the server setup yourself (~half a day the first time).

```
Browser ──▶ Vercel (frontend, free) ──proxy /api + /socket.io──▶ Your Oracle VM
                                                                 ├─ Caddy (HTTPS)
                                                                 ├─ API container
                                                                 └─ Redis container
                                                                       │
                                                       Neon Postgres (free, managed)
```

Everything referenced here is already in the repo and the API image has been
built and smoke-tested on ARM (the same architecture as Oracle's free VMs):
[apps/api/Dockerfile](../apps/api/Dockerfile),
[docker-compose.prod.yml](../docker-compose.prod.yml),
[Caddyfile](../Caddyfile),
[.env.production.example](../.env.production.example),
[apps/web/vercel.json](../apps/web/vercel.json).

---

## Step 1 — Database: Neon (10 minutes)

1. Sign up at **neon.tech** (free, no card). Create a project, e.g. `academy`.
2. Copy the **connection string** (Dashboard → Connect). It looks like
   `postgresql://USER:PASS@ep-xxxx.aws.neon.tech/neondb?sslmode=require`.
   Keep it for Step 4.

Why Neon over Supabase for this: Neon's free database auto-wakes on the next
connection; Supabase free projects pause after 1 idle week and need a manual
dashboard click to restore.

## Step 2 — Server: Oracle Cloud Always Free VM (30–60 minutes)

1. Sign up at **oracle.com/cloud/free** (card required for identity check;
   nothing is charged on Always Free resources).
2. Create a VM: **Compute → Instances → Create**.
   - Image: **Ubuntu 24.04**
   - Shape: **Ampere · VM.Standard.A1.Flex** — give it **2 OCPUs / 12 GB RAM**
     (well inside the 4 OCPU / 24 GB free allowance)
   - Add your SSH public key. Create.
3. Open the firewall for web traffic: the instance's **Virtual Cloud Network →
   Security List → Add Ingress Rules** — allow TCP **80** and **443** from
   `0.0.0.0/0`.
4. SSH in and install Docker:

   ```sh
   ssh ubuntu@<VM_PUBLIC_IP>
   sudo apt-get update && sudo apt-get install -y ca-certificates curl git
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu && exit   # re-SSH so the group applies
   # Ubuntu images also ship iptables rules — open the ports at OS level too:
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save 2>/dev/null || true
   ```

> **Idle reclamation:** Oracle may reclaim *idle* Always Free instances.
> Upgrading the account to Pay-As-You-Go (Billing → Upgrade) removes that
> policy while still costing $0 as long as you stay on Always Free shapes.

## Step 3 — Free domain: DuckDNS (5 minutes)

Caddy needs a domain to issue free HTTPS certificates.

1. Sign in at **duckdns.org** (GitHub/Google login). Add a subdomain, e.g.
   `academy-yourname` → gives you `academy-yourname.duckdns.org`.
2. Set its IP to your VM's public IP.

(If you later buy a real domain (~$10/yr), just point an A record at the VM
and change `SITE_DOMAIN` — nothing else changes.)

## Step 4 — Deploy the API (15 minutes)

On the VM:

```sh
git clone https://github.com/Venkatesh-M-14/LMS.git academy && cd academy
cp .env.production.example .env.production
nano .env.production
```

Fill in (see comments in the file):
- `SITE_DOMAIN` — your DuckDNS domain
- `API_ORIGIN` — `https://<that domain>`
- `WEB_ORIGIN` — your Vercel URL (finish Step 5 first if you want it exact;
  you can update and `docker compose ... up -d` again later)
- `DATABASE_URL` — the Neon string from Step 1
- `JWT_ACCESS_SECRET` — `openssl rand -hex 32`
- `SEED_PASSWORD` — a strong password for the admin/instructor accounts

Then:

```sh
docker compose -f docker-compose.prod.yml up -d --build   # ~5 min first time
docker compose -f docker-compose.prod.yml exec api pnpm db:seed   # once
docker compose -f docker-compose.prod.yml logs -f api     # watch it boot
```

Check: `https://<your-domain>/health` in a browser → `{"data":{"status":"ok",...}}`.

## Step 5 — Frontend: Vercel (10 minutes)

1. Edit [apps/web/vercel.json](../apps/web/vercel.json): replace both
   `YOUR-API-DOMAIN` placeholders with your DuckDNS domain. Commit + push.
2. At **vercel.com** → Add New → Project → import the GitHub repo.
   - **Root Directory:** `apps/web` (enable "Include files outside root")
   - Everything else is read from `vercel.json`. Deploy.
3. Put the resulting URL (e.g. `https://lms-xyz.vercel.app`) into
   `WEB_ORIGIN` in `.env.production` on the VM, then
   `docker compose -f docker-compose.prod.yml up -d`.

From now on **every push to `main` auto-deploys the frontend**. For the API,
deploys are:

```sh
cd ~/academy && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

## Step 6 — Optional add-ons

**Email (Brevo, free 300/day):** sign up at brevo.com → SMTP & API → copy the
SMTP settings into the `SMTP_*` vars in `.env.production`. Without it, the app
simply skips emails (in-app notifications still work).

**AI Mentor (pay-per-use):** create a key at console.anthropic.com, set
`ANTHROPIC_API_KEY` + `MENTOR_PROVIDER=anthropic`. The per-user daily token cap
(`MENTOR_DAILY_TOKEN_BUDGET`) bounds the spend. Without a key the mentor shows
a friendly "not configured" message.

## Step 7 — Launch checklist

```sh
# On the VM, inside ~/academy:
alias prod='docker compose -f docker-compose.prod.yml'

# 1. Wipe any test data (keeps curriculum + admin/instructor accounts):
prod exec api pnpm reset:community

# 2. If you seeded before setting SEED_PASSWORD, set real passwords now:
prod exec api pnpm set:password admin@academy.local 'Your-Strong-Passw0rd'
prod exec api pnpm set:password instructor@academy.local 'Another-Passw0rd'

# 3. Open your Vercel URL, register your own account, say hi in Circle chat 🎉
```

## Day-2 operations

| Task | Command (on the VM) |
|---|---|
| Deploy an update | `git pull && prod up -d --build` |
| View logs | `prod logs -f api` |
| Restart | `prod restart api` |
| DB backup | Neon does daily backups on free tier; for extra safety: `prod exec api sh -c 'apt-get install -y postgresql-client >/dev/null; pg_dump "$DATABASE_URL"' > backup.sql` |
| Reset community data | `prod exec api pnpm reset:community` |
| Change a password | `prod exec api pnpm set:password <email> '<pw>'` |

**Known trade-offs of Tier 0** (all fine for a small circle): you patch the VM
(`sudo apt-get upgrade` now and then); Neon free autosuspends after inactivity
(first request after a quiet period takes ~1s extra while it wakes); WebSockets
fall back to polling through the Vercel proxy (chat still real-time). If any of
this becomes annoying, the same repo deploys to Railway unchanged — that's
Tier 1.
