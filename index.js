const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MONGO_URI = process.env.MONGO_URI;

// Tắt buffering để tránh bị treo lệnh khi DB gián đoạn
mongoose.set('bufferCommands', false);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Schema Database
const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcome: {
        channelId: String,
        gifUrl: String,
        message: { type: String, default: '**Chào mừng {user} đã đến với server!**\n\n• Kiểm tra thông tin kênh nhé!' }
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

// Hàm lấy dữ liệu an toàn
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

// Danh sách Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('set-welcome')
        .setDescription('👑 [Owner Only] Cài đặt Welcome')
        .addChannelOption(opt => opt.setName('channel').setDescription('Kênh gửi Welcome').setRequired(true))
        .addStringOption(opt => opt.setName('gif').setDescription('Link GIF Welcome').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Nội dung ({user})').setRequired(false)),

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
        .setDescription('👑 [Owner Only] Xem trước tin nhắn Welcome'),

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
    
    return new EmbedBuilder()
        .setDescription(formattedText)
        .setColor(color)
        .setImage(gifUrl || null);
}

// Xử lý tất cả các Interaction
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Phản hồi ngay lập tức để Discord không báo lỗi "không phản hồi"
    await interaction.deferReply({ ephemeral: true });

    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
        return interaction.editReply({ content: '❌ Lệnh này chỉ dành riêng cho **Chủ Bot**!' });
    }

    const { commandName, options, member, guildId } = interaction;
    const db = await getConfig(guildId);

    if (!db) {
        return interaction.editReply({ content: '❌ MongoDB chưa kết nối xong hoặc gặp lỗi. Vui lòng kiểm tra lại biến `MONGO_URI` trên Render!' });
    }

    try {
        if (commandName === 'set-welcome') {
            db.welcome.channelId = options.getChannel('channel').id;
            db.welcome.gifUrl = options.getString('gif');
            if (options.getString('message')) db.welcome.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Welcome vĩnh viễn tại <#${db.welcome.channelId}>!` });
        }

        else if (commandName === 'set-goodbye') {
            db.goodbye.channelId = options.getChannel('channel').id;
            db.goodbye.gifUrl = options.getString('gif');
            if (options.getString('message')) db.goodbye.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Goodbye vĩnh viễn tại <#${db.goodbye.channelId}>!` });
        }

        else if (commandName === 'set-boost') {
            db.boost.channelId = options.getChannel('channel').id;
            db.boost.gifUrl = options.getString('gif');
            if (options.getString('message')) db.boost.message = options.getString('message');
            await db.save();
            await interaction.editReply({ content: `✅ Đã lưu cài đặt Boost vĩnh viễn tại <#${db.boost.channelId}>!` });
        }

        else if (commandName === 'test-welcome') {
            if (!db.welcome.gifUrl) return interaction.editReply({ content: '❌ Hãy cài `/set-welcome` trước!' });
            const embed = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
            await interaction.editReply({ content: '🧪 **Bản xem trước Welcome:**', embeds: [embed] });
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
        console.error('Lỗi khi chạy lệnh:', err);
        await interaction.editReply({ content: '❌ Có lỗi xảy ra khi lưu vào Database!' });
    }
});

// Auto Events
client.on('guildMemberAdd', async (member) => {
    const db = await getConfig(member.guild.id);
    if (!db || !db.welcome.channelId) return;
    const channel = member.guild.channels.cache.get(db.welcome.channelId);
    if (!channel) return;

    const embed = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
    await channel.send({ embeds: [embed] });
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

// Quy trình khởi động chuẩn
async function start() {
    if (!MONGO_URI) return console.error('❌ Thiếu biến MONGO_URI!');
    if (!BOT_TOKEN) return console.error('❌ Thiếu biến DISCORD_TOKEN!');

    try {
        console.log('⏳ Đang kết nối MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('🍃 Đã kết nối thành công MongoDB!');

        client.once('ready', async () => {
            console.log(`🤖 Bot đã chạy: ${client.user.tag}`);
            const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
            try {
                await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
                console.log('✅ Đã đăng ký thành công Slash Commands!');
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
