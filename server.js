require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 🔐 إعداد الجلسات والتسجيل الدخول ============
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.AUTH_CALLBACK,
    scope: ['identify', 'guilds', 'guilds.members.read']
}, async (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;
    return done(null, profile);
}));

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }
    res.redirect('/login.html');
}

async function isAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: 'غير مسجل دخول' });
    }

    try {
        const userId = req.user.id;
        const guildId = guildIdGlobal || (req.user.guilds ? req.user.guilds[0]?.id : null);

        if (!guildId) {
            return res.status(400).json({ success: false, message: 'لا يمكن العثور على السيرفر' });
        }

        const guild = await discordClient.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        const hasIdaraRole = member.roles.cache.has(process.env.IDARA);
        const isAdminUser = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').includes(userId) : false;

        if (hasIdaraRole || isAdminUser) {
            req.user.isAdmin = true;
            req.user.guildId = guildId;
            return next();
        } else {
            return res.status(403).json({ success: false, message: 'ليس لديك صلاحية الإدارة' });
        }
    } catch (error) {
        console.error('❌ خطأ في التحقق من الرتبة:', error);
        return res.status(500).json({ success: false, message: 'خطأ في التحقق من الصلاحية' });
    }
}

// ============ 🤖 إعداد بوت الديسكورد ============
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

let guildIdGlobal = null;

discordClient.on('ready', () => {
    console.log('✅✅✅ بوت الديسكورد متصل!');
    console.log(`🤖 البوت: ${discordClient.user.tag}`);
    
    if (discordClient.guilds.cache.size > 0) {
        guildIdGlobal = discordClient.guilds.cache.first().id;
        console.log(`🆔 ايدي السيرفر: ${guildIdGlobal}`);
    }
});

discordClient.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error('❌ فشل اتصال البوت:', error.message);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 📌 Routes ============
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
    passport.authenticate('discord', { 
        failureRedirect: '/login.html?error=auth_failed' 
    }),
    async (req, res) => {
        try {
            console.log(`✅ مستخدم جديد سجل دخول: ${req.user.username}#${req.user.discriminator}`);
            res.redirect('/');
        } catch (error) {
            console.error('❌ خطأ بعد تسجيل الدخول:', error);
            res.redirect('/login.html?error=verification_failed');
        }
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/login.html');
    });
});

app.get('/idara.html', isAuthenticated, async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'idara.html'));
});

app.get('/rules.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rules.html'));
});

app.get('/founders.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'founders.html'));
});

// ============ 📌 API Routes ============

// ✅ API - جلب إعدادات الموقع من config.json
app.get('/api/config', (req, res) => {
    try {
        const configFile = path.join(__dirname, 'config.json');
        
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            res.json({ success: true, config });
        } else {
            // إذا ما في config.json، نرجع إعدادات افتراضية
            res.json({ 
                success: true, 
                config: {
                    site: {
                        name: "سايلنت تاون",
                        description: "موقع سايلنت تاون التعريفي",
                        serverLink: "https://your-server-link.com",
                        discordLink: "https://discord.gg/yourserver",
                        backgroundImage: ""
                    },
                    colors: {
                        primary: "#1E90FF",
                        dark: "#0A192F",
                        light: "#F0F8FF"
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ خطأ في قراءة config.json:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحميل الإعدادات' });
    }
});

// ✅ API - معلومات المستخدم الحالي
app.get('/api/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            success: true,
            authenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                discriminator: req.user.discriminator,
                avatar: req.user.avatar,
                tag: `${req.user.username}#${req.user.discriminator}`
            }
        });
    } else {
        res.json({
            success: true,
            authenticated: false,
            user: null
        });
    }
});

// ✅ API - التحقق من صلاحية الإدارة
app.get('/api/check-admin', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const guildId = guildIdGlobal || (req.user.guilds ? req.user.guilds[0]?.id : null);

        if (!guildId) {
            return res.json({ 
                success: true, 
                isAdmin: false, 
                message: 'لا يوجد سيرفر متاح' 
            });
        }

        const guild = await discordClient.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        const hasIdaraRole = member.roles.cache.has(process.env.IDARA);
        const isAdminUser = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').includes(userId) : false;

        res.json({
            success: true,
            isAdmin: hasIdaraRole || isAdminUser,
            username: req.user.username,
            tag: `${req.user.username}#${req.user.discriminator}`
        });
    } catch (error) {
        console.error('❌ خطأ في check-admin:', error);
        res.json({ success: false, isAdmin: false, error: error.message });
    }
});

// ✅ API - جلب القوانين
app.get('/api/rules', (req, res) => {
    try {
        const rulesFile = path.join(__dirname, 'data', 'rules.json');
        
        if (fs.existsSync(rulesFile)) {
            const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
            res.json({ success: true, rules });
        } else {
            res.json({ success: true, rules: {} });
        }
    } catch (error) {
        console.error('❌ خطأ في قراءة القوانين:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحميل القوانين' });
    }
});

// ✅ API - جلب المؤسسين
app.get('/api/founders', (req, res) => {
    try {
        const foundersFile = path.join(__dirname, 'data', 'founders.json');
        
        if (fs.existsSync(foundersFile)) {
            const founders = JSON.parse(fs.readFileSync(foundersFile, 'utf8'));
            res.json({ success: true, founders });
        } else {
            res.json({ success: true, founders: [] });
        }
    } catch (error) {
        console.error('❌ خطأ في قراءة المؤسسين:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحميل المؤسسين' });
    }
});

// ✅ API - إضافة قانون
app.post('/api/add-rule', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { category, rule } = req.body;
        const rulesFile = path.join(__dirname, 'data', 'rules.json');
        
        let rules = {};
        if (fs.existsSync(rulesFile)) {
            rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
        }
        
        if (!rules[category]) {
            rules[category] = [];
        }
        
        rules[category].push(rule);
        fs.writeFileSync(rulesFile, JSON.stringify(rules, null, 2), 'utf8');
        
        res.json({ success: true, message: '✅ تم إضافة القانون بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في إضافة القانون:', error);
        res.status(500).json({ success: false, message: 'خطأ في إضافة القانون' });
    }
});

// ✅ API - تعديل قانون
app.put('/api/edit-rule', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { category, index, newRule } = req.body;
        const rulesFile = path.join(__dirname, 'data', 'rules.json');
        
        if (!fs.existsSync(rulesFile)) {
            return res.status(404).json({ success: false, message: 'ملف القوانين غير موجود' });
        }
        
        const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
        
        if (rules[category] && rules[category][index]) {
            rules[category][index] = newRule;
            fs.writeFileSync(rulesFile, JSON.stringify(rules, null, 2), 'utf8');
            res.json({ success: true, message: '✅ تم تعديل القانون بنجاح' });
        } else {
            res.status(404).json({ success: false, message: 'القانون غير موجود' });
        }
    } catch (error) {
        console.error('❌ خطأ في تعديل القانون:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعديل القانون' });
    }
});

// ✅ API - حذف قانون
app.delete('/api/delete-rule', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { category, index } = req.query;
        const rulesFile = path.join(__dirname, 'data', 'rules.json');
        
        if (!fs.existsSync(rulesFile)) {
            return res.status(404).json({ success: false, message: 'ملف القوانين غير موجود' });
        }
        
        const rules = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
        
        if (rules[category] && rules[category][index]) {
            rules[category].splice(index, 1);
            fs.writeFileSync(rulesFile, JSON.stringify(rules, null, 2), 'utf8');
            res.json({ success: true, message: '✅ تم حذف القانون بنجاح' });
        } else {
            res.status(404).json({ success: false, message: 'القانون غير موجود' });
        }
    } catch (error) {
        console.error('❌ خطأ في حذف القانون:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف القانون' });
    }
});

// ============ 📌 API المسؤولين ============
app.post('/api/add-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '❌ اسم المسؤول مطلوب' });
        }
        
        const adminsFile = path.join(__dirname, 'data', 'admins.json');
        
        let admins = [];
        if (fs.existsSync(adminsFile)) {
            admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
        }
        
        const newAdmin = {
            id: Date.now().toString(),
            name: name,
            description: description || 'لا يوجد وصف',
            addedBy: req.user.id,
            addedAt: new Date().toISOString()
        };
        
        admins.push(newAdmin);
        fs.writeFileSync(adminsFile, JSON.stringify(admins, null, 2), 'utf8');
        
        res.json({ success: true, message: '✅ تم إضافة المسؤول بنجاح', admin: newAdmin });
    } catch (error) {
        console.error('❌ خطأ في إضافة المسؤول:', error);
        res.status(500).json({ success: false, message: 'خطأ في إضافة المسؤول' });
    }
});

app.get('/api/get-admins', (req, res) => {
    try {
        const adminsFile = path.join(__dirname, 'data', 'admins.json');
        
        if (fs.existsSync(adminsFile)) {
            const admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
            res.json({ success: true, admins });
        } else {
            res.json({ success: true, admins: [] });
        }
    } catch (error) {
        console.error('❌ خطأ في جلب المسؤولين:', error);
        res.status(500).json({ success: false, message: 'خطأ في جلب المسؤولين' });
    }
});

app.delete('/api/delete-admin', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { id } = req.query;
        const adminsFile = path.join(__dirname, 'data', 'admins.json');
        
        if (!fs.existsSync(adminsFile)) {
            return res.status(404).json({ success: false, message: 'ملف المسؤولين غير موجود' });
        }
        
        let admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
        const newAdmins = admins.filter(admin => admin.id !== id);
        
        if (admins.length === newAdmins.length) {
            return res.status(404).json({ success: false, message: 'المسؤول غير موجود' });
        }
        
        fs.writeFileSync(adminsFile, JSON.stringify(newAdmins, null, 2), 'utf8');
        res.json({ success: true, message: '✅ تم حذف المسؤول بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في حذف المسؤول:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف المسؤول' });
    }
});

app.put('/api/edit-admin', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { id, name, description } = req.body;
        const adminsFile = path.join(__dirname, 'data', 'admins.json');
        
        if (!fs.existsSync(adminsFile)) {
            return res.status(404).json({ success: false, message: 'ملف المسؤولين غير موجود' });
        }
        
        let admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
        const index = admins.findIndex(admin => admin.id === id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'المسؤول غير موجود' });
        }
        
        admins[index] = {
            ...admins[index],
            name: name || admins[index].name,
            description: description !== undefined ? description : admins[index].description,
            updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(adminsFile, JSON.stringify(admins, null, 2), 'utf8');
        res.json({ success: true, message: '✅ تم تعديل المسؤول بنجاح', admin: admins[index] });
    } catch (error) {
        console.error('❌ خطأ في تعديل المسؤول:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعديل المسؤول' });
    }
});

// ============ 📌 API المؤسسين ============
app.post('/api/add-founder', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { name, role, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '❌ اسم المؤسس مطلوب' });
        }
        
        const foundersFile = path.join(__dirname, 'data', 'founders.json');
        
        let founders = [];
        if (fs.existsSync(foundersFile)) {
            founders = JSON.parse(fs.readFileSync(foundersFile, 'utf8'));
        }
        
        const newFounder = {
            id: Date.now().toString(),
            name: name,
            role: role || '',
            description: description || 'لا يوجد وصف',
            addedBy: req.user.id,
            addedAt: new Date().toISOString()
        };
        
        founders.push(newFounder);
        fs.writeFileSync(foundersFile, JSON.stringify(founders, null, 2), 'utf8');
        
        res.json({ success: true, message: '✅ تم إضافة المؤسس بنجاح', founder: newFounder });
    } catch (error) {
        console.error('❌ خطأ في إضافة المؤسس:', error);
        res.status(500).json({ success: false, message: 'خطأ في إضافة المؤسس' });
    }
});

app.delete('/api/delete-founder', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { id } = req.query;
        const foundersFile = path.join(__dirname, 'data', 'founders.json');
        
        if (!fs.existsSync(foundersFile)) {
            return res.status(404).json({ success: false, message: 'ملف المؤسسين غير موجود' });
        }
        
        let founders = JSON.parse(fs.readFileSync(foundersFile, 'utf8'));
        const newFounders = founders.filter(f => f.id !== id);
        
        if (founders.length === newFounders.length) {
            return res.status(404).json({ success: false, message: 'المؤسس غير موجود' });
        }
        
        fs.writeFileSync(foundersFile, JSON.stringify(newFounders, null, 2), 'utf8');
        res.json({ success: true, message: '✅ تم حذف المؤسس بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في حذف المؤسس:', error);
        res.status(500).json({ success: false, message: 'خطأ في حذف المؤسس' });
    }
});

app.put('/api/edit-founder', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { id, name, role, description } = req.body;
        const foundersFile = path.join(__dirname, 'data', 'founders.json');
        
        if (!fs.existsSync(foundersFile)) {
            return res.status(404).json({ success: false, message: 'ملف المؤسسين غير موجود' });
        }
        
        let founders = JSON.parse(fs.readFileSync(foundersFile, 'utf8'));
        const index = founders.findIndex(f => f.id === id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'المؤسس غير موجود' });
        }
        
        founders[index] = {
            ...founders[index],
            name: name || founders[index].name,
            role: role !== undefined ? role : founders[index].role,
            description: description !== undefined ? description : founders[index].description,
            updatedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(foundersFile, JSON.stringify(founders, null, 2), 'utf8');
        res.json({ success: true, message: '✅ تم تعديل المؤسس بنجاح', founder: founders[index] });
    } catch (error) {
        console.error('❌ خطأ في تعديل المؤسس:', error);
        res.status(500).json({ success: false, message: 'خطأ في تعديل المؤسس' });
    }
});

// ✅ API - إرسال اقتراح/شكوى
app.post('/api/send-suggestion', async (req, res) => {
    try {
        const { type, content } = req.body;
        
        if (!type || !content) {
            return res.status(400).json({ success: false, message: '❌ جميع الحقول مطلوبة' });
        }

        let userId = 'مجهول';
        let userTag = 'مجهول';
        
        if (req.isAuthenticated()) {
            userId = req.user.id;
            userTag = `${req.user.username}#${req.user.discriminator}`;
        }

        const channel = discordClient.channels.cache.get(process.env.SUGGESTION_CHANNEL_ID);
        if (!channel) {
            return res.status(500).json({ success: false, message: '❌ قناة الاقتراحات غير موجودة' });
        }

        const embed = new EmbedBuilder()
            .setColor(type === 'شكوى' ? 0xFF0000 : 0x1E90FF)
            .setTitle(`📬 ${type} جديدة`)
            .setDescription(content)
            .addFields(
                { name: '👤 المرسل', value: userId === 'مجهول' ? 'مجهول' : `<@${userId}> (${userTag})`, inline: true },
                { name: '📅 التاريخ', value: new Date().toLocaleString('ar-SA'), inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_${userId}_${Date.now()}`)
                    .setLabel('✅ قبول')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`reject_${userId}_${Date.now()}`)
                    .setLabel('❌ رفض')
                    .setStyle(ButtonStyle.Danger)
            );

        await channel.send({ embeds: [embed], components: [row] });

        res.json({ success: true, message: '✅ تم إرسال الاقتراح بنجاح!' });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ success: false, message: '❌ حدث خطأ أثناء الإرسال' });
    }
});

discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const [action, userId, timestamp] = interaction.customId.split('_');
    
    try {
        const user = await discordClient.users.fetch(userId).catch(() => null);
        
        if (action === 'accept') {
            if (user) {
                await user.send(`🎉 **تم قبول اقتراحك/شكواك!**\n\nشكراً لك على مشاركتك معنا في **سايلنت تاون**.`);
            }
            
            await interaction.update({ 
                components: [],
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ تم القبول')
                    .setDescription(`تمت الموافقة بواسطة ${interaction.user.tag}`)
                    .setTimestamp()
                ]
            });
            
        } else if (action === 'reject') {
            if (user) {
                await user.send(`❌ **تم رفض اقتراحك/شكواك**\n\nنعتذر، اقتراحك/شكواك لا تتوافق مع معاييرنا.`);
            }
            
            await interaction.update({ 
                components: [],
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ تم الرفض')
                    .setDescription(`تم الرفض بواسطة ${interaction.user.tag}`)
                    .setTimestamp()
                ]
            });
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الزر:', error);
    }
});

// ============ 📁 إنشاء المجلدات والملفات ============
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
    console.log('📁 تم إنشاء مجلد data');
}

const rulesFile = path.join(dataDir, 'rules.json');
if (!fs.existsSync(rulesFile)) {
    fs.writeFileSync(rulesFile, JSON.stringify({}, null, 2), 'utf8');
    console.log('📄 تم إنشاء ملف rules.json');
}

const foundersFile = path.join(dataDir, 'founders.json');
if (!fs.existsSync(foundersFile)) {
    fs.writeFileSync(foundersFile, JSON.stringify([], null, 2), 'utf8');
    console.log('📄 تم إنشاء ملف founders.json');
}

const adminsFile = path.join(dataDir, 'admins.json');
if (!fs.existsSync(adminsFile)) {
    fs.writeFileSync(adminsFile, JSON.stringify([], null, 2), 'utf8');
    console.log('📄 تم إنشاء ملف admins.json');
}

// التحقق من وجود config.json
const configFile = path.join(__dirname, 'config.json');
if (!fs.existsSync(configFile)) {
    // إنشاء config.json افتراضي إذا ما كان موجود
    const defaultConfig = {
        site: {
            name: "سايلنت تاون",
            description: "موقع سايلنت تاون التعريفي",
            serverLink: "https://your-server-link.com",
            discordLink: "https://discord.gg/yourserver",
            backgroundImage: ""
        },
        colors: {
            primary: "#1E90FF",
            dark: "#0A192F",
            light: "#F0F8FF"
        }
    };
    fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('📄 تم إنشاء ملف config.json افتراضي');
}

// ============ 🚀 تشغيل السيرفر ============
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال على: http://localhost:${PORT}`);
    console.log(`🔐 تسجيل الدخول: http://localhost:${PORT}/login.html`);
    console.log(`🏠 الصفحة الرئيسية: http://localhost:${PORT}/`);
    console.log(`👑 لوحة الإدارة: http://localhost:${PORT}/idara.html`);
    console.log(`⚙️ ملف الإعدادات: config.json`);
});


