import {
    Client,
    IntentsBitField,
    GuildEmoji,
} from 'discord.js';
import dotenv from 'dotenv';
import {helpAction, searchAction} from "./actions.js";

dotenv.config();

const keyPhrase = process.env.KEY_PHRASE;
const addEmojiPhrase = 'add ';
const helpPhrase = process.env.HELP_PHRASE;
 
let emotes: GuildEmoji[] = [];
const manaServerName = 'TheManaBase'
const manaServerName2 = 'TheManaBase2'
let manaEmoji;

const scrybConfig = {
    selectTimeOut: 30_000,
    scryfallApiUrl: 'https://api.scryfall.com/cards/search',
    botColor: 0xFFFC30,
    emotes,
    getManaEmoji: () => {
        if(!manaEmoji)
        manaEmoji = emotes.filter((val)=>val.guild.name === manaServerName || val.guild.name === manaServerName2);
        return manaEmoji;
    }
}
    

const botClient = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildEmojisAndStickers,
        IntentsBitField.Flags.MessageContent
    ],
    allowedMentions: {repliedUser: false}
});

botClient.on('ready', (client)=>{
    console.log(`Ready at ${new Date(client.readyTimestamp)}`);
    emotes = Array.from(client.emojis.valueOf().values());
    scrybConfig.emotes = emotes;
    const faeFrog = emotes.find((emote)=>emote.name === "FaeFrog");
    console.log(`Emoji Loaded at ${new Date()} <:${faeFrog.name}:${faeFrog.id}>`);
})
    botClient.on('messageCreate', async (userMessage)=>{
        try{
            if(userMessage.author.bot){
                return;
            }

            if(userMessage.content.toLowerCase().startsWith(helpPhrase)){
                console.log(`${userMessage.author.username}:${userMessage.author.id} asked for help`)
                helpAction(userMessage, scrybConfig);
                return;
            }


            
            if(userMessage.content.toLowerCase().startsWith(keyPhrase)){
                const imageOnlySelected = (q: string) => {
                    if(q.startsWith('!')) {
                        q.replace('!', '');
                        return true;
                    }
                    return false;
                }
                const query = userMessage.content.toLowerCase().replace(keyPhrase, '');
                const imageOnly = imageOnlySelected(query);
                query.trim();

                console.log(`----------------\nSEARCH ACTION:\nUSER: ${userMessage.author.username}:${userMessage.author.id}\nQUERY: ${query}\n----------------\n`)
                searchAction(userMessage, query, imageOnly, scrybConfig);
            }
        
            // if(message.content.toLowerCase().startsWith(addEmojiPhrase)){
            //     try{
            //         const emoteRegex = /<:(.+):(\d+)>/gm;
            //         const emojiUris = message.content.replace(addEmojiPhrase, '').split(' ').map((emote)=>{
            //             const extractedEmote = emoteRegex.exec(emote);
            //             const url =  `https://cdn.discordapp.com/emojis/${extractedEmote?.[2]}.png?v=1`
            //             const name = extractedEmote?.[1]//.replace('mana', 'mana_');
            //             emoteRegex.lastIndex = 0;
            //             console.log(extractedEmote);
            //             return {url, name};
            //         })
            //         .forEach((emojiUri)=>{message.guild.emojis.create({name: emojiUri.name.replace('mana', 'mana_'), attachment: emojiUri.url})});
                    
            //     }catch(error){
            //         console.log("OOOOOPS!!!", error)
            //     }
            // }

        }catch(error){
            console.log("Error during message received\n", error, '\nMessage:\n', userMessage);
            userMessage.reply(`There was an error in processing your request: "${error.message}"\nBut I did not crash, try again!`);
        }
    })

botClient.login(process.env.BOT_TOKEN);