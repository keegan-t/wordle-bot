// Constants
const MAX_GUESSES = 6;
const KEY_ANIMATION_TIME = 750;
const KEY_STAGGER_DELAY = 250;
const ROW_REVEAL_DELAY = 250;
const ROW_PAUSE_DELAY = 500;
const VALID = new Set(WORDS);

// Bot logic
function scoreGuess(guess, answer) {
    const result = Array(5).fill("absent");
    const answerChars = answer.split("");
    const guessChars = guess.split("");

    // Mark exact matches, null to avoid double counting
    for (let i = 0; i < 5; i++) {
        if (guessChars[i] === answerChars[i]) {
            result[i] = "correct";
            answerChars[i] = guessChars[i] = null;
        }
    }

    // Mark remaining letters found in the answer but out of position
    for (let i = 0; i < 5; i++) {
        if (guessChars[i] !== null) {
            const index = answerChars.indexOf(guessChars[i]);
            if (index !== -1) {
                result[i] = "present";
                answerChars[index] = null;
            }
        }
    }

    return result;
}

function botGuess(history) {
    const greens = {}; // Confirmed letters for each position
    const yellowPos = {};// Sets of letters known wrong at that position
    const yellowLetters = new Set(); // Letters in the word with unknown position
    const grays = new Set(); // Letters not in the word
    const maxCount = {}; // Max time a letter can appear in the word
    const seen = new Set(); // Every letter guessed so far
    const guessed = new Set(history.map(([g]) => g)); // Words already guessed

    // Build constraints from previous guesses
    for (const [guess, result] of history) {
        // Tracking known green/yellow letters
        const confirmed = new Set(
            [...guess].filter((_, i) => result[i] === "correct" || result[i] === "present")
        );
        for (let i = 0; i < 5; i++) {
            const char = guess[i], st = result[i];
            seen.add(char);
            if (st === "correct") {
                // Letter is in the correct spot
                greens[i] = char;
            } else if (st === "present") {
                // Letter is in the word but not here
                if (!yellowPos[i]) yellowPos[i] = new Set();
                yellowPos[i].add(char);
                yellowLetters.add(char);
            } else {
                // Letter is not in the word
                if (confirmed.has(char)) {
                    // Same letter was green/yellow somewhere else
                    if (!yellowPos[i]) yellowPos[i] = new Set();
                    yellowPos[i].add(char);
                    const cnt = [...guess].filter(
                        (c, j) => c === char && (result[j] === "correct" || result[j] === "present")
                    ).length;
                    // Record the maximum number of times char could appear
                    if (!(char in maxCount) || cnt < maxCount[char]) maxCount[char] = cnt;
                } else {
                    // Letter does not appear anywhere in the answer
                    grays.add(char);
                }
            }
        }
    }

    // Filter the word list to comply with constraints
    function isValid(word) {
        for (let i = 0; i < 5; i++) {
            if (greens[i] && word[i] !== greens[i]) return false;
            if (yellowPos[i] && yellowPos[i].has(word[i])) return false;
        }
        for (const ch of yellowLetters) if (!word.includes(ch)) return false;
        for (const ch of grays) if (word.includes(ch)) return false;
        for (const [ch, max] of Object.entries(maxCount))
            if ([...word].filter(c => c === ch).length > max) return false;
        return !guessed.has(word);
    }

    const candidates = WORDS.filter(isValid);
    const greenCount = Object.keys(greens).length;
    const guessesLeft = MAX_GUESSES - history.length;

    // Guess through all remaining words
    if (candidates.length <= guessesLeft) return candidates[0];

    // Sacrifice move to find the most unseen letters that can fill the final slot
    if (greenCount === 4 && guessesLeft === 2) {
        const missingPos = [0, 1, 2, 3, 4].find(i => !greens[i]);
        const possibleFills = new Set(candidates.map(w => w[missingPos]));

        let bestSac = null, bestScore = 0;
        for (const w of WORDS) {
            if (guessed.has(w)) continue;
            const score = new Set([...w].filter(c => !seen.has(c) && possibleFills.has(c))).size;
            if (score > bestScore) {
                bestScore = score;
                bestSac = w;
            }
        }
        if (bestSac && bestScore > 0) return bestSac;
    }

    // With 3+ greens, pick the most common valid word
    if (greenCount >= 3) return candidates[0];

    // Pick the best word weighted by most new unlocked characters
    return candidates.reduce((best, w) => {
        const n = new Set([...w].filter(c => !seen.has(c))).size;
        const b = new Set([...best].filter(c => !seen.has(c))).size;
        return n > b ? w : best;
    });
}

function playGame(answer) {
    // Pick a random word in the top 50% of commonality, with 5 unique letters
    const half = Math.floor(WORDS.length / 2);
    const pool = WORDS.slice(0, half).filter(w => new Set(w).size === 5);
    const first = pool[Math.floor(Math.random() * pool.length)] ?? WORDS[0];

    const history = [[first, scoreGuess(first, answer)]];
    while (
        history.length < MAX_GUESSES
        && !history[history.length - 1][1].every(s => s === "correct")
        ) {
        const guess = botGuess(history);
        history.push([guess, scoreGuess(guess, answer)]);
    }

    const won = history[history.length - 1][1].every(s => s === "correct");
    return { history, won };
}

// DOM setup
const boardElement = document.getElementById("board");
const messageElement = document.getElementById("message");
const shareButton = document.getElementById("share-btn");
const errorElement = document.getElementById("error-msg");
const wordInput = document.getElementById("word-input");
const solveButton = document.getElementById("solve-btn");
const todayButton = document.getElementById("today-btn");

// Build tile grid
const tiles = Array.from({ length: 6 }, () =>
    Array.from({ length: 5 }, () => {
        const tile = document.createElement("div");
        tile.className = "tile";
        boardElement.appendChild(tile);
        return tile;
    })
);

// Build keyboard
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const keyElements = {};
const keyboardElement = document.getElementById("keyboard");

for (const keyRow of KEY_ROWS) {
    const row = document.createElement("div");
    row.className = "key-row";

    for (const letter of keyRow) {
        const key = document.createElement("div");
        key.className = "key";
        key.textContent = letter;
        keyElements[letter.toLowerCase()] = key;
        row.appendChild(key);
    }

    keyboardElement.appendChild(row);
}

// Animation
const STATE_PRIORITY = { correct: 3, present: 2, absent: 1 };
const WIN_MESSAGES = ["WHAT?!", "Genius!", "Impressive!", "Nailed It!", "Nice!", "Phew!"];
const EMOJI = { correct: "🟩", present: "🟨", absent: "⬛" };
let shareText = "";

function resetBoard() {
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 5; c++) {
            const t = tiles[r][c];
            t.textContent = "";
            t.className = "tile";
            delete t.dataset.state;
        }
    }

    for (const key of Object.values(keyElements)) {
        key.className = "key";
        key.style.visibility = "";
        delete key.dataset.state;
    }

    for (let r = 0; r < 6; r++)
        for (let c = 0; c < 5; c++)
            tiles[r][c].style.visibility = "";

    const sadFace = document.getElementById("sad-face");
    sadFace.style.transition = "none";
    sadFace.style.opacity = "0";

    messageElement.textContent = "";
    messageElement.classList.remove("show");

    shareButton.classList.remove("show");
    shareText = "";
}

function animateGame(history, won, answer) {
    const emojiRows = [];
    let rowDelay = 0;

    history.forEach(([guess, result], rowIdx) => {
        emojiRows.push(result.map(s => EMOJI[s]).join(""));

        // Reveal letters immediately
        setTimeout(() => {
            for (let c = 0; c < 5; c++) {
                tiles[rowIdx][c].textContent = guess[c].toUpperCase();
                tiles[rowIdx][c].classList.add("filled");
            }
        }, rowDelay);

        // Flip each tile from left to right
        const halfFlip = KEY_ANIMATION_TIME / 2;
        for (let c = 0; c < 5; c++) {
            const tileDelay = rowDelay + ROW_REVEAL_DELAY + c * KEY_STAGGER_DELAY;

            // Half flip
            setTimeout(() => {
                const tile = tiles[rowIdx][c];
                tile.classList.remove("flip-in", "flip-out");
                void tile.offsetWidth; // force reflow to restart animation
                tile.style.setProperty("--flip-half", `${halfFlip}ms`);
                tile.classList.add("flip-in");
            }, tileDelay);

            // Reveal color, continue flip
            setTimeout(() => {
                const tile = tiles[rowIdx][c];
                tile.dataset.state = result[c];
                tile.classList.remove("flip-in");
                tile.classList.add("flip-out", "revealed");
            }, tileDelay + halfFlip);
        }

        // Color the tiles
        const rowEnd = rowDelay + ROW_REVEAL_DELAY + 4 * KEY_STAGGER_DELAY + KEY_ANIMATION_TIME;
        setTimeout(() => {
            for (let c = 0; c < 5; c++) {
                const key = keyElements[guess[c]];
                if (!key) continue;
                const cur = key.dataset.state;
                const st = result[c];
                if (!cur || STATE_PRIORITY[st] > STATE_PRIORITY[cur]) key.dataset.state = st;
            }
        }, rowEnd);

        rowDelay = rowEnd + ROW_PAUSE_DELAY; // Keep a running delay
    });

    // Show results + win/loss animation
    setTimeout(() => {
        const n = history.length;
        const emojiShare = emojiRows.join("\n");

        if (won) {
            let winMessage = WIN_MESSAGES[Math.min(n - 1, WIN_MESSAGES.length - 1)];
            messageElement.textContent = `${winMessage} (${n}/${MAX_GUESSES})`;
            shareText = `Wordle Bot ${history.length}/${MAX_GUESSES}\n\n${emojiShare}`;
            confetti();
        } else {
            messageElement.textContent = `The word was ${answer.toUpperCase()} (X/${MAX_GUESSES})`;
            shareText = `Wordle Bot X/${MAX_GUESSES}\n\n${emojiShare}`;
            sadCrumble();
        }
        messageElement.classList.add("show");
        shareButton.classList.add("show");

        wordInput.disabled = false;
        solveButton.disabled = false;
        todayButton.disabled = false;
    }, rowDelay + 100);
}

function sadCrumble() {
    const shuffledKeys = Object.values(keyElements).sort(() => Math.random() - 0.5);
    const CRUMBLE_DELAY = 150;
    const totalDuration = shuffledKeys.length * CRUMBLE_DELAY;

    const sadFace = document.getElementById("sad-face");
    setTimeout(() => {
        sadFace.style.transition = `opacity ${totalDuration + 1000}ms linear`;
        sadFace.style.opacity = "1";
    }, 1000);

    shuffledKeys.forEach((key, i) => {
        setTimeout(() => {
            const rect = key.getBoundingClientRect();
            const clone = key.cloneNode(true);
            clone.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                top: ${rect.top}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                margin: 0;
                z-index: 998;
                box-sizing: border-box;
                transition: none;
            `;
            document.body.appendChild(clone);
            key.style.visibility = "hidden";

            let vy = 0.8;
            let y = 0;
            let vr = (Math.random() - 0.5) * 6;
            let r = 0;

            function animateKey() {
                vy += 0.25;
                y += vy;
                r += vr;
                clone.style.transform = `translateY(${y}px) rotate(${r}deg)`;

                if (rect.top + y < window.innerHeight + 100) {
                    requestAnimationFrame(animateKey);
                } else {
                    clone.remove();
                }
            }

            requestAnimationFrame(animateKey);
        }, 1000 + i * CRUMBLE_DELAY);
    });
}


function confetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#538d4e", "#b59f3b", "#ffffff", "#6aaa64", "#c9b458", "#ff6b6b", "#4ecdc4", "#a78bfa"];
    const COUNT = 200;
    const DURATION = 3000;

    const particles = Array.from({ length: COUNT }, (_, i) => {
        const fromLeft = i < COUNT / 2;
        return {
            x: fromLeft ? 0 : canvas.width,
            y: canvas.height * 0.5,
            vx: fromLeft ? (Math.random() * 3.5 + 1.5) : -(Math.random() * 3.5 + 1.5),
            vy: -(Math.random() * 8 + 4),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            size: Math.random() * 9 + 4,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.25,
            isRect: Math.random() < 0.6,
        };
    });

    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const alpha = elapsed < DURATION - 1500 ? 1 : Math.max(0, 1 - (elapsed - (DURATION - 1500)) / 1500);

        for (const p of particles) {
            p.vy += 0.12;
            p.vx *= 0.995;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            if (p.isRect) {
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (elapsed < DURATION) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    requestAnimationFrame(animate);
}

// Solve flow
function solve() {
    const raw = wordInput.value.trim().toLowerCase();
    errorElement.textContent = "";

    if (raw.length !== 5) {
        errorElement.textContent = "Enter a 5 letter word.";
        return;
    }
    if (!/^[a-z]+$/.test(raw)) {
        errorElement.textContent = "Letters only.";
        return;
    }
    if (!VALID.has(raw)) {
        errorElement.textContent = "Not in word list.";
        return;
    }

    resetBoard();
    wordInput.disabled = true;
    solveButton.disabled = true;
    todayButton.disabled = true;

    const { history, won } = playGame(raw);
    animateGame(history, won, raw);
}

async function fetchTodaysWord() {
    todayButton.disabled = true;
    errorElement.textContent = "";

    try {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const res = await fetch(`https://corsproxy.io/?url=https://www.nytimes.com/svc/wordle/v2/${date}.json`);
        if (!res.ok) throw new Error();
        const { solution } = await res.json();
        wordInput.value = solution.toUpperCase();
        solve();
    } catch {
        errorElement.textContent = "Couldn't fetch today's word.";
        todayButton.disabled = false;
    }
}

// Event listeners
solveButton.addEventListener("click", solve);
todayButton.addEventListener("click", fetchTodaysWord);
wordInput.addEventListener("keydown", e => {
    if (e.key === "Enter") solve();
});
wordInput.addEventListener("input", () => {
    wordInput.value = wordInput.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
    errorElement.textContent = "";
});

shareButton.addEventListener("click", () => {
    navigator.clipboard.writeText(shareText).then(() => {
        const originalText = shareButton.textContent;
        shareButton.textContent = "Copied!";
        setTimeout(() => shareButton.textContent = originalText, 1500);
    });
});