# Plinko Lab – Provably Fair Game

A high-integrity, deterministic Plinko simulation engine featuring a robust cryptographic verification layer. Built for transparency, audibility, and mathematical precision.

*   🔗 **Live App**: [plinko-flax.vercel.app](https://plinko-flax.vercel.app/)
*   🔍 **Verifier**: [plinko-flax.vercel.app/verify](https://plinko-flax.vercel.app/verify)
*   📌 **Example Proof**: [Click here to verify the assignment test case](https://plinko-flax.vercel.app/verify?serverSeed=b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc&nonce=42&clientSeed=candidate-hello&dropColumn=6)

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Database**: Prisma ORM with SQLite (Local) / PostgreSQL (Production)
- **Styling**: Tailwind CSS + Framer Motion (Glassmorphism UI)
- **Crypto**: Node `crypto` / Web Crypto API

---

## 🚀 Features

- **Provably Fair Protocol**: Strict Commit-Reveal sequence ensuring pre-determined outcomes.
- **Deterministic Simulation**: Physics-less mathematical engine guaranteeing bit-identical results across platforms.
- **Interactive Verifier**: 5-step computation trace visually exposing the cryptographic path.
- **Simulation Mode**: Real-time verification of arbitrary seeds without requiring database records.
- **Trajectory Replay**: Step-by-step mapping of the ball's L/R path through the 12-row peg grid.
- **Session History**: Persistent local tracking of rounds with CSV export support.

---

## 🛡 Provably Fair Explanation

The system operates on a transparent **Commit-Reveal** protocol to eliminate any possibility of server-side manipulation:

1.  **Commitment**: Before the round starts, the server generates a `serverSeed` and a `nonce`. It shares the **SHA256 hash** of their combination (`commitHex`):  
    `commitHex = SHA256(serverSeed + ":" + nonce)`  
    This hash serves as a cryptographic seal. Once shared, the server cannot change the `serverSeed` or `nonce` without invalidating the proof.
2.  **Input**: The player provides their own entropy via a `clientSeed`.
3.  **Reveal**: After the drop, the server reveals the original `serverSeed` and `nonce`.
4.  **Verification**: Using the revealed values, anyone can re-calculate the `commitHex` and re-run the deterministic simulation to confirm the result matches exactly what was shown.

---

## 🔬 Fairness Specification

### 1. Seed Generation
All randomness is derived from the `combinedSeed`, ensuring the outcome is locked the moment the player clicks "Drop".
`combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)`

### 2. PRNG (Xorshift32)
We use a 32-bit **Xorshift** algorithm for deterministic pseudo-randomness:
- **Seed**: First 4 bytes (8 characters) of the `combinedSeed` hex string, interpreted as a big-endian 32-bit unsigned integer.
- **Implementation**:
  ```typescript
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296; // Normalization to [0, 1)
  ```

### 3. Bias Formula
To account for the player's starting position (drop column), a deterministic bias is applied:
- `adj = (dropColumn - floor(rows / 2)) * 0.01`
- `bias = clamp(0.5 + adj, 0, 1)`

### 4. Path Logic
The simulation proceeds row-by-row (`r = 0 to 11`):
1.  Identify the hit peg: `pegIndex = min(pos, r)`
2.  Decision:
    - Pull the next value `rnd` from the PRNG.
    - If `rnd < bias` → Move **LEFT**.
    - Else → Move **RIGHT** and increment `pos += 1`.

---

## 🧪 Test Vectors (Assignment Spec)

To verify the engine's deterministic accuracy, use the following mandatory test case in **Simulation Mode**:

| Component | Value |
| :--- | :--- |
| **Rows** | `12` |
| **Server Seed** | `b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc` |
| **Nonce** | `42` |
| **Client Seed** | `candidate-hello` |
| **Drop Column** | `6` |

**Verification Results:**
- **Commit Hex**: `bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34`
- **Combined Seed**: `e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0`
- **PRNG First 5 Pulls**: `0.1106166649`, `0.7625129214`, `0.0439292176`, `0.4578678815`, `0.3438999297`
- **Resulting Path**: `L R L L L R R R L R R L`
- **Final Bin Index**: `6`

---

## 🏗 Key Engineering Decisions

1.  **PRNG Isolation**: The simulation engine uses its own isolated PRNG instance. This ensures that visual elements (like the peg map) do not consume random numbers from the simulation's stream, maintaining perfect determinism.
2.  **Stateless Engine**: The `simulateDrop` function is purely functional. It relies only on its inputs, making it trivial to audit and replay on any client or server.
3.  **Atomic State Guards**: Backend updates use Prisma `updateMany` with status-based filtering (`status: 'CREATED'`). This prevents race conditions and ensures a "Reveal" can only happen after a valid "Start".
4.  **Verifier Transparency**: The verifier specifically labels "Simulation Mode" vs "Verified Mode" to prevent user confusion, highlighting when a result is merely deterministic vs. when it has been confirmed against the official game database.

---

## 🤖 AI Usage

This project was developed through a high-intensity pair-programming workflow with **Claude (Antigravity)**.

- **AI Contributions**:
    - **UI Scaffolding**: Rapid prototyping of the Glassmorphism design system and responsive Verifier layout.
    - **PRNG Debugging**: Identifying the precise bitwise shift requirements for Xorshift32 in a JavaScript environment.
    - **Test Vector Validation**: Batch processing the mandatory test parameters to verify engine output.
- **Manual Corrections & Independent Thinking**:
    - **Cryptographic Standard Enforcement**: I manually corrected the AI's initial `SHA256(S)` proposal to strictly follow the `SHA256(S:N)` commitment standard required by the assignment.
    - **Deterministic Bias Fine-Tuning**: I refactored the simulation loop to remove randomized "Peg Map" biases, ensuring the core logic strictly follows the `0.5 + adj` mathematical requirement.
    - **PRNG Stream Continuity**: I enforced the "Simulation Priority" rule, ensuring the simulation consumes the PRNG starting from the very first pull, regardless of secondary feature consumption (like peg maps).

---

## 💻 How to Run Locally

1.  **Clone**: `git clone <repo-url>`
2.  **Install**: `npm install`
3.  **Setup Database**:
    ```bash
    npx prisma generate
    npx prisma db push
    ```
4.  **Run**: `npm run dev`

---

## 🔮 Future Improvements

- **Bulk Verification**: batch-upload of CSV histories for instant cryptographic auditing of thousands of rounds.
- **Physics-Integrated Visuals**: Overlaying the deterministic math with a high-fidelity physics visualization (Matter.js) for enhanced player immersion without sacrificing truth.

---

**Time Spent**: ~10 Engineering Hours (Planning, Engine Development, UI Polish, & Compliance Audit).
