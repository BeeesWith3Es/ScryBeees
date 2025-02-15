import {
    Client,
    IntentsBitField,
    GuildEmoji,
} from 'discord.js';
import dotenv from 'dotenv';
import {helpAction, searchAction} from "./actions.js";

dotenv.config();

const addEmojiPhrase = 'add ';
const helpOption = '?';
const imageOption = '!';
const linkOption = '@'
const extendedOption = '&';
const optionsSplitter = '@'

const privateDelimiter = '((';
const publicDelimiter = '<<';

const options = [helpOption, imageOption, extendedOption, linkOption].join('');
console.log(`Loaded Options: ${options}`);
const commandRegex = /<<([?!@&]?)(.*?)>>(@\S*)?/gmi;

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
    scryfallSearchPageUrl: `https://scryfall.com/search`,
    botColor: 0xFFFC30,
    emotes,
    helpOption,
    imageOption,
    extendedOption,
    linkOption,
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

export enum OPTIONS {
    PRIVATE = 'private'
}

const getOptions = (optionsString: string) => {
    if(!optionsString) return [];
    const optionsArray = optionsString.split(optionsSplitter);
    const selectedOptions = [];
    if((optionsArray.length == 2 && optionsArray[0] === optionsArray[1]) || optionsArray.includes(OPTIONS.PRIVATE)){
        selectedOptions.push(OPTIONS.PRIVATE)
    }
    return selectedOptions;
}

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

            const commands = commandCaptures.map((capture)=>{
                const options =  getOptions(capture[3]);
                return {
                    queryOption: capture[1],
                    query: capture[2].trim(),
                    privateSelect: options.includes(OPTIONS.PRIVATE)
                } as Command}
            );

            if(commands.length === 1 && commands[0].queryOption === helpOption){
                console.log(`${userMessage.author.username}:${userMessage.author.id} asked for help`)
                helpAction(userMessage, scrybConfig);
                return;
            }

                for (const command of commands) {
                    if(command.queryOption !== helpOption){
                        console.log(`----------------SEARCH ACTION:----------------`)
                        console.log(`${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} Eastern`)
                        console.log(`USER: ${userMessage.author.username}:${userMessage.author.id}`)
                        console.log(`SERVER: ${userMessage.guild.name}:${userMessage.guild.id}`)
                        console.log(`QUERY: ${command.query}`)
                        console.log(`OPTION(PRIVATE?): ${command.queryOption}(${command.privateSelect})`)
                        try {
                           await searchAction(userMessage, {...scrybConfig, query: command.query, queryOption: command.queryOption, privateSelect: command.privateSelect});
                        }catch(error){
                            console.log("\nError during search action\n", `\nName: ${error.name}\nMessage: ${error.message}\nCode: ${error.code}`);
                        }

                        console.log(`----------------------------------------------\n`)
                    }
                }

        }catch(error){
            console.log("Error during message received\n", `Code: ${error.code}\nMessage: ${error.message}`, '\nMessage:\n', userMessage);
        }
    })

botClient.login(process.env.BOT_TOKEN);