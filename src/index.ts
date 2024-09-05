import {
    Client,
    IntentsBitField,
    GuildEmoji,
} from 'discord.js';
import dotenv from 'dotenv';
import {helpAction, searchAction} from "./actions.js";

dotenv.config();

const keyPhrase = process.env.KEY_PHRASE ?? '';
const addEmojiPhrase = 'add ';
const helpOption = process.env.HELP_OPTION;
const imageOption = process.env.IMAGE_OPTION;
const extendedOption = process.env.EXTENDED_OPTION;

const privateDelimiter = '((';
const publicDelimiter = '<<';

const options = [helpOption, imageOption, extendedOption].join('');
console.log(`Loaded Options: ${options}`);
const commandRegex = new RegExp(`(<{2}|\\({2})${keyPhrase}([ \s${options}])(.*?)(>{2}|\\){2})`, 'gmi');

interface Command {
    queryOption: string;
    query: string;
    privateSelect: boolean;
}
 
let emotes: GuildEmoji[] = [];
const manaServerName = 'TheManaBase'
const manaServerName2 = 'TheManaBase2'
let manaEmoji;

const scrybConfig = {
    selectTimeOut: process.env.TIMEOUT ?? 120_000,
    scryfallApiCardSearchUrl: 'https://api.scryfall.com/cards/search',
    scryfallGetCardTextUrl: (cardId) => `https://api.scryfall.com/cards/${cardId}?format=text&pretty=true`,
    botColor: 0xFFFC30,
    emotes,
    helpOption,
    imageOption,
    extendedOption,
    getManaEmoji: () => {
        if(!manaEmoji)
        manaEmoji = Object.fromEntries(emotes
            .filter((val)=>val.guild.name === manaServerName || val.guild.name === manaServerName2)
            .map((val)=>([val.name, val.id])));
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
    console.log('Mana Emoji Loaded: ', Object.keys(scrybConfig.getManaEmoji())?.length);
})
    botClient.on('messageCreate', async (userMessage)=>{
        try{
            if(userMessage.author.bot){
                return;
            }

            const commandCaptures = [];
            let regexResult = commandRegex.exec(userMessage.content);
            while(regexResult != null){
                commandCaptures.push(regexResult);
                regexResult = commandRegex.exec(userMessage.content);
            }

            const commands = commandCaptures.map((capture)=>({
                privateSelect: capture[1] === privateDelimiter,
                queryOption: capture[2],
                query: capture[3].trim()
            } as Command));

            if(commands.length === 1 && commands[0].queryOption === helpOption){
                console.log(`${userMessage.author.username}:${userMessage.author.id} asked for help`)
                helpAction(userMessage, scrybConfig);
                return;
            }


            


                commands.forEach((command)=>{
                    if(command.queryOption !== helpOption){
                        console.log(`----------------SEARCH ACTION:----------------`)
                        console.log(`${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} Eastern`)
                        console.log(`USER: ${userMessage.author.username}:${userMessage.author.id}`)
                        console.log(`SERVER: ${userMessage.guild.name}:${userMessage.guild.id}`)
                        console.log(`QUERY: ${command.query}`)
                        console.log(`OPTION(PRIVATE?): ${command.queryOption}(${command.privateSelect})`)
                        searchAction(userMessage, {...scrybConfig, query: command.query, queryOption: command.queryOption, privateSelect: command.privateSelect});
                        console.log(`----------------------------------------------\n`)
                    }
                })


        
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