class PokerManager {
    constructor() {
        this.suits = ['H', 'D', 'C', 'S'];
        this.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        
        this.rankValues = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        
        this.suitEmojis = {
            'H': '♥️', 'D': '♦️', 'C': '♣️', 'S': '♠️'
        };
        
        this.rankEmojis = {
            'T': '10'
        };
    }

    createDeck() {
        let deck = [];
        for (let suit of this.suits) {
            for (let rank of this.ranks) {
                deck.push(rank + suit);
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        let m = deck.length, t, i;
        while (m) {
            i = Math.floor(Math.random() * m--);
            t = deck[m];
            deck[m] = deck[i];
            deck[i] = t;
        }
        return deck;
    }

    formatCard(card) {
        if (!card) return '🃏';
        const rank = card[0];
        const suit = card[1];
        const displayRank = this.rankEmojis[rank] || rank;
        return `**${displayRank}**${this.suitEmojis[suit]}`;
    }

    getCombinations(array, size) {
        const result = [];
        const combine = (start, combo) => {
            if (combo.length === size) {
                result.push([...combo]);
                return;
            }
            for (let i = start; i < array.length; i++) {
                combine(i + 1, [...combo, array[i]]);
            }
        };
        combine(0, []);
        return result;
    }

    evaluateHand(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];
        // If not enough cards (like during active betting before river), just return a baseline
        if (allCards.length < 5) return { score: 0, name: 'High Card', cards: allCards };
        
        const possible5CardHands = this.getCombinations(allCards, 5);
        let bestScore = -1;
        let bestHandName = "";
        let best5Cards = [];

        for (let hand of possible5CardHands) {
            const ev = this.evaluate5Cards(hand);
            if (ev.score > bestScore) {
                bestScore = ev.score;
                bestHandName = ev.name;
                best5Cards = hand;
            }
        }

        return { score: bestScore, name: bestHandName, cards: best5Cards };
    }

    evaluate5Cards(cards) {
        // cards is array like ['AH', 'KH', 'QH', 'JH', 'TH']
        let parsed = cards.map(c => ({
            rank: this.rankValues[c[0]],
            suit: c[1]
        })).sort((a, b) => b.rank - a.rank); // Sort highest rank first

        const isFlush = parsed.every(c => c.suit === parsed[0].suit);
        
        let isStraight = false;
        if (parsed[0].rank === parsed[1].rank + 1 &&
            parsed[1].rank === parsed[2].rank + 1 &&
            parsed[2].rank === parsed[3].rank + 1 &&
            parsed[3].rank === parsed[4].rank + 1) {
            isStraight = true;
        } else if (parsed[0].rank === 14 && parsed[1].rank === 5 && parsed[2].rank === 4 && parsed[3].rank === 3 && parsed[4].rank === 2) {
            // Ace-low straight (A, 5, 4, 3, 2)
            isStraight = true;
            // Reorder to 5,4,3,2,A so 5 is highest
            parsed = [parsed[1], parsed[2], parsed[3], parsed[4], parsed[0]];
        }

        const counts = {};
        for (let c of parsed) {
            counts[c.rank] = (counts[c.rank] || 0) + 1;
        }

        let frequencies = [];
        for (let [rank, count] of Object.entries(counts)) {
            frequencies.push({ rank: parseInt(rank), count });
        }
        
        // Sort frequencies by count (desc), then by rank (desc)
        frequencies.sort((a, b) => {
            if (a.count !== b.count) return b.count - a.count;
            return b.rank - a.rank;
        });

        const ranksSortedByFreq = frequencies.map(f => f.rank);

        // Calculate a score that can be compared directly
        // Hands ranked 1-10
        let category = 1; // High Card
        let name = "High Card";

        if (isStraight && isFlush) {
            if (parsed[0].rank === 14 && parsed[1].rank === 13) {
                category = 10;
                name = "Royal Flush";
            } else {
                category = 9;
                name = "Straight Flush";
            }
        } else if (frequencies[0].count === 4) {
            category = 8;
            name = "Four of a Kind";
        } else if (frequencies[0].count === 3 && frequencies[1].count === 2) {
            category = 7;
            name = "Full House";
        } else if (isFlush) {
            category = 6;
            name = "Flush";
        } else if (isStraight) {
            category = 5;
            name = "Straight";
        } else if (frequencies[0].count === 3) {
            category = 4;
            name = "Three of a Kind";
        } else if (frequencies[0].count === 2 && frequencies[1].count === 2) {
            category = 3;
            name = "Two Pair";
        } else if (frequencies[0].count === 2) {
            category = 2;
            name = "Pair";
        }

        // Score formulation:
        // category << 20 | freq0 << 16 | freq1 << 12 | freq2 << 8 | freq3 << 4 | freq4
        let score = category * 1000000;
        let multiplier = 100000;
        for (let r of ranksSortedByFreq) {
            // we have to push each individual card of that freq to match 5 cards for kickers
            let cCount = frequencies.find(f => f.rank === r).count;
            for(let i=0; i<cCount; i++) {
                score += r * multiplier;
                multiplier /= 15;
            }
        }

        return { score, name };
    }
}

module.exports = new PokerManager();
