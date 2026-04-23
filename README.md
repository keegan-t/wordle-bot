# <img src="assets/icon.png" width="40" align="center" alt="Wordle Logo">ordle Bot

An automatic Wordle solver that plays through any given word like a real game.

**[Try it on keegant.dev →](https://wordle.keegant.dev)**

## Features

- Wins ~90% of games, averaging 4.6 guesses per successful solve
- Fetches today's Wordle word automatically
- Follows the same animations as Wordle
- Shareable emoji result grid
- Responsive design for desktop and mobile

## Strategy

The word list was ordered by usage frequency using Python's [wordfreq](https://pypi.org/project/wordfreq/) library. More common words rank higher in the list.

**First guess** - The bot starts by picking a random word from the top 50% of the list that contains 5 unique letters, striking a fun balance between chance and reason.

**Constraint filtering** - After each guess, the bot eliminates all words that contradict the context of green, yellow, and gray tiles.

**Guess selection** - The bot then picks from the remaining valid words:
- By default, the bot will select whichever valid word reveals the most unseen letters, maximizing information gained.
- If the number of possible words is within the guesses remaining, it plays them out one by one, since a win is guaranteed.
- If 3 tiles are green, it stops using guesses to gather information and picks the most common valid word.

**Special case** - If the bot has 2 remaining guesses, and has uncovered 4/5 green tiles, it will make a sacrifice guess. It temporarily suspends the constraint filters and selects a word to reveal the most unseen letters that fit within the final slot to form a valid word. This maximizes its potential for the final guess.