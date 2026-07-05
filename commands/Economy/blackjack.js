const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const CardUtils = require('../../utils/CardUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a game of Blackjack solo or against others!')
        .addStringOption(option => 
            option.setName('bet')
                .setDescription('The amount of money to bet (e.g. 1k, half, all)')
                .setRequired(true)
        )
        .addUserOption(option => 
            option.setName('opponent1')
                .setDescription('Challenge another user')
                .setRequired(false)
        )
        .addUserOption(option => 
            option.setName('opponent2')
                .setDescription('Challenge a second user')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const betInput = interaction.options.getString('bet');
            const opp1 = interaction.options.getUser('opponent1');
            const opp2 = interaction.options.getUser('opponent2');

            // Collect all unique participants
            const participants = [interaction.user];
            if (opp1 && opp1.id !== interaction.user.id && !opp1.bot) participants.push(opp1);
            if (opp2 && opp2.id !== interaction.user.id && !opp2.bot && (!opp1 || opp2.id !== opp1.id)) participants.push(opp2);

            const isMultiplayer = participants.length > 1;

            // Check host balance and parse bet
            const hostData = await EconomyUtils.getUser(interaction.user.id);
            const parseAmount = require('../../utils/AmountParser.js');
            const bet = parseAmount(betInput, hostData.wallet + hostData.bank);

            if (bet < 100) {
                return interaction.followUp(ComponentUtils.createError(`The minimum bet is **${EconomyConfig.currencySymbol}100**.`));
            }

            if ((hostData.wallet + hostData.bank) < bet) {
                return interaction.followUp(ComponentUtils.createError(`You do not have enough money to bet **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`));
            }

            // Multiplayer Setup Phase
            let players = []; // Array of objects { user, hand, status, bet }
            let totalPot = 0;

            if (isMultiplayer) {
                const joinEmbed = new EmbedBuilder()
                    .setTitle('🃏 Multiplayer Blackjack')
                    .setDescription(`${interaction.user} has invited ${participants.slice(1).join(', ')} to a game of Blackjack!\n\n**Bet:** ${EconomyConfig.currencySymbol}${bet.toLocaleString()}\n\nClick **Join** to accept the challenge!`)
                    .setColor(EconomyConfig.embedColor);

                const joinRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('join_bj').setLabel('Join').setStyle(ButtonStyle.Success)
                );

                const msg = await interaction.followUp({ embeds: [joinEmbed], components: [joinRow] });
                
                // Add host automatically
                await EconomyUtils.removeCash(interaction.user.id, bet, 'cascade');
                players.push({ user: interaction.user, hand: [], status: 'waiting', currentBet: bet });
                totalPot += bet;

                const joinedUsers = new Set([interaction.user.id]);
                const requiredUsers = new Set(participants.map(p => p.id));

                const collector = msg.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: EconomyConfig.gambling.blackjack.multiplayerJoinTime || 30000,
                    filter: i => requiredUsers.has(i.user.id)
                });

                const joinPromise = new Promise(resolve => {
                    collector.on('collect', async i => {
                        if (joinedUsers.has(i.user.id)) {
                            return i.reply(ComponentUtils.createError('You have already joined!'));
                        }

                        const pData = await EconomyUtils.getUser(i.user.id);
                        if ((pData.wallet + pData.bank) < bet) {
                            return i.reply(ComponentUtils.createError(`You do not have enough money to match the bet of **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`));
                        }

                        await EconomyUtils.removeCash(i.user.id, bet, 'cascade');
                        players.push({ user: i.user, hand: [], status: 'waiting', currentBet: bet });
                        totalPot += bet;
                        joinedUsers.add(i.user.id);

                        await i.reply({ content: `✅ You joined the game!`, ephemeral: true });

                        if (joinedUsers.size === requiredUsers.size) {
                            collector.stop('all_joined');
                        }
                    });

                    collector.on('end', () => resolve());
                });

                await joinPromise;

                if (joinedUsers.size < requiredUsers.size) {
                    // Refund players who joined
                    for (const p of players) {
                        await EconomyUtils.addCash(p.user.id, p.currentBet, 'wallet');
                    }
                    return interaction.editReply({ content: '❌ Not all invited players joined in time. Game cancelled and bets refunded.', embeds: [], components: [] });
                }

            } else {
                // Solo setup
                await EconomyUtils.removeCash(interaction.user.id, bet, 'cascade');
                players.push({ user: interaction.user, hand: [], status: 'waiting', currentBet: bet });
                totalPot += bet;
                await interaction.followUp({ content: 'Setting up Blackjack...' });
            }

            // Game Logic
            const deck = CardUtils.generateDeck();
            const dealer = { hand: [] };

            // Deal initial cards
            for (let i = 0; i < 2; i++) {
                for (const p of players) p.hand.push(deck.pop());
                dealer.hand.push(deck.pop());
            }

            // Check for instant blackjacks
            for (const p of players) {
                if (CardUtils.isBlackjack(p.hand)) {
                    p.status = 'blackjack';
                }
            }

            const generateGameStateEmbed = (currentPlayerIndex, hideDealer = true) => {
                const embed = new EmbedBuilder()
                    .setTitle(`🃏 Blackjack - Pot: ${EconomyConfig.currencySymbol}${totalPot.toLocaleString()}`)
                    .setColor(EconomyConfig.embedColor);

                // Dealer Field
                let dealerString = '';
                if (hideDealer) {
                    dealerString = `${CardUtils.formatHand([dealer.hand[0]])} \`??\``;
                } else {
                    const dScore = CardUtils.calculateScore(dealer.hand);
                    dealerString = `${CardUtils.formatHand(dealer.hand)}\n**Score:** ${dScore}`;
                    if (dScore > 21) dealerString += ' **(BUST)**';
                }
                embed.addFields({ name: 'Dealer', value: dealerString, inline: false });

                // Player Fields
                for (let i = 0; i < players.length; i++) {
                    const p = players[i];
                    const pScore = CardUtils.calculateScore(p.hand);
                    let pString = `${CardUtils.formatHand(p.hand)}\n**Score:** ${pScore}`;
                    
                    if (p.status === 'blackjack') pString += ' **(BLACKJACK)**';
                    else if (p.status === 'bust') pString += ' **(BUST)**';
                    else if (p.status === 'stand') pString += ' **(STAND)**';

                    const isTurn = (i === currentPlayerIndex);
                    const nameStr = isTurn ? `▶️ ${p.user.username}'s Turn` : p.user.username;

                    embed.addFields({ name: nameStr, value: pString, inline: true });
                }

                return embed;
            };

            // Player Turns
            for (let i = 0; i < players.length; i++) {
                const currentPlayer = players[i];
                if (currentPlayer.status === 'blackjack') continue;

                currentPlayer.status = 'playing';

                while (currentPlayer.status === 'playing') {
                    const embed = generateGameStateEmbed(i);
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
                    );

                    // Allow double down only on 2 cards
                    if (currentPlayer.hand.length === 2) {
                        row.addComponents(new ButtonBuilder().setCustomId('double').setLabel('Double Down').setStyle(ButtonStyle.Success));
                    }

                    const gameMsg = await interaction.editReply({ content: '', embeds: [embed], components: [row] });

                    const filter = iBtn => iBtn.user.id === currentPlayer.user.id && ['hit', 'stand', 'double'].includes(iBtn.customId);
                    const btnInteraction = await gameMsg.awaitMessageComponent({ filter, time: 60000, componentType: ComponentType.Button }).catch(() => null);

                    if (!btnInteraction) {
                        currentPlayer.status = 'stand'; // Auto-stand on timeout
                        break;
                    }

                    if (btnInteraction.customId === 'hit') {
                        currentPlayer.hand.push(deck.pop());
                        const score = CardUtils.calculateScore(currentPlayer.hand);
                        if (score > 21) currentPlayer.status = 'bust';
                        await btnInteraction.deferUpdate(); // Acknowledge without removing components yet

                    } else if (btnInteraction.customId === 'stand') {
                        currentPlayer.status = 'stand';
                        await btnInteraction.deferUpdate();

                    } else if (btnInteraction.customId === 'double') {
                        // Check if they have enough money to double
                        const cData = await EconomyUtils.getUser(currentPlayer.user.id);
                        if ((cData.wallet + cData.bank) < currentPlayer.currentBet) {
                            await btnInteraction.reply(ComponentUtils.createError(`You do not have enough money to double down!`));
                            continue; // Let them pick hit/stand instead
                        }

                        await EconomyUtils.removeCash(currentPlayer.user.id, currentPlayer.currentBet, 'cascade');
                        totalPot += currentPlayer.currentBet;
                        currentPlayer.currentBet *= 2;
                        
                        currentPlayer.hand.push(deck.pop());
                        const score = CardUtils.calculateScore(currentPlayer.hand);
                        if (score > 21) currentPlayer.status = 'bust';
                        else currentPlayer.status = 'stand';

                        await btnInteraction.deferUpdate();
                    }
                }
            }

            // Dealer Turn
            let dealerScore = CardUtils.calculateScore(dealer.hand);
            const allPlayersBusted = players.every(p => p.status === 'bust');

            if (!allPlayersBusted) {
                while (dealerScore < 17 || (EconomyConfig.gambling.blackjack.dealerHitSoft17 && dealerScore === 17 && dealer.hand.some(c => c.value === 'A'))) {
                    dealer.hand.push(deck.pop());
                    dealerScore = CardUtils.calculateScore(dealer.hand);
                }
            }

            // Evaluation
            const finalEmbed = generateGameStateEmbed(-1, false);
            const dealerBust = dealerScore > 21;

            if (!isMultiplayer) {
                // Solo Mode Evaluation
                const p = players[0];
                const pScore = CardUtils.calculateScore(p.hand);
                let resultMsg = '';

                if (p.status === 'bust') {
                    resultMsg = `💀 You busted and lost **${EconomyConfig.currencySymbol}${p.currentBet.toLocaleString()}**!`;
                    finalEmbed.setColor(EconomyConfig.failColor);
                } else if (dealerBust || pScore > dealerScore) {
                    let winAmount = p.currentBet * 2;
                    if (p.status === 'blackjack') winAmount = Math.floor(p.currentBet * 2.5); // 3:2 payout for natural blackjack
                    await EconomyUtils.addCash(p.user.id, winAmount, 'wallet');
                    
                    resultMsg = `🎉 You won **${EconomyConfig.currencySymbol}${winAmount.toLocaleString()}**!`;
                    finalEmbed.setColor(EconomyConfig.successColor);
                } else if (pScore === dealerScore) {
                    // Push
                    if (p.status === 'blackjack' && !CardUtils.isBlackjack(dealer.hand)) {
                        // Player has natural BJ, dealer has 21 but not BJ
                        const winAmount = Math.floor(p.currentBet * 2.5);
                        await EconomyUtils.addCash(p.user.id, winAmount, 'wallet');
                        resultMsg = `🎉 You won with a Blackjack! Payout: **${EconomyConfig.currencySymbol}${winAmount.toLocaleString()}**`;
                        finalEmbed.setColor(EconomyConfig.successColor);
                    } else if (p.status !== 'blackjack' && CardUtils.isBlackjack(dealer.hand)) {
                        // Dealer has BJ, player has 21
                        resultMsg = `💀 Dealer got a Blackjack! You lost **${EconomyConfig.currencySymbol}${p.currentBet.toLocaleString()}**!`;
                        finalEmbed.setColor(EconomyConfig.failColor);
                    } else {
                        await EconomyUtils.addCash(p.user.id, p.currentBet, 'wallet');
                        resultMsg = `🤝 Push! Your bet of **${EconomyConfig.currencySymbol}${p.currentBet.toLocaleString()}** was returned.`;
                    }
                } else {
                    resultMsg = `💀 Dealer wins! You lost **${EconomyConfig.currencySymbol}${p.currentBet.toLocaleString()}**!`;
                    finalEmbed.setColor(EconomyConfig.failColor);
                }
                
                finalEmbed.setDescription(`### Result\n${resultMsg}`);
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
                try {
                    const gameMsg = await interaction.fetchReply();
                    await interaction.channel.send({ content: `🃏 <@${interaction.user.id}> Your Blackjack game finished!\n> [Click here to view results](${gameMsg.url})` });
                } catch (e) {}

            } else {
                // Multiplayer Evaluation
                let validPlayers = players.filter(p => p.status !== 'bust');
                let resultMsg = '';

                if (validPlayers.length === 0) {
                    resultMsg = `💀 Everyone busted! Dealer takes the pot of **${EconomyConfig.currencySymbol}${totalPot.toLocaleString()}**.`;
                    finalEmbed.setColor(EconomyConfig.failColor);
                } else {
                    if (!dealerBust) {
                        validPlayers = validPlayers.filter(p => CardUtils.calculateScore(p.hand) >= dealerScore);
                    }

                    if (validPlayers.length === 0) {
                        resultMsg = `💀 Dealer beat everyone! Dealer takes the pot of **${EconomyConfig.currencySymbol}${totalPot.toLocaleString()}**.`;
                        finalEmbed.setColor(EconomyConfig.failColor);
                    } else {
                        // Find the highest score among valid players
                        let maxScore = -1;
                        for (const p of validPlayers) {
                            const score = CardUtils.calculateScore(p.hand);
                            const finalScore = p.status === 'blackjack' ? 99 : score; // Treat BJ as highest possible score
                            if (finalScore > maxScore) maxScore = finalScore;
                        }

                        const winners = validPlayers.filter(p => {
                            const s = p.status === 'blackjack' ? 99 : CardUtils.calculateScore(p.hand);
                            return s === maxScore;
                        });

                        // Check if dealer tied with winners
                        const dealerHasBJ = CardUtils.isBlackjack(dealer.hand);
                        const dealerFinalScore = dealerHasBJ ? 99 : dealerScore;

                        if (dealerFinalScore === maxScore) {
                            // Push with dealer, winners split their bets back (or split the pot?)
                            // Standard: if you tie dealer, you get your bet back. In pot mode, winners split the pot.
                            const splitAmount = Math.floor(totalPot / winners.length);
                            for (const w of winners) await EconomyUtils.addCash(w.user.id, splitAmount, 'wallet');
                            resultMsg = `🤝 Push with Dealer! ${winners.map(w => w.user.username).join(', ')} split the pot and take **${EconomyConfig.currencySymbol}${splitAmount.toLocaleString()}** each!`;
                        } else {
                            // Winners beat dealer
                            const splitAmount = Math.floor(totalPot / winners.length);
                            for (const w of winners) await EconomyUtils.addCash(w.user.id, splitAmount, 'wallet');
                            resultMsg = `🎉 ${winners.map(w => w.user.username).join(', ')} win the pot and take **${EconomyConfig.currencySymbol}${splitAmount.toLocaleString()}** each!`;
                            finalEmbed.setColor(EconomyConfig.successColor);
                        }
                    }
                }

                finalEmbed.setDescription(`### Result\n${resultMsg}`);
                await interaction.editReply({ embeds: [finalEmbed], components: [] });
                try {
                    const gameMsg = await interaction.fetchReply();
                    await interaction.channel.send({ content: `🃏 <@${interaction.user.id}> The multiplayer Blackjack game finished!\n> [Click here to view results](${gameMsg.url})` });
                } catch (e) {}
            }

        } catch (error) {
            console.error('Blackjack Error:', error);
            await interaction.editReply(ComponentUtils.createError('An error occurred while playing Blackjack.')).catch(() => {});
        }
    }
};
