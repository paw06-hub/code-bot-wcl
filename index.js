const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');

// Biến môi trường trên Render
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const MONGO_URI = process.env.MONGO_URI; // Link MongoDB của bạn

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// 1. Tạo Schema / Model lưu vào Database MongoDB
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

// Hàm lấy hoặc tạo mới Cấu hình Server từ Database
async function getConfig(guildId) {
    let data = await Config.findOne({ guildId });
    if (!data) {
        data = await Config.create({ guildId });
    }
    return data;
}

// 2. Khai báo Slash Commands
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

client.once('ready', async () => {
    console.log(`🤖 Bot đã chạy thành công: ${client.user.tag}`);

    // Kết nối Cơ sở dữ liệu MongoDB
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI);
            console.log('🍃 Đã kết nối thành công với MongoDB (Dữ liệu lưu vĩnh viễn)!');
        } catch (err) {
            console.error('❌ Lỗi kết nối MongoDB:', err);
        }
    } else {
        console.error('❌ Thiếu biến MONGO_URI trong Environment Variables!');
    }
    
    if (!BOT_TOKEN) return console.error('❌ Chưa thiết lập DISCORD_TOKEN!');

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Đã đăng ký thành công Slash Commands!');
    } catch (err) {
        console.error('Lỗi khi đăng ký lệnh:', err);
    }
});

// Hàm hỗ trợ tạo Embed
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

// 3. Xử lý Lệnh Slash Command
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '❌ Lệnh này chỉ dành riêng cho **Chủ Bot**!', ephemeral: true });
    }

    const { commandName, options, member, guildId } = interaction;
    const db = await getConfig(guildId);

    if (commandName === 'set-welcome') {
        db.welcome.channelId = options.getChannel('channel').id;
        db.welcome.gifUrl = options.getString('gif');
        if (options.getString('message')) db.welcome.message = options.getString('message');
        await db.save();
        await interaction.reply({ content: `✅ Đã lưu cài đặt Welcome vĩnh viễn tại <#${db.welcome.channelId}>!`, ephemeral: true });
    }

    if (commandName === 'set-goodbye') {
        db.goodbye.channelId = options.getChannel('channel').id;
        db.goodbye.gifUrl = options.getString('gif');
        if (options.getString('message')) db.goodbye.message = options.getString('message');
        await db.save();
        await interaction.reply({ content: `✅ Đã lưu cài đặt Goodbye vĩnh viễn tại <#${db.goodbye.channelId}>!`, ephemeral: true });
    }

    if (commandName === 'set-boost') {
        db.boost.channelId = options.getChannel('channel').id;
        db.boost.gifUrl = options.getString('gif');
        if (options.getString('message')) db.boost.message = options.getString('message');
        await db.save();
        await interaction.reply({ content: `✅ Đã lưu cài đặt Boost vĩnh viễn tại <#${db.boost.channelId}>!`, ephemeral: true });
    }

    // Lệnh Test
    if (commandName === 'test-welcome') {
        if (!db.welcome.gifUrl) return interaction.reply({ content: '❌ Hãy cài `/set-welcome` trước!', ephemeral: true });
        const embed = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
        await interaction.reply({ content: '🧪 **Bản xem trước Welcome:**', embeds: [embed], ephemeral: true });
    }

    if (commandName === 'test-goodbye') {
        if (!db.goodbye.gifUrl) return interaction.reply({ content: '❌ Hãy cài `/set-goodbye` trước!', ephemeral: true });
        const embed = createEmbed(db.goodbye.message, db.goodbye.gifUrl, member);
        await interaction.reply({ content: '🧪 **Bản xem trước Goodbye:**', embeds: [embed], ephemeral: true });
    }

    if (commandName === 'test-boost') {
        if (!db.boost.gifUrl) return interaction.reply({ content: '❌ Hãy cài `/set-boost` trước!', ephemeral: true });
        const embed = createEmbed(db.boost.message, db.boost.gifUrl, member, '#F47FFF');
        await interaction.reply({ content: '🧪 **Bản xem trước Boost:**', embeds: [embed], ephemeral: true });
    }
});

// Sự kiện Welcome
client.on('guildMemberAdd', async (member) => {
    const db = await getConfig(member.guild.id);
    if (!db.welcome.channelId) return;
    const channel = member.guild.channels.cache.get(db.welcome.channelId);
    if (!channel) return;

    const embed = createEmbed(db.welcome.message, db.welcome.gifUrl, member);
    await channel.send({ embeds: [embed] });
});

// Sự kiện Goodbye
client.on('guildMemberRemove', async (member) => {
    const db = await getConfig(member.guild.id);
    if (!db.goodbye.channelId) return;
    const channel = member.guild.channels.cache.get(db.goodbye.channelId);
    if (!channel) return;

    const embed = createEmbed(db.goodbye.message, db.goodbye.gifUrl, member);
    await channel.send({ embeds: [embed] });
});

// Sự kiện Boost Server
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const db = await getConfig(newMember.guild.id);
    if (!db.boost.channelId) return;

    const oldStatus = oldMember.premiumSince;
    const newStatus = newMember.premiumSince;

    if (!oldStatus && newStatus) {
        const channel = newMember.guild.channels.cache.get(db.boost.channelId);
        if (!channel) return;

        const embed = createEmbed(db.boost.message, db.boost.gifUrl, newMember, '#F47FFF');
        await channel.send({ content: `🚀 🎉 <@${newMember.id}> vừa boost server!`, embeds: [embed] });
    }
});

client.login(BOT_TOKEN);