# 🎰 Plinko Lab // Technical Specification

A high-fidelity, provably fair Plinko simulation built with a strictly audited cryptographic stack.

## 🛠 Tech Stack (Finalized)

*   **Frontend**: Next.js 14+ (App Router), React 18, TypeScript.
*   **Aesthetics**: Cyberpunk/Glitch CSS system with standard Glassmorphism fallbacks.
*   **Engine**: HTML5 Canvas bitwise-optimized rendering loop.
*   **Backend**: Next.js Edge-ready API Route Handlers.
*   **Database**: **PostgreSQL + Prisma ORM** (Industry Standard).
*   **Hashing**: SHA-256 (Node.js `crypto` native module).
*   **PRNG**: **Xorshift32** (Deterministic, bit-shift randomization).

---

## 🚀 Local Development Setup

1.  **Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Configuration**:
    Rename `.env.example` to `.env` and provide your Postgres connection string:
    ```env
    DATABASE_URL="postgresql://user:password@host:5432/db_name?sslmode=require"
    ```

3.  **Database Synchronization**:
    Push the schema to your Postgres instance:
    ```bash
    npx prisma db push
    ```

4.  **Verification Test Suit**:
    Run Vitest to ensure PRNG and Physics integrity:
    ```bash
    npm run test
    ```

5.  **Launch Interface**:
    ```bash
    npm run dev
    ```

---

## 🔒 Provable Fairness Implementation

### 1. Hashing Hierarchy (SHA-256)
We use the standard SHA-256 algorithm for all cryptographic commitments:
*   **Commitment**: `sha256(serverSeed + ":" + nonce)`
*   **Revealed Seed**: `sha256(serverSeed + ":" + clientSeed + ":" + nonce)`

### 2. Randomness Engine (Xorshift32)
Each drop is governed by a deterministic bit-shift generator (Xorshift32). This ensures that given the same seed, the ball trajectory is 100% reproducible and auditable.
```typescript
// Core PRNG Logic (lib/prng.ts)
state ^= state << 13;
state ^= state >>> 17;
state ^= state << 5;
```

### 3. Physics & Bias
The physics engine calculates each collision using a deterministic float derived from the PRNG. We apply a fixed precision rounding (`10^6`) to prevent floating-point drift across different browser engines, ensuring the verifier always matches the live game.

---

## 📊 Feature Index
*   **Live Interface**: [http://localhost:3000](http://localhost:3000)
*   **Audit Terminal**: [http://localhost:3000/verify](http://localhost:3000/verify)
*   **Easter Eggs**: 
    *   Press `T` for Gravitational Tilt (Hardware Glitch Simulation).
    *   Press `G` for Geometry Overlay (Real-time RNG data).
    *   **Golden Ball**: Achieve 3 consecutive center landings to activate the Gold Skin.
