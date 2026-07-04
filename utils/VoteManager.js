const { ContainerBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ComponentUtils = require('./ComponentUtils');

module.exports = {
    /**
     * @typedef {Object} VoteOptions
     * @property {string} title The title of the vote container
     * @property {string} description The description markdown for the vote container
     * @property {number} requiredPercentage The decimal percentage (e.g. 0.75) required to pass
     * @property {number} duration The duration in ms
     * @property {boolean} requireOnline If true, calculates requirements based on online users and blocks offline users from voting
     * @property {number} [fixedRequiredVotes] If set, overrides percentage-based required votes
     * @property {string} [targetId] The ID of the targeted user (to prevent self-voting)
     * @property {string} [pingType] 'here', 'everyone', or 'none' (defaults to 'here')
     * @property {string} [yesLabel] Label for the Yes button (defaults to 'Yes')
     * @property {string} [noLabel] Label for the No button (defaults to 'No')
     * @property {string} [yesEmoji] Emoji for the Yes button
     * @property {string} [noEmoji] Emoji for the No button
     * @property {Function} [customValidate] Custom validation function that returns an error string if validation fails
     */

    /**
     * Starts a standard V2 vote and returns the results.
     * @param {Object} interaction The command interaction
     * @param {VoteOptions} options Configuration options
     * @returns {Promise<{passed: boolean, yesVotes: Set<string>, noVotes: Set<string>, requiredVotes: number, onlineCount: number, message: Object}|null>}
     */
    startVote: async (interaction, options) => {
        const {
            title,
            description,
            requiredPercentage = 0.5,
            duration = 60000,
            requireOnline = false,
            fixedRequiredVotes = null,
            targetId = null,
            pingType = 'here',
            yesLabel = 'Yes',
            noLabel = 'No',
            yesEmoji = null,
            noEmoji = null,
            customValidate = null
        } = options;

        await interaction.guild.members.fetch();
        
        let onlineCount = 0;
        if (requireOnline) {
            const onlineMembers = interaction.guild.members.cache.filter(member => {
                if (member.user.bot) return false;
                const status = member.presence?.status ?? 'offline';
                return status !== 'offline';
            });
            onlineCount = onlineMembers.size;
        } else {
            const allMembers = interaction.guild.members.cache.filter(member => !member.user.bot);
            onlineCount = allMembers.size;
        }

        const requiredVotes = fixedRequiredVotes !== null ? fixedRequiredVotes : Math.ceil(onlineCount * requiredPercentage);

        if (requireOnline && onlineCount < 2) {
            await interaction.reply(ComponentUtils.createError('Not enough online users to start a vote.'));
            return null;
        }

        const voteDurationString = `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`;
        
        const buildContainer = (yesSet, noSet) => {
            const titleDisplay = ComponentUtils.createText(`### ${title}`);
            const descLines = [];
            descLines.push(description, '\n');
            descLines.push(`*Required Votes to win:* ***${requiredVotes}***\n`);
            if (requireOnline) {
                descLines.push(`*Online Members:* **${onlineCount}**\n`);
            } else {
                descLines.push(`*Members:* **${onlineCount}**\n`);
            }
            descLines.push(`**Voting ends** ${voteDurationString}`);

            const descDisplay = ComponentUtils.createText(descLines.join(''));
            const yesDisplay = ComponentUtils.createText(`**${yesLabel}**\n${yesSet.size}`);
            const noDisplay = ComponentUtils.createText(`**${noLabel}**\n${noSet.size}`);

            const yesButton = new ButtonBuilder().setCustomId('vote_yes').setLabel(yesLabel).setStyle(ButtonStyle.Success);
            if (yesEmoji) yesButton.setEmoji(yesEmoji);

            const noButton = new ButtonBuilder().setCustomId('vote_no').setLabel(noLabel).setStyle(ButtonStyle.Danger);
            if (noEmoji) noButton.setEmoji(noEmoji);

            const row = new ActionRowBuilder().addComponents(
                yesButton,
                noButton,
                new ButtonBuilder().setCustomId('vote_list').setLabel('Votes').setStyle(ButtonStyle.Secondary)
            );

            const container = new ContainerBuilder()
                .setAccentColor(0xf1c40f)
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(yesDisplay, noDisplay)
                .addActionRowComponents(row);

            return { container, row };
        };

        const yesVotes = new Set();
        const noVotes = new Set();

        if (pingType === 'everyone' || pingType === 'here') {
            const pingStr = pingType === 'everyone' ? '@everyone' : '@here';
            try {
                await interaction.channel.send({ content: `${pingStr} A new vote has started!`, allowedMentions: { parse: ['everyone'] } });
            } catch (e) {}
        }
        
        const { container } = buildContainer(yesVotes, noVotes);
        const payload = ComponentUtils.createContainerResponse(container);
        const message = await interaction.reply({ ...payload, fetchReply: true });

        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({ time: duration });

            collector.on('collect', async buttonInteraction => {
                if (buttonInteraction.customId === 'vote_list') {
                    const yesUsers = [...yesVotes].map(id => `<@${id}>`).join('\n') || '*Nobody*';
                    const noUsers = [...noVotes].map(id => `<@${id}>`).join('\n') || '*Nobody*';

                    const votesContainer = new ContainerBuilder()
                        .setAccentColor(0x95a5a6)
                        .addTextDisplayComponents(ComponentUtils.createText(`### 📊 **Current Votes**`))
                        .addSeparatorComponents(ComponentUtils.createSeparator())
                        .addTextDisplayComponents(ComponentUtils.createText(`**✅ ${yesLabel} (${yesVotes.size})**\n${yesUsers}`))
                        .addSeparatorComponents(ComponentUtils.createSeparator())
                        .addTextDisplayComponents(ComponentUtils.createText(`**❌ ${noLabel} (${noVotes.size})**\n${noUsers}`));

                    return buttonInteraction.reply({
                        ...ComponentUtils.createContainerResponse(votesContainer),
                        ephemeral: true
                    });
                }

                if (customValidate) {
                    const validationError = await customValidate(buttonInteraction);
                    if (validationError) {
                        return buttonInteraction.reply(ComponentUtils.createError(validationError));
                    }
                }

                if (targetId && buttonInteraction.user.id === targetId) {
                    return buttonInteraction.reply(ComponentUtils.createError('You cannot vote on yourself!'));
                }

                if (requireOnline) {
                    const member = await interaction.guild.members.fetch(buttonInteraction.user.id);
                    const status = member.presence?.status ?? 'offline';
                    if (status === 'offline') {
                        return buttonInteraction.reply(ComponentUtils.createError('You cannot vote while appearing offline.'));
                    }
                }

                if (buttonInteraction.customId !== 'vote_yes' && buttonInteraction.customId !== 'vote_no') {
                    return;
                }

                const userId = buttonInteraction.user.id;
                yesVotes.delete(userId);
                noVotes.delete(userId);

                if (buttonInteraction.customId === 'vote_yes') {
                    yesVotes.add(userId);
                } else {
                    noVotes.add(userId);
                }

                const updatedLayout = buildContainer(yesVotes, noVotes);
                await buttonInteraction.update(ComponentUtils.createContainerResponse(updatedLayout.container));
            });

            collector.on('end', async () => {
                const passed = yesVotes.size >= requiredVotes;
                resolve({ passed, yesVotes, noVotes, requiredVotes, onlineCount, message });
            });
        });
    },

    /**
     * Resolves a vote message into a final pass/fail state.
     * @param {Object} message The message object returned by startVote
     * @param {Object} options Configuration options
     * @param {boolean} options.passed Whether the vote passed or failed
     * @param {string} options.title The title of the result container
     * @param {string} options.description The description Markdown
     * @param {Set<string>} options.yesVotes The final Yes votes
     * @param {Set<string>} options.noVotes The final No votes
     * @param {number} options.requiredVotes The final required votes
     */
    displayResult: async (message, { passed, title, description, yesVotes, noVotes, requiredVotes }) => {
        const titleDisplay = ComponentUtils.createText(`### ${passed ? '✅' : '❌'} **${title}**`);
        const descText = [
            description,
            `> Yes: **${yesVotes.size}**`,
            `> No: **${noVotes.size}**`,
            `> Required Votes to win: **${requiredVotes}**`
        ].join('\n');
        
        const descDisplay = ComponentUtils.createText(descText);

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vote_yes').setLabel('Yes').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('vote_no').setLabel('No').setStyle(ButtonStyle.Danger).setDisabled(true),
            new ButtonBuilder().setCustomId('vote_list').setLabel('Votes').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        const resultContainer = new ContainerBuilder()
            .setAccentColor(passed ? 0x2ecc71 : 0xe74c3c)
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(descDisplay)
            .addActionRowComponents(disabledRow);

        await message.edit(ComponentUtils.createContainerResponse(resultContainer));
    }
};
