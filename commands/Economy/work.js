const { SlashCommandBuilder, ContainerBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextDisplayBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

const MINIGAME_WORDS = ["APPLE", "TIGER", "OCEAN", "CLOUD", "BREAD", "RIVER", "CHAIR", "GHOST", "PIZZA", "SNAKE", "HOUSE", "FLAME", "TRAIN", "PAPER", "BLADE"];
const MINIGAME_COLORS = [
    { name: "Red", style: ButtonStyle.Danger, emoji: "🟥" },
    { name: "Blue", style: ButtonStyle.Primary, emoji: "🟦" },
    { name: "Green", style: ButtonStyle.Success, emoji: "🟩" },
    { name: "Grey", style: ButtonStyle.Secondary, emoji: "⬜" }
];

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Job and career commands.')
        .addSubcommand(subcommand =>
            subcommand.setName('apply')
                .setDescription('Apply for a new job.')
                .addStringOption(option => 
                    option.setName('job')
                        .setDescription('The job you want to apply for')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('shift')
                .setDescription('Work your current job shift to earn your salary.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all available jobs and their requirements.')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('quit')
                .setDescription('Quit your current job (1 hour cooldown before reapplying).')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('stats')
                .setDescription('View your career statistics and current job details.')
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        let userData = await EconomyUtils.getUser(interaction.user.id);
        let choices = [];

        for (const [jobId, jobConfig] of Object.entries(EconomyConfig.jobs)) {
            // Only show jobs they have unlocked
            if (userData.totalShiftsWorked >= jobConfig.requiredShifts) {
                choices.push({ name: jobConfig.name, value: jobId });
            }
        }

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply();

        let userData = await EconomyUtils.getUser(interaction.user.id);

        if (subcommand === 'apply') {
            await this.handleApply(interaction, userData);
        } else if (subcommand === 'shift') {
            await this.handleShift(interaction, userData);
        } else if (subcommand === 'list') {
            await this.handleList(interaction, userData);
        } else if (subcommand === 'quit') {
            await this.handleQuit(interaction, userData);
        } else if (subcommand === 'stats') {
            await this.handleStats(interaction, userData);
        }
    },

    async handleApply(interaction, userData) {
        if (userData.currentJob) {
            return interaction.followUp(ComponentUtils.createError(`You already have a job! Use \`/work quit\` to leave your current position as a **${EconomyConfig.jobs[userData.currentJob].name}** first.`));
        }

        if (userData.jobApplyCooldown && Date.now() < userData.jobApplyCooldown.getTime()) {
            return interaction.followUp(ComponentUtils.createError(`You are on an application cooldown! You must wait until <t:${Math.floor(userData.jobApplyCooldown.getTime() / 1000)}:t> to apply again.`));
        }

        const jobInput = interaction.options.getString('job').toLowerCase();
        const jobConfig = EconomyConfig.jobs[jobInput];

        if (!jobConfig) {
            return interaction.followUp(ComponentUtils.createError(`That job does not exist!`));
        }

        if (userData.totalShiftsWorked < jobConfig.requiredShifts) {
            return interaction.followUp(ComponentUtils.createError(`You need to have worked at least **${jobConfig.requiredShifts}** total shifts in your career to apply for this job!`));
        }

        // 75% success chance
        const success = Math.random() < 0.75;
        if (success) {
            userData.currentJob = jobInput;
            userData.lastShift = null;
            await userData.save();
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x2ecc71)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎉 Congratulations! You passed the interview and are now officially hired as a **${jobConfig.name}**! Use \`/work shift\` to start earning money.`));
            return interaction.followUp(ComponentUtils.createContainerResponse(successContainer));
        } else {
            userData.jobApplyCooldown = new Date(Date.now() + 60 * 60 * 1000); // 1 hour cooldown
            await userData.save();
            return interaction.followUp(ComponentUtils.createError(`❌ The interview did not go well. They decided to go with another candidate. You must wait **1 Hour** before you can apply for a job again.`));
        }
    },

    async handleQuit(interaction, userData) {
        if (!userData.currentJob) {
            return interaction.followUp(ComponentUtils.createError(`You don't currently have a job to quit!`));
        }

        const oldJobName = EconomyConfig.jobs[userData.currentJob].name;
        
        userData.currentJob = null;
        userData.jobApplyCooldown = new Date(Date.now() + 60 * 60 * 1000); // 1 hour cooldown
        await userData.save();

        const quitContainer = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You slammed your resignation letter on the boss's desk and quit your job as a **${oldJobName}**! You must wait **1 Hour** before you can apply for a new job.`));
        return interaction.followUp(ComponentUtils.createContainerResponse(quitContainer));
    },

    async handleStats(interaction, userData) {
        const currentJobConfig = userData.currentJob ? EconomyConfig.jobs[userData.currentJob] : null;
        
        let nextUnlock = null;
        let lowestReq = Infinity;
        for (const [jobId, config] of Object.entries(EconomyConfig.jobs)) {
            if (config.requiredShifts > userData.totalShiftsWorked && config.requiredShifts < lowestReq) {
                lowestReq = config.requiredShifts;
                nextUnlock = config;
            }
        }

        const titleDisplay = ComponentUtils.createText(`### 📊 **Career Statistics for ${interaction.user.username}**`);
        
        let statsText = `**Current Job:** ${currentJobConfig ? currentJobConfig.name : 'Unemployed'}\n`;
        if (currentJobConfig) {
            statsText += `**Salary:** ${EconomyConfig.currencySymbol}${currentJobConfig.salary.toLocaleString()} per shift\n`;
        }
        
        statsText += `\n**Total Shifts Worked:** ${userData.totalShiftsWorked.toLocaleString()}\n`;
        
        if (nextUnlock) {
            const shiftsNeeded = nextUnlock.requiredShifts - userData.totalShiftsWorked;
            statsText += `**Next Promotion:** ${nextUnlock.name} (in ${shiftsNeeded} shifts)\n`;
        } else {
            statsText += `**Next Promotion:** Max level reached!\n`;
        }

        if (userData.jobApplyCooldown && userData.jobApplyCooldown > new Date()) {
            const timeStr = `<t:${Math.floor(userData.jobApplyCooldown.getTime() / 1000)}:R>`;
            statsText += `\n**Job Apply Cooldown Ends:** ${timeStr}`;
        }

        const descDisplay = ComponentUtils.createText(`-# ${statsText}`);

        const container = new ContainerBuilder()
            .setAccentColor(EconomyConfig.embedColor)
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(descDisplay);

        return interaction.followUp(ComponentUtils.createContainerResponse(container));
    },

    async handleList(interaction, userData) {
        const jobs = Object.entries(EconomyConfig.jobs);
        const pageSize = 4;
        const totalPages = Math.ceil(jobs.length / pageSize);
        
        // Pagination logic here
        let currentPage = 0;
        
        const generatePage = (pageIndex) => {
            const start = pageIndex * pageSize;
            const end = start + pageSize;
            const pageJobs = jobs.slice(start, end);
            
            const titleDisplay = ComponentUtils.createText(`### 💼 Available Jobs\nJobs with ❌ next to them are locked.`);
            let lines = [];
            
            for (const [id, config] of pageJobs) {
                const isUnlocked = userData.totalShiftsWorked >= config.requiredShifts;
                const statusIcon = isUnlocked ? '✅' : '❌';
                
                lines.push(`${statusIcon} **${config.name}**`);
                lines.push(`${EconomyConfig.ReplyIcon} Shifts Required Per Day: \`${config.shiftsPerDay}\``);
                lines.push(`${EconomyConfig.ReplyIcon} Time Between Shifts: \`${Math.floor(config.cooldown / 60000)}m\``);
                lines.push(`${EconomyConfig.ReplyIcon} Total Shifts Required To Unlock: \`${config.requiredShifts}\``);
                lines.push(`${EconomyConfig.ReplyIcon} Salary: ${EconomyConfig.currencySymbol} \`${config.salary.toLocaleString()} per shift\``);
                lines.push('');
            }
            
            lines.push(`**Page ${pageIndex + 1} of ${totalPages}**`);
            
            const descDisplay = ComponentUtils.createText(lines.join('\n'));
            const container = new ContainerBuilder()
                .setAccentColor(EconomyConfig.embedColor)
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);
                
            return container;
        };

        const getRow = (pageIndex) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('work_list_first')
                    .setEmoji('1521618283034579075') // StartArrow
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('work_list_prev')
                    .setEmoji('1521618280194900108') // BackwardArrow
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('work_list_next')
                    .setEmoji('1521618281780478012') // ForwardArrow
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('work_list_last')
                    .setEmoji('1521618284133486792') // LastArrow
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === totalPages - 1)
            );
        };

        const responsePayload = ComponentUtils.createContainerResponse(generatePage(currentPage));
        responsePayload.components.push(getRow(currentPage));
        
        const message = await interaction.followUp({ ...responsePayload, fetchReply: true });

        const collector = message.createMessageComponentCollector({ time: 300000 }); // 5 min timeout
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply(ComponentUtils.createError('This menu is not for you!'));
            }
            
            if (i.customId === 'work_list_first') currentPage = 0;
            if (i.customId === 'work_list_prev') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'work_list_next') currentPage = Math.min(totalPages - 1, currentPage + 1);
            if (i.customId === 'work_list_last') currentPage = totalPages - 1;

            const updatedPayload = ComponentUtils.createContainerResponse(generatePage(currentPage));
            updatedPayload.components.push(getRow(currentPage));
            
            await i.update(updatedPayload);
        });
        
        collector.on('end', () => {
            const disabledRow = getRow(currentPage);
            disabledRow.components.forEach(c => c.setDisabled(true));
            const finalPayload = ComponentUtils.createContainerResponse(generatePage(currentPage));
            finalPayload.components.push(disabledRow);
            message.edit(finalPayload).catch(() => {});
        });
    },

    async handleShift(interaction, userData) {
        if (!userData.currentJob) {
            return interaction.followUp(ComponentUtils.createError(`You don't have a job! Use \`/work list\` to see available jobs and \`/work apply\` to get hired.`));
        }

        const jobConfig = EconomyConfig.jobs[userData.currentJob];
        const settings = await EconomyUtils.getSettings();
        
        const globalMultiplier = settings.cooldownMultiplier || 1.0;
        const userMultiplier = userData.cooldownMultiplier || 1.0;
        const actualCooldown = jobConfig.cooldown * globalMultiplier * userMultiplier;

        if (userData.lastShift && Date.now() - userData.lastShift.getTime() < actualCooldown) {
            const nextShiftTime = Math.floor((userData.lastShift.getTime() + actualCooldown) / 1000);
            return interaction.followUp(ComponentUtils.createError(`You can work again at <t:${nextShiftTime}:t> (<t:${nextShiftTime}:R>).`));
        }

        // Generate Minigame
        const minigameType = Math.random() > 0.5 ? 1 : 2;
        let wonMinigame = false;

        if (minigameType === 1) {
            wonMinigame = await this.playMemoryOrderMinigame(interaction, jobConfig);
        } else {
            wonMinigame = await this.playColorMatchMinigame(interaction, jobConfig);
        }

        // Update shift count and cooldown regardless of success/fail
        userData = await EconomyUtils.getUser(interaction.user.id);
        userData.lastShift = new Date();
        userData.totalShiftsWorked += 1;

        if (wonMinigame) {
            const salaryResult = await EconomyUtils.calculateMoney(jobConfig.salary, interaction.user.id);
            await EconomyUtils.addCash(interaction.user.id, salaryResult.finalAmount, 'bank');
            await userData.save();

            let bonusText = '';
            if (salaryResult.multiplier > 1) {
                const bonus = salaryResult.finalAmount - jobConfig.salary;
                bonusText = `\n-# 💸 Money Multiplier: ${salaryResult.multiplier}x (+ ${bonus.toLocaleString()})`;
            }

            const shiftContainer = new ContainerBuilder()
                .setAccentColor(0x2ecc71)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎩 **Shift Completed!**\nYou finished your shift as a **${jobConfig.name}** and got paid ${EconomyConfig.currencySymbol}**${salaryResult.finalAmount.toLocaleString()}**!${bonusText}`));
            return interaction.editReply(ComponentUtils.createContainerResponse(shiftContainer));
        } else {
            await userData.save();
            return interaction.editReply(ComponentUtils.createError(`❌ **Shift Failed!**\nYou completely messed up your tasks as a **${jobConfig.name}** and your boss refused to pay you. Better luck next shift!`));
        }
    },

    async playMemoryOrderMinigame(interaction, jobConfig) {
        // Select 5 random words
        let shuffledWords = shuffleArray(MINIGAME_WORDS).slice(0, 5);
        
        let displayList = shuffledWords.map(w => `> **${w}**`).join('\n');
        
        const container = new ContainerBuilder()
            .setAccentColor(EconomyConfig.embedColor)
            .addTextDisplayComponents(ComponentUtils.createText(`### 🧠 Memory Minigame\nMemorize the exact order of these 5 words. You have **3 seconds**...\n\n${displayList}`));
            
        await interaction.editReply(ComponentUtils.createContainerResponse(container));
        
        // Wait 3 seconds
        await new Promise(r => setTimeout(r, 3000));

        // Create 5 buttons in a shuffled order for them to click
        let buttonWords = shuffleArray(shuffledWords);
        
        const row = new ActionRowBuilder();
        for (const w of buttonWords) {
            row.addComponents(new ButtonBuilder().setCustomId(`mem_${w}`).setLabel(w).setStyle(ButtonStyle.Secondary));
        }

        const activeContainer = new ContainerBuilder()
            .setAccentColor(EconomyConfig.embedColor)
            .addTextDisplayComponents(ComponentUtils.createText(`### 🧠 Memory Minigame\nClick the buttons in the **exact original order** they were shown!`));

        const activePayload = ComponentUtils.createContainerResponse(activeContainer);
        activePayload.components.push(row);
        
        const message = await interaction.editReply(activePayload);

        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({ time: 30000 });
            let currentStep = 0;
            let currentButtons = [...buttonWords];

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply(ComponentUtils.createError('This minigame is not for you!'));
                }

                const wordClicked = i.customId.replace('mem_', '');
                if (wordClicked === shuffledWords[currentStep]) {
                    // Correct!
                    currentStep++;
                    
                    // Disable the button they just clicked
                    const newRow = new ActionRowBuilder();
                    for (const w of currentButtons) {
                        const btn = new ButtonBuilder().setCustomId(`mem_${w}`).setLabel(w).setStyle(ButtonStyle.Secondary);
                        if (shuffledWords.slice(0, currentStep).includes(w)) {
                            btn.setDisabled(true);
                            btn.setStyle(ButtonStyle.Success);
                        }
                        newRow.addComponents(btn);
                    }

                    const updatedPayload = ComponentUtils.createContainerResponse(activeContainer);
                    updatedPayload.components.push(newRow);

                    if (currentStep >= 5) {
                        collector.stop('win');
                        await i.update(updatedPayload);
                    } else {
                        await i.update(updatedPayload);
                    }
                } else {
                    // Wrong!
                    collector.stop('lose');
                    // Show them the failure visually
                    const newRow = new ActionRowBuilder();
                    for (const w of currentButtons) {
                        const btn = new ButtonBuilder().setCustomId(`mem_${w}`).setLabel(w).setStyle(ButtonStyle.Secondary);
                        if (w === wordClicked) {
                            btn.setStyle(ButtonStyle.Danger);
                            btn.setDisabled(true);
                        } else if (shuffledWords.slice(0, currentStep).includes(w)) {
                            btn.setStyle(ButtonStyle.Success);
                            btn.setDisabled(true);
                        } else {
                            btn.setDisabled(true);
                        }
                        newRow.addComponents(btn);
                    }
                    const failedPayload = ComponentUtils.createContainerResponse(activeContainer);
                    failedPayload.components.push(newRow);
                    await i.update(failedPayload);
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'win') resolve(true);
                else resolve(false);
            });
        });
    },

    async playColorMatchMinigame(interaction, jobConfig) {
        let shuffledWords = shuffleArray(MINIGAME_WORDS).slice(0, 3);
        let shuffledColors = shuffleArray(MINIGAME_COLORS).slice(0, 3);
        
        let pairs = [];
        let displayList = [];
        for (let i = 0; i < 3; i++) {
            pairs.push({ word: shuffledWords[i], color: shuffledColors[i] });
            displayList.push(`> ${shuffledColors[i].emoji} \`${shuffledColors[i].name}\` - **${shuffledWords[i]}**`);
        }

        const container = new ContainerBuilder()
            .setAccentColor(EconomyConfig.embedColor)
            .addTextDisplayComponents(ComponentUtils.createText(`### 🎨 Color Minigame\nMemorize which word belongs to which color. You have **5 seconds**...\n\n${displayList.join('\n')}`));
            
        await interaction.editReply(ComponentUtils.createContainerResponse(container));
        
        // Wait 3 seconds
        await new Promise(r => setTimeout(r, 5000));

        // Pick 1 random target word
        const targetPair = pairs[Math.floor(Math.random() * pairs.length)];

        // Generate Buttons (using the 4 possible colors to make it slightly trickier, or just the 3 they saw)
        let buttonColors = shuffleArray(shuffledColors);
        const row = new ActionRowBuilder();
        for (const c of buttonColors) {
            row.addComponents(new ButtonBuilder().setCustomId(`color_${c.name}`).setLabel(c.name).setStyle(c.style));
        }
        const activeContainer = new ContainerBuilder()
            .setAccentColor(EconomyConfig.embedColor)
            .addTextDisplayComponents(ComponentUtils.createText(`### 🎨 Color Minigame\nWhich color was paired with the word **${targetPair.word}**?`));

        const activePayload = ComponentUtils.createContainerResponse(activeContainer);
        activePayload.components.push(row);
        
        const message = await interaction.editReply(activePayload);

        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({ time: 15000, max: 1 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply(ComponentUtils.createError('This minigame is not for you!'));
                }

                const colorClicked = i.customId.replace('color_', '');
                if (colorClicked === targetPair.color.name) {
                    await i.deferUpdate();
                    resolve(true);
                } else {
                    await i.deferUpdate();
                    resolve(false);
                }
            });

            collector.on('end', (collected, reason) => {
                if (collected.size === 0) resolve(false);
            });
        });
    }
};
