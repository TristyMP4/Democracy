module.exports = {
    suits: ['♠️', '♥️', '♦️', '♣️'],
    values: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'],

    /**
     * Generate a standard 52-card deck
     */
    generateDeck() {
        const deck = [];
        for (const suit of this.suits) {
            for (const value of this.values) {
                deck.push({ suit, value });
            }
        }
        return this.shuffleDeck(deck);
    },

    /**
     * Fisher-Yates shuffle
     */
    shuffleDeck(deck) {
        let currentIndex = deck.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
        }
        return deck;
    },

    /**
     * Calculate the best score for a hand
     * @param {Array} hand Array of card objects { suit, value }
     */
    calculateScore(hand) {
        let score = 0;
        let aces = 0;

        for (const card of hand) {
            if (['J', 'Q', 'K'].includes(card.value)) {
                score += 10;
            } else if (card.value === 'A') {
                score += 11;
                aces += 1;
            } else {
                score += parseInt(card.value);
            }
        }

        // Adjust aces if we bust
        while (score > 21 && aces > 0) {
            score -= 10;
            aces -= 1;
        }

        return score;
    },

    /**
     * Returns a string representation of the hand
     */
    formatHand(hand) {
        return hand.map(card => `\`${card.value}${card.suit}\``).join(' ');
    },

    /**
     * Returns true if hand is a blackjack (21 in 2 cards)
     */
    isBlackjack(hand) {
        return hand.length === 2 && this.calculateScore(hand) === 21;
    }
};
