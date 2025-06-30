const token = "";

process.on("uncaughtException", async (er) => {
    console.log(er.message);
})

const { BaleBot } = require("node-bale-api");
const { MaskText } = require("node-bale-api/Objects/interfaces");
const Database = require("better-sqlite3");
const crypto = require("node:crypto");

const bot = new BaleBot(token, { polling: true, polling_interval: 103 });

let steps = {};

class theSql {
    constructor(){
        this.sql = new Database("objectives.db", { timeout: 5 });
        this.setup();
    }

    setup(){
        this.sql.exec("CREATE TABLE IF NOT EXISTS messages (hash TEXT PRIMARY KEY, byuser TEXT, touser TEXT, message TEXT)");
    }

    async getAll(callback = () => {}){
        callback(
            this.sql.prepare("SELECT * FROM messages").all()
        )
    }

    async createMessageHash(){
        return crypto.createHash("sha512").update(
            crypto.createHash("sha224").update(
                crypto.createHash("sha384").update(
                    crypto.createHash("sha256").update(
                        crypto.createHash("md5").update(
                            ( Math.floor(Math.random() * 9e+79) ).toString()
                        ).digest("hex")
                    ).digest("hex")
                ).digest("hex")
            ).digest("hex")
        ).digest("hex").slice(10, 26)
    }

    async pushMessage(
        byUser,
        toUser,
        message,
        callback = () => {}
    ){
        let msgHash = await this.createMessageHash();

        let st = this.sql.prepare("INSERT INTO messages (hash, byuser, touser, message) VALUES (?, ?, ?, ?)");
        st.run(msgHash, byUser, toUser, message);
        callback({
            status: true,
            hash: msgHash,
            by: byUser,
            to: toUser
        });
        return;
    }

    async getMessageByHash(hash, callback = () => {}){
        await this.getAll(async (everything) => {
            for (let every of everything){
                if (every.hash == hash){
                    callback({
                        status: true,
                        message: every
                    });
                    return;
                }
            }

            callback({
                status: false
            });
            return;
        })
    }

}

function extractNumbers(string){
    return string.match(/\d+(\.\d+)?/g);
}

bot.getMe(async (a) => {
    console.log(a)
})

const tsql = new theSql();

bot.on("message", async (message) => {
    message.text == undefined || message.text == null ? "" : message.text;
    console.log("Message: ", message.text);
    if (message.text.startsWith("/start")){
        await bot.replyTo(message, `👤 | ${new MaskText(["", undefined].includes(message.from.first_name.trim()) ? "USER" : message.from.first_name.trim()).createLink(`${message.from.id}`)} - ${message.from.id}\n💬 | به ربات نجوا خوش آمدید !`, {
            keyboard_mode: "inline_keyboard",
            reply_markup: [
                [
                    {
                        text: "💠 راهنما",
                        callback_data: `seeHelp_${message.from.id}`
                    },
                    {
                        text: "🐈 گیتهاب پروژه",
                        callback_url: "https://github.com/TheTimelessX/BBot"
                    }
                ],
                message.chat.type == "group" ? [
                    {
                        text: "📪 آیدی عددی گروه",
                        callback_data: `extractGroupId_${message.from.id}`
                    }
                ] : []
            ]
        })
    } else if (message.chat.type == "private" && message.text !== ""){
        if (!(Object.keys(steps).includes(message.from.id.toString()))){
            if (message.text.length > 200){
                await bot.replyTo(message, "🔒 | پیام نمیتواند بیشتر از 200 کرکتر باشد !");
                return;
            }

            steps[message.from.id] = {
                step: "getToUser",
                message: message.text
            }

            await bot.replyTo(message, "➕ | آیدی عددی یا آیدی شخص دریافت کننده را ارسال کنید")

        } else if (steps[message.from.id].step == "getToUser"){
            if (message.text.length > 200){
                await bot.replyTo(message, "🔒 | آیدی نمیتواند بیشتر از 200 کرکتر باشد !");
                return;
            }

            steps[message.from.id].to = message.text;
            steps[message.from.id].step = "getGroupChat";
            await bot.replyTo(message, "➕ | آیدی عددی یا آیدی گپ را ارسال کنید")
        } else if (steps[message.from.id].step == "getGroupChat"){
            if (message.text.length > 200){
                await bot.replyTo(message, "🔒 | آیدی نمیتواند بیشتر از 200 کرکتر باشد !");
                return;
            }

            await bot.getChat(message.text, async (chat) => {
                if (chat.id == undefined){
                    await bot.replyTo(message, "🔴 | گروه پیدا نشد دوباره تلاش کنید !");
                    return;
                } else if (chat.type != "group"){
                    await bot.replyTo(message, "🔴 | آیدی دریافت شده مطعلق به یک گروه نمیباشد !");
                    return;
                } else {
                    
                    let inf = `📪 | ${chat.id}`;

                    chat.title !== undefined || chat.title !== null ? inf += `\n📜 | ${chat.title}` : '';
                    chat.invite_link !== undefined || chat.invite_link !== null ? inf += `\n🔗 | ${chat.invite_link}` : '';
                    chat.username !== undefined || chat.username !== null ? inf += `\n📦 | @${chat.username}` : '';
                    
                    await bot.replyTo(message, inf);
                    await bot.replyTo(message, "✅ | پروسه موفقیت آمیز بود و پیام ارسال خواهد شد")

                    await tsql.pushMessage(
                        message.from.id.toString(),
                        steps[message.from.id].to,
                        steps[message.from.id].message,
                        async (clback) => {
                            await bot.sendMessage(chat.id, `💬 | یک نجوا برای ${steps[message.from.id].to} از ${message.from.id} ارسال شد`, {
                                keyboard_mode: "inline_keyboard",
                                reply_markup: [
                                    [
                                        {
                                            text: "🏮 نمایش",
                                            callback_data: `showToast_${steps[message.from.id].to}_${clback.hash}`
                                        }
                                    ]
                                ]
                            });
                            delete steps[message.from.id];
                        }
                    )
                }
            })
        }
    }
})

bot.on("callback_query", async (call) => {
    let spl = call.data.split("_");
    let uid = parseInt(spl[1]);
    let mode = spl[0];

    if (uid == call.from.id){
        if (mode == "seeHelp"){
            await bot.editMessageText(
                call.message.chat.id,
                "🗼 | استفاده از ربات نجوا توی بله, با تلگرام فرق میکنه ! به دلیل نبود inline query پروسه فرق میکنه\n\n🛠 | به پیوی بات برید و استارتش کنید, پیامتون رو ارسال کنید, سپس آیدی عددی یا آیدی کاربری که میخواید نجوا بفرستید رو ارسال کنید, سپس آیدی عددی یا آیدی گروهی که میخواید نجوا بفرستید رو ارسال کنید\n\nبه همین سادگی !",
                call.message.id, {
                    keyboard_mode: "inline_keyboard",
                    reply_markup: [
                        [
                            {
                                text: "🔙 بازگشت",
                                callback_data: `backToMenu_${call.from.id}`
                            }
                        ]
                    ]
                }
            )
        } else if (mode == "backToMenu"){
            await bot.editMessageText(call.message.chat.id, `👤 | ${new MaskText(["", undefined].includes(call.from.first_name.trim()) ? "USER" : call.from.first_name.trim()).createLink(`${call.from.id}`)} - ${call.from.id}\n💬 | به ربات نجوا خوش آمدید !`, call.message.id, {
                keyboard_mode: "inline_keyboard",
                reply_markup: [
                    [
                        {
                            text: "💠 راهنما",
                            callback_data: `seeHelp_${call.from.id}`
                        },
                        {
                            text: "🐈 گیتهاب پروژه",
                            callback_url: "https://github.com/TheTimelessX/BBot"
                        }
                    ],
                    [
                        {
                            text: "📪 آیدی عددی گروه",
                            callback_data: `extractGroupId_${call.from.id}`
                        }
                    ]
                ]
            })
        } else if (mode == "extractGroupId"){
            await bot.editMessageText(
                call.message.chat.id,
                `🍁 | آیدی عددی گروه: ${new MaskText(call.message.chat.id.toString()).bold()}`,
                call.message.id,
                {
                    keyboard_mode: "inline_keyboard",
                    reply_markup: [
                        [
                            {
                                text: "🔙 بازگشت",
                                callback_data: `backToMenu_${call.from.id}`
                            }
                        ]
                    ]
                }
            )
        } else if (mode == "showToast"){
            let hash = spl[2];
            await tsql.getMessageByHash(hash, async (message) => {
                if (message.status){
                    let nums = extractNumbers(call.message.text);
                    await bot.answerCallbackQuery(
                        call.id,
                        {
                            text: message.message.message,
                            show_alert: true
                        }
                    )
                    await bot.editMessageText(
                        call.message.chat.id,
                        `💬 | یک نجوا برای ${nums[0]} از ${nums[1]} ارسال شد\n\n🔓 | نجوا خونده شد`,
                        call.message.id
                    )
                } else {
                    await bot.answerCallbackQuery(
                        call.id,
                        {
                            text: "🔴 | نجوا در دیتابیس پیدا نشد",
                            show_alert: true
                        }
                    )
                }
            })
        }
    }
})
