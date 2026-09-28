const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const http = require('http');

// 1. Mở Port Web Server cho Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Khách Sạn 24/7 đang hoạt động bình thường!');
}).listen(PORT, () => {
    console.log(`🌐 Web Server đã mở tại port ${PORT}`);
});

// Biến môi trường
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MONGO_URI = process.env.MONGO_URI;

mongoose.set('bufferCommands', false);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// 2. Schema Database
const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcome: {
        channelId: String,
        gifUrl: String,
        message: { type: String, default: '**Chào mừng {user} đã đến với server!**\n\n• Kiểm tra thông tin kênh nhé!' }
    },
    welcome2: {
        channelId: String,
        gifUrl: String,
        message: { type: String, default: '**Chào mừng {user} đến với server!**' }
    },
    goodbye: {
        channelId: String,
        gifUrl: String,
        message: { type: String, default: '**Tạm biệt {user}!** 👋\n\nCảm ơn bạn đã ghé thăm.' }
    },
    boost: {
        channelId: String,
        gifUrl: String,
        message: { type: String, default: '🚀 Cảm ơn {user} đã **Boost Server**!\n\n✨ Hiện tại Server đang có **{boosts} Boosts** (Level {level})!' }
    }
});

const Config = mongoose.model('Config', configSchema);

async function getConfig(guildId) {
    if (mongoose.connection.readyState !== 1) return null;
    try {
        let data = await Config.findOne({ guildId });
        if (!data) {
            data = await Config.create({ guildId });
        }
        return data;
    } catch (error) {
        console.error('Lỗi thao tác MongoDB:', error);
        return null;
    }
}

// 3. Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('set-welcome')
        .setDescription('👑 [Owner Only] Cài đặt Welcome chính')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh gửi Welcome').setRequired(true))
        .addStringOption(opt => opt.setName('gif').setDescription('Link GIF Welcome').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung ({user})').setRequired(false)),

    new SlashCommandBuilder()
        .setName('set-welcome2')
        .setDescription('👑 [Owner Only] Cài đặt Welcome thứ 2 (Chỉ cần gửi nội dung)')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh gửi Welcome 2').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung ({user})').setRequired(true))
        .addStringOption(opt => opt.setName('gif').setDescription('Link GIF (Tùy chọn, không bắt buộc)').setRequired(false)),

    new SlashCommandBuilder()
        .setName('set-goodbye')
        .setDescription('👑 [Owner Only] Cài đặt Goodbye')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh gửi Goodbye').setRequired(true))
        .addStringOption(opt => opt.setName('gif').setDescription('Link GIF Goodbye').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung ({user})').setRequired(false)),

    new SlashCommandBuilder()
        .setName('set-boost')
        .setDescription('👑 [Owner Only] Cài đặt Boost')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh gửi thông báo Boost').setRequired(true))
        .addStringOption(opt => opt.setName('gif').setDescription('Link GIF Boost').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung ({user}, {boosts}, {level})').setRequired(false)),

    new SlashCommandBuilder()
        .setName('test-welcome')
        .setDescription('👑 [Owner Only] Xem trước tin nhắn Welcome chính'),

    new SlashCommandBuilder()
        .setName('test-welcome2')
        .setDescription('👑 [Owner Only] Xem trước tin nhắn Welcome thứ 2'),

    new SlashCommandBuilder()
        .setName('test-goodbye')
        .setDescription('👑 [Owner Only] Xem trước tin nhắn Goodbye'),

    new SlashCommandBuilder()
        .setName('test-boost')
        .setDescription('👑 [Owner Only] Xem trước tin nhắn Boost Server')
];

function createEmbed(text, gifUrl, member, color = '#2B2D31') {
    const guild = member.guild;
    const totalBoosts = guild.premiumSubscriptionCount || 0;
    const boostLevel = guild.premiumTier;

    const formattedText = text
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{boosts}/g, totalBoosts.toString())
        .replace(/{level}/g, boostLevel.toString());
    
    const embed = new EmbedBuilder()
        .setDescription(formattedText)
        .setColor(color);

    if (gifUrl) {
        embed.setImage(gifUrl);
    }
    
    return embed;
}

// 4. Xử lý Interaction
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
        return interaction.editReply({ content: '❌ Lệnh này chỉ dành riêng cho **Chủ Bot**!' });
    }

    const { commandName, options, member, guildId } = interaction;
    const db = await getConfig(guildId);

    if (!db) {
        return interaction.editReply({ content: '❌ MongoDB chưa kết nối xong! Vui lòng thử lại sau vài giây.' });
    }

    try {
        if (commandName === 'set-welcome') {
            db.welcome.channelId = options.getChannel('channel').id;
            db.welcome.gifUrl = options.getString('gif');
            if (options.getString('message')) db.welcome.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Welcome chính tại <#${db.welcome.channelId}>!` });
        }

        else if (commandName === 'set-welcome2') {
            db.welcome2.channelId = options.getChannel('channel').id;
            db.welcome2.message = options.getString('message');
            db.welcome2.gifUrl = options.getString('gif') || null;
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Welcome thứ 2 tại <#${db.welcome2.channelId}>!` });
        }

        else if (commandName === 'set-goodbye') {
            db.goodbye.channelId = options.getChannel('channel').id;
            db.goodbye.gifUrl = options.getString('gif');
            if (options.getString('message')) db.goodbye.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Goodbye tại <#${db.goodbye.channelId}>!` });
        }

        else if (commandName === 'set-boost') {
            db.boost.channelId = options.getChannel('channel').id;
            db.boost.gifUrl = options.getString('gif');
            if (options.getString('message')) db.boost.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Boost tại <#${db.boost.channelId}>!` });
        }

        else if (commandName === 'test-welcome') {
            if (!db.welcome.gifUrl) return interaction.editReply({ content: '❌ Hãy cài `/set-welcome` trước!' });
            const embed = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
            await interaction.editReply({ content: '🧪 **Bản xem trước Welcome 1:**', embeds: [embed] });
        }

        else if (commandName === 'test-welcome2') {
            if (!db.welcome2.message) return interaction.editReply({ content: '❌ Hãy cài `/set-welcome2` trước!' });
            const embed = createEmbed(db.welcome2.message, db.welcome2.gifUrl, member);
            await interaction.editReply({ content: '🧪 **Bản xem trước Welcome 2:**', embeds: [embed] });
        }

        else if (commandName === 'test-goodbye') {
            if (!db.goodbye.gifUrl) return interaction.editReply({ content: '❌ Hãy cài `/set-goodbye` trước!' });
            const embed = createEmbed(db.goodbye.message, db.goodbye.gifUrl, member);
            await interaction.editReply({ content: '🧪 **Bản xem trước Goodbye:**', embeds: [embed] });
        }

        else if (commandName === 'test-boost') {
            if (!db.boost.gifUrl) return interaction.editReply({ content: '❌ Hãy cài `/set-boost` trước!' });
            const embed = createEmbed(db.boost.message, db.boost.gifUrl, member, '#F47FFF');
            await interaction.editReply({ content: '🧪 **Bản xem trước Boost:**', embeds: [embed] });
        }
    } catch (err) {
        console.error('Lỗi khi thực hiện lệnh:', err);
        await interaction.editReply({ content: '❌ Có lỗi xảy ra khi cập nhật Database!' });
    }
});

// Auto Events
client.on('guildMemberAdd', async (member) => {
    const db = await getConfig(member.guild.id);
    if (!db) return;

    // Gửi Welcome 1
    if (db.welcome && db.welcome.channelId) {
        const channel1 = member.guild.channels.cache.get(db.welcome.channelId);
        if (channel1) {
            const embed1 = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
            await channel1.send({ embeds: [embed1] });
        }
    }

    // Gửi Welcome 2 (Chỉ cần có message)
    if (db.welcome2 && db.welcome2.channelId && db.welcome2.message) {
        const channel2 = member.guild.channels.cache.get(db.welcome2.channelId);
        if (channel2) {
            const embed2 = createEmbed(db.welcome2.message, db.welcome2.gifUrl, member);
            await channel2.send({ embeds: [embed2] });
        }
    }
});

client.on('guildMemberRemove', async (member) => {
    const db = await getConfig(member.guild.id);
    if (!db || !db.goodbye.channelId) return;
    const channel = member.guild.channels.cache.get(db.goodbye.channelId);
    if (!channel) return;

    const embed = createEmbed(db.goodbye.message, db.goodbye.gifUrl, member);
    await channel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const db = await getConfig(newMember.guild.id);
    if (!db || !db.boost.channelId) return;

    const oldStatus = oldMember.premiumSince;
    const newStatus = newMember.premiumSince;

    if (!oldStatus && newStatus) {
        const channel = newMember.guild.channels.cache.get(db.boost.channelId);
        if (!channel) return;

        const embed = createEmbed(db.boost.message, db.boost.gifUrl, newMember, '#F47FFF');
        await channel.send({ content: `🚀 🎉 <@${newMember.id}> vừa boost server!`, embeds: [embed] });
    }
});

// 5. Khởi chạy
async function start() {
    if (!MONGO_URI) return console.error('❌ Thiếu MONGO_URI!');
    if (!BOT_TOKEN) return console.error('❌ Thiếu DISCORD_TOKEN!');

    try {
        console.log('⏳ Đang kết nối MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('🍃 Đã kết nối thành công MongoDB!');

        client.once('ready', async () => {
            console.log(`🤖 Bot đã chạy: ${client.user.tag}`);
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            try {
                await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
                console.log('✅ Đã đăng ký Slash Commands thành công!');
            } catch (err) {
                console.error('Lỗi đăng ký Slash Commands:', err);
            }
        });

        await client.login(BOT_TOKEN);
    } catch (err) {
        console.error('❌ Lỗi kết nối MongoDB:', err.message);
    }
}

start();
