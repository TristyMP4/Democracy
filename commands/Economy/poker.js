const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const PokerManager = require('../../utils/PokerManager.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('poker')
        .setDescription("Start a Texas Hold'em Poker table.")
        .addIntegerOption(option =>
            option.setName('buyin')
                .setDescription('The buy-in amount for this table.')
                .setRequired(true)
                .setMinValue(100)
        ),

    async execute(interaction) {
        const buyin = interaction.options.getInteger('buyin');
        const hostId = interaction.user.id;
        
        const hostProfile = await EconomyUtils.getUser(hostId);
        if (hostProfile.wallet < buyin) {
            return interaction.reply(ComponentUtils.createError(`You need at least ${EconomyConfig.currencySymbol}**${buyin.toLocaleString()}** in your wallet to host this table.`));
        }

        // Game State
        const state = {
            phase: 'lobby', // lobby, preflop, flop, turn, river, showdown
            pot: 0,
            buyin: buyin,
            players: new Map(), // id -> { user, holeCards: [], currentBet: 0, folded: false, allIn: false }
            activePlayers: [], // array of IDs in turn order
            turnIndex: 0,
            communityCards: [],
            deck: [],
            highestBet: 0,
            hostId: hostId,
            message: null
        };

        // Add host
        state.players.set(hostId, {
            user: interaction.user,
            holeCards: [],
            currentBet: 0,
            folded: false,
            allIn: false
        });

        // Deduct buy-in immediately
        await EconomyUtils.removeCash(hostId, buyin, 'wallet');
        state.pot += buyin;

        const generateEmbed = () => {
            const embed = new EmbedBuilder()
                .setTitle(`🃏 Texas Hold'em - ${EconomyConfig.currencySymbol}${buyin.toLocaleString()} Buy-in`)
                .setColor(EconomyConfig.embedColor);

            if (state.phase === 'lobby') {
                embed.setDescription(`**Host:** <@${state.hostId}>\nWaiting for players to join...`);
                let pList = Array.from(state.players.values()).map(p => `- ${p.user.username}`).join('\n');
                embed.addFields({ name: `Players (${state.players.size}/6)`, value: pList });
                embed.setFooter({ text: 'Host can click Start Game when ready' });
            } else if (state.phase === 'showdown') {
                embed.setDescription(`### 💰 Final Pot: ${EconomyConfig.currencySymbol}${state.pot.toLocaleString()}`);
                embed.addFields({ name: 'Community Cards', value: state.communityCards.map(c => PokerManager.formatCard(c)).join(' ') || 'None' });
                
                let pList = Array.from(state.players.values()).map(p => {
                    if (p.folded) return `❌ ${p.user.username}: *Folded*`;
                    let hand = PokerManager.evaluateHand(p.holeCards, state.communityCards);
                    return `🃏 ${p.user.username}: ${p.holeCards.map(c => PokerManager.formatCard(c)).join(' ')} - **${hand.name}**`;
                }).join('\n');
                embed.addFields({ name: 'Showdown', value: pList });
            } else {
                embed.setDescription(`### 💰 Pot: ${EconomyConfig.currencySymbol}${state.pot.toLocaleString()}`);
                
                let commStr = state.communityCards.length > 0 ? state.communityCards.map(c => PokerManager.formatCard(c)).join(' ') : '*Hidden*';
                embed.addFields({ name: `Community Cards (${state.phase})`, value: commStr });

                let pList = state.activePlayers.map((pid, idx) => {
                    const p = state.players.get(pid);
                    let prefix = idx === state.turnIndex ? '👉 ' : '';
                    let status = p.folded ? '*(Folded)*' : `Bet: ${EconomyConfig.currencySymbol}${p.currentBet.toLocaleString()}`;
                    return `${prefix}${p.user.username} | ${status}`;
                }).join('\n');
                embed.addFields({ name: 'Table', value: pList });
                
                const turnPlayer = state.players.get(state.activePlayers[state.turnIndex]);
                if (turnPlayer) {
                    embed.setFooter({ text: `Waiting on ${turnPlayer.user.username}...` });
                }
            }

            return embed;
        };

        const generateComponents = () => {
            const row = new ActionRowBuilder();
            
            if (state.phase === 'lobby') {
                row.addComponents(
                    new ButtonBuilder().setCustomId('join').setLabel('Join Table').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('start').setLabel('Start Game').setStyle(ButtonStyle.Primary)
                );
            } else if (state.phase !== 'showdown') {
                const turnId = state.activePlayers[state.turnIndex];
                const turnPlayer = state.players.get(turnId);
                const callAmount = state.highestBet - turnPlayer.currentBet;
                
                row.addComponents(
                    new ButtonBuilder().setCustomId('view').setLabel('View Cards').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('fold').setLabel('Fold').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('call').setLabel(callAmount > 0 ? `Call ($${callAmount})` : 'Check').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('raise').setLabel('Raise (+$500)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('allin').setLabel('All-In').setStyle(ButtonStyle.Danger)
                );
            }
            
            return row.components.length > 0 ? [row] : [];
        };

        const message = await interaction.reply({
            embeds: [generateEmbed()],
            components: generateComponents(),
            fetchReply: true
        });
        state.message = message;

        const collector = message.createMessageComponentCollector({ time: 300000 }); // 5 min max

        const advancePhase = async () => {
            // Check if only 1 player remains (everyone else folded)
            const activeCount = state.activePlayers.filter(id => !state.players.get(id).folded).length;
            if (activeCount <= 1) {
                state.phase = 'showdown';
                return handleShowdown();
            }

            if (state.phase === 'preflop') {
                state.phase = 'flop';
                state.communityCards.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
            } else if (state.phase === 'flop') {
                state.phase = 'turn';
                state.communityCards.push(state.deck.pop());
            } else if (state.phase === 'turn') {
                state.phase = 'river';
                state.communityCards.push(state.deck.pop());
            } else if (state.phase === 'river') {
                state.phase = 'showdown';
                return handleShowdown();
            }

            // Reset bets for new round
            state.highestBet = 0;
            state.turnIndex = 0;
            for (let [id, p] of state.players) {
                p.currentBet = 0;
            }

            // Ensure first person hasn't folded
            while (state.turnIndex < state.activePlayers.length && state.players.get(state.activePlayers[state.turnIndex]).folded) {
                state.turnIndex++;
            }

            await state.message.edit({ embeds: [generateEmbed()], components: generateComponents() });
        };

        const nextTurn = async () => {
            // Check if betting round is over
            // Round is over if all non-folded players have bet equal to highestBet
            const activeUnfolded = state.activePlayers.filter(id => !state.players.get(id).folded);
            const allMatched = activeUnfolded.every(id => state.players.get(id).currentBet === state.highestBet);
            
            if (allMatched && state.highestBet > 0) {
                return advancePhase();
            }

            // Move to next player
            state.turnIndex++;
            if (state.turnIndex >= state.activePlayers.length) {
                // If we wrapped around and everyone matched (like everyone checked)
                if (allMatched) return advancePhase();
                state.turnIndex = 0;
            }

            // Skip folded players
            if (state.players.get(state.activePlayers[state.turnIndex]).folded) {
                return nextTurn();
            }

            await state.message.edit({ embeds: [generateEmbed()], components: generateComponents() });
        };

        const handleShowdown = async () => {
            collector.stop();
            
            let bestScore = -1;
            let winners = [];
            
            for (let [id, p] of state.players) {
                if (p.folded) continue;
                let hand = PokerManager.evaluateHand(p.holeCards, state.communityCards);
                if (hand.score > bestScore) {
                    bestScore = hand.score;
                    winners = [id];
                } else if (hand.score === bestScore) {
                    winners.push(id);
                }
            }

            if (winners.length > 0) {
                const splitPot = Math.floor(state.pot / winners.length);
                for (let wid of winners) {
                    await EconomyUtils.addCash(wid, splitPot, 'wallet');
                }
                const winMentions = winners.map(id => `<@${id}>`).join(', ');
                await state.message.reply(`🎉 **SHOWDOWN!** ${winMentions} wins the pot of ${EconomyConfig.currencySymbol}**${state.pot.toLocaleString()}**!`);
            }

            await state.message.edit({ embeds: [generateEmbed()], components: [] });
        };

        collector.on('collect', async i => {
            const userId = i.user.id;

            if (i.customId === 'join') {
                if (state.players.has(userId)) return i.reply({ content: 'You are already at the table.', ephemeral: true });
                if (state.players.size >= 6) return i.reply({ content: 'The table is full!', ephemeral: true });
                
                const profile = await EconomyUtils.getUser(userId);
                if (profile.wallet < state.buyin) return i.reply({ content: `You need ${EconomyConfig.currencySymbol}${state.buyin.toLocaleString()} to join.`, ephemeral: true });

                await EconomyUtils.removeCash(userId, state.buyin, 'wallet');
                state.pot += state.buyin;
                
                state.players.set(userId, {
                    user: i.user,
                    holeCards: [],
                    currentBet: 0,
                    folded: false,
                    allIn: false
                });

                await i.update({ embeds: [generateEmbed()] });
                return;
            }

            if (i.customId === 'start') {
                if (userId !== state.hostId) return i.reply({ content: 'Only the host can start the game.', ephemeral: true });
                if (state.players.size < 2) return i.reply({ content: 'Need at least 2 players to start.', ephemeral: true });

                state.phase = 'preflop';
                state.activePlayers = Array.from(state.players.keys());
                state.deck = PokerManager.createDeck();

                // Deal 2 hole cards to everyone
                for (let [id, p] of state.players) {
                    p.holeCards.push(state.deck.pop(), state.deck.pop());
                }

                await i.update({ embeds: [generateEmbed()], components: generateComponents() });
                return;
            }

            if (i.customId === 'view') {
                if (!state.players.has(userId)) return i.reply({ content: 'You are not playing!', ephemeral: true });
                const p = state.players.get(userId);
                const cardsStr = p.holeCards.map(c => PokerManager.formatCard(c)).join('  ');
                return i.reply({ content: `### Your Hand: ${cardsStr}`, ephemeral: true });
            }

            // From here down, it must be the player's turn
            if (state.activePlayers[state.turnIndex] !== userId) {
                return i.reply({ content: 'It is not your turn!', ephemeral: true });
            }

            const p = state.players.get(userId);

            if (i.customId === 'fold') {
                p.folded = true;
                await i.update({ components: [] });
                return nextTurn();
            }

            if (i.customId === 'call') {
                const callAmount = state.highestBet - p.currentBet;
                if (callAmount > 0) {
                    const profile = await EconomyUtils.getUser(userId);
                    if (profile.wallet < callAmount) {
                        return i.reply({ content: `You don't have enough to call.`, ephemeral: true });
                    }
                    await EconomyUtils.removeCash(userId, callAmount, 'wallet');
                    state.pot += callAmount;
                    p.currentBet += callAmount;
                }
                await i.update({ components: [] });
                return nextTurn();
            }

            if (i.customId === 'raise') {
                const callAmount = state.highestBet - p.currentBet;
                const raiseAmount = callAmount + 500; // Flat 500 raise for simplicity
                
                const profile = await EconomyUtils.getUser(userId);
                if (profile.wallet < raiseAmount) {
                    return i.reply({ content: `You don't have enough to raise.`, ephemeral: true });
                }

                await EconomyUtils.removeCash(userId, raiseAmount, 'wallet');
                state.pot += raiseAmount;
                p.currentBet += raiseAmount;
                state.highestBet = p.currentBet;
                
                await i.update({ components: [] });
                return nextTurn();
            }

            if (i.customId === 'allin') {
                // For simplicity, just pushes remaining wallet balance into pot
                const profile = await EconomyUtils.getUser(userId);
                const allInAmount = profile.wallet;
                if (allInAmount <= 0) return i.reply({ content: 'You have no money to all-in with!', ephemeral: true });

                await EconomyUtils.removeCash(userId, allInAmount, 'wallet');
                state.pot += allInAmount;
                p.currentBet += allInAmount;
                if (p.currentBet > state.highestBet) state.highestBet = p.currentBet;
                
                p.allIn = true;
                await i.update({ components: [] });
                return nextTurn();
            }
        });

        collector.on('end', collected => {
            if (state.phase !== 'showdown') {
                // Game timed out or aborted
                state.message.edit({ components: [] }).catch(() => {});
            }
        });
    }
};
