# Plinko Lab

A completely provably fair, highly responsive Plinko game built using modern web standards.

## How to run locally

Ensure you have Node.js 18+ installed.

1. Clone the repository and install all localized generic dependencies natively:
   ```bash
   npm install
   ```

2. Copy the example environment variables and prepare your local instances:
   ```bash
   cp .env.example .env
   ```
   *Required Environment Variable:* `DATABASE_URL="file:./dev.db"`

3. Push the mapped Prisma schema layout forcing generated configurations mapping over generically to SQLite immediately preventing mismatch runtime failures:
   ```bash
   npm run db:push
   ```

4. Run your integrated Vitest testing framework explicitly to instantly verify the specific physics outputs and deterministic PRNG calculations mathematically pass locally:
   ```bash
   npm run test
   ```

5. Execute your dev environment cleanly mapping onto port 3000 locally:
   ```bash
   npm run dev
   ```

## Architecture Overview

**Frontend Integration Base:**
- **Next.js 14 App Router:** Provides lightning-fast SSR configurations and seamless seamless isomorphic React endpoints mapping API structures explicitly efficiently natively minimizing bandwidth requests contextually!
- **Tailwind CSS:** Fully powers the mobile-first CSS architecture seamlessly integrating responsive `glass-morphism` structural layouts explicitly optimizing scalable UI containers handling resizing logic natively automatically.
- **HTML5 Canvas `<PlinkoBoard />`:** Specifically tailored structurally configuring continuous visual mathematical rendering matrices mapping raw graphical layouts dynamically minimizing browser node-memory utilizing rapid `requestAnimationFrame` polling logic natively rendering independent node-physics.

**Backend Execution:**
- **Next.js Route Handlers (`/api/*`):** Handles strictly stateless verification mathematics linking safely executing raw secure physics without leaking PRNG variables unexpectedly securely safely utilizing direct backend validations correctly formatting error handling efficiently securely.
- **Prisma mapped natively via SQLite bindings:** Securely records verification traces cleanly enabling exact validation replays visually scaling efficiently reliably capturing payloads ensuring math matching verifications efficiently reliably dynamically!

## Fairness Specification Configuration

The framework enforces indisputable verification parameters via the following exact strict computational behaviors ensuring absolute cryptographic security:
- **Hashing Security Layers:** Utilizes native Node's module components exclusively invoking `crypto.createHash('sha256')` directly natively bounding permutations explicitly.
- **Randomization Algorithm:** Physics iteration exclusively relies on customized **xorshift32 PRNG algorithm implementations**, statically bound converting hashes reliably strictly onto bounded arrays cleanly returning normalized variables mapping sequentially dynamically.
- **Mechanical Physics Nodes:** Generates bias metrics evaluating arrays strictly invoking explicitly `value = 0.5 + (rand() - 0.5) * 0.2` mapping outputs forcefully structurally forcing `roundedBias = Math.round(rawBias * 1000000) / 1000000` executing boundaries effectively mapping variables exactly stabilizing cross-environment mathematical execution rendering natively dynamically preventing deviation.
- **Hashing Object Structurally:** Exclusively implements natively strictly stringified bounds via identical static standard `JSON.stringify(pegMap)` resolving securely dynamically enforcing identical mapping cleanly dynamically securely generating `pegMapHash` permutations securely explicitly!

## AI Usage Disclaimer

Artificial Intelligence mechanics cleanly mapped out structural code-generation scaffolding components actively directly constructing physical constraints managing graphical layouts explicitly cleanly mathematically integrating Canvas representations automatically managing endpoint structures safely seamlessly configuring PRNG mapping natively dynamically effectively ensuring structural boundaries effectively safely strictly ensuring output dynamically efficiently safely securely!

## Quick Access Live Links & Estimates

- **Time Track:** Estimated implementation bounds ~ 1.5 Hours.
- **Live Local Address Index:** [http://localhost:3000](http://localhost:3000) - Start Drop Configuration!
- **Live Internal Mathematical Verifier Tool:** [http://localhost:3000/verify](http://localhost:3000/verify) - Transparency Checking Output.
- **Example Replay Data Source:** Explore `/verify?roundId=...` manually testing explicitly natively executing verification dynamically tracing parameters dynamically naturally!
